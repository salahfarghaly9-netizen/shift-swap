const express = require('express');
const { body, validationResult } = require('express-validator');
const SwapRequest = require('../models/SwapRequest');
const Shift       = require('../models/Shift');
const User        = require('../models/User');
const Notification = require('../models/Notification');
const { protect, managerOnly } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

/* ─────────────────────────────────────────
   Helper: create a notification for a user
───────────────────────────────────────── */
async function notify(userId, type, title, message, swapId) {
  await Notification.create({ user: userId, type, title, message, relatedSwap: swapId });
}

/* ─────────────────────────────────────────
   GET /api/swaps
   Public feed (all open requests) + own requests
───────────────────────────────────────── */
router.get('/', async (req, res) => {
  try {
    const filter = {};

    if (req.query.status)    filter.status = req.query.status;
    if (req.query.urgency)   filter.urgency = req.query.urgency;
    if (req.query.mine === 'true') filter.requester = req.user._id;

    // Default: show open requests visible to the whole team
    if (!req.query.status && req.query.mine !== 'true') {
      filter.status = 'مفتوح';
    }

    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);

    const [swaps, total] = await Promise.all([
      SwapRequest.find(filter)
        .populate('requester', 'name department avatar')
        .populate('acceptor',  'name department avatar')
        .populate({ path: 'requesterShift', populate: { path: 'user', select: 'name' } })
        .sort({ urgency: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      SwapRequest.countDocuments(filter)
    ]);

    res.json({ success: true, total, page, pages: Math.ceil(total / limit), swaps });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ─────────────────────────────────────────
   GET /api/swaps/:id
───────────────────────────────────────── */
router.get('/:id', async (req, res) => {
  try {
    const swap = await SwapRequest.findById(req.params.id)
      .populate('requester',     'name email department avatar swapStats')
      .populate('acceptor',      'name email department avatar')
      .populate('reviewedBy',    'name')
      .populate('requesterShift');

    if (!swap) return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
    res.json({ success: true, swap });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ─────────────────────────────────────────
   POST /api/swaps
   Employee posts a new swap request
───────────────────────────────────────── */
router.post('/', [
  body('shiftId').notEmpty().withMessage('الشيفت المطلوب تبديله مطلوب'),
  body('urgency').optional().isIn(['عادية', 'متوسطة', 'عاجلة']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });

  try {
    // Verify shift belongs to the requester
    const shift = await Shift.findById(req.body.shiftId);
    if (!shift)
      return res.status(404).json({ success: false, message: 'الشيفت غير موجود' });
    if (shift.user.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'هذا الشيفت مش بتاعك' });
    if (shift.status === 'مُبدَّل')
      return res.status(400).json({ success: false, message: 'الشيفت ده اتبدل من قبل' });

    // Check no open request already exists for this shift
    const existing = await SwapRequest.findOne({
      requesterShift: shift._id,
      status: { $in: ['مفتوح', 'مقبول'] }
    });
    if (existing)
      return res.status(409).json({ success: false, message: 'في طلب تبديل مفتوح لنفس الشيفت' });

    const swap = await SwapRequest.create({
      requester:      req.user._id,
      requesterShift: shift._id,
      isPartial:      req.body.isPartial || false,
      partialStart:   req.body.partialStart || null,
      partialEnd:     req.body.partialEnd   || null,
      reason:         req.body.reason,
      availableTimes: req.body.availableTimes,
      urgency:        req.body.urgency || 'عادية',
    });

    // Mark shift as needing coverage
    shift.status = 'محتاج تغطية';
    await shift.save();

    // Update requester stats
    await User.findByIdAndUpdate(req.user._id, { $inc: { 'swapStats.sent': 1 } });

    const populated = await swap.populate([
      { path: 'requester',     select: 'name department' },
      { path: 'requesterShift' }
    ]);

    res.status(201).json({ success: true, swap: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ─────────────────────────────────────────
   POST /api/swaps/:id/accept
   Another employee accepts the swap
───────────────────────────────────────── */
router.post('/:id/accept', async (req, res) => {
  try {
    const swap = await SwapRequest.findById(req.params.id).populate('requester', 'name');
    if (!swap)
      return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
    if (swap.status !== 'مفتوح')
      return res.status(400).json({ success: false, message: 'الطلب مش متاح للقبول دلوقتي' });
    if (swap.requester._id.toString() === req.user._id.toString())
      return res.status(400).json({ success: false, message: 'مينفعش تقبل طلبك أنت' });

    swap.acceptor = req.user._id;
    swap.status   = 'مقبول';
    await swap.save();

    // Notify requester
    await notify(
      swap.requester._id,
      'swap_accepted',
      'قبول طلب التبديل',
      `${req.user.name} قبل طلب التبديل بتاعك — في انتظار موافقة المدير`,
      swap._id
    );

    await User.findByIdAndUpdate(req.user._id, { $inc: { 'swapStats.received': 1 } });

    res.json({ success: true, swap, message: 'تم قبول الطلب — في انتظار موافقة المدير' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ─────────────────────────────────────────
   POST /api/swaps/:id/withdraw
   Requester withdraws their open request
───────────────────────────────────────── */
router.post('/:id/withdraw', async (req, res) => {
  try {
    const swap = await SwapRequest.findById(req.params.id).populate('requesterShift');
    if (!swap)
      return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
    if (swap.requester.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'مش طلبك' });
    if (!['مفتوح', 'مقبول'].includes(swap.status))
      return res.status(400).json({ success: false, message: 'مينفعش تسحب الطلب في حالته دي' });

    swap.status = 'منسحب';
    await swap.save();

    // Restore shift status
    if (swap.requesterShift) {
      swap.requesterShift.status = 'مؤكد';
      await swap.requesterShift.save();
    }

    // Notify acceptor if there was one
    if (swap.acceptor) {
      await notify(
        swap.acceptor,
        'swap_withdrawn',
        'انسحاب من طلب التبديل',
        `${req.user.name} سحب طلب التبديل`,
        swap._id
      );
    }

    res.json({ success: true, message: 'تم سحب الطلب' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ─────────────────────────────────────────
   POST /api/swaps/:id/approve   (manager)
   POST /api/swaps/:id/reject    (manager)
───────────────────────────────────────── */
router.post('/:id/approve', managerOnly, async (req, res) => {
  try {
    const swap = await SwapRequest.findById(req.params.id)
      .populate('requesterShift')
      .populate('requester', 'name')
      .populate('acceptor',  'name');

    if (!swap)
      return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
    if (swap.status !== 'مقبول')
      return res.status(400).json({ success: false, message: 'الطلب لازم يتقبل الأول من موظف' });

    swap.status     = 'موافق عليه';
    swap.reviewedBy = req.user._id;
    swap.reviewedAt = new Date();
    swap.reviewNote = req.body.note || '';
    await swap.save();

    // Mark original shift as swapped
    if (swap.requesterShift) {
      swap.requesterShift.status = 'مُبدَّل';
      await swap.requesterShift.save();
    }

    // Update stats
    await User.findByIdAndUpdate(swap.requester._id, { $inc: { 'swapStats.completed': 1 } });
    await User.findByIdAndUpdate(swap.acceptor._id,  { $inc: { 'swapStats.completed': 1 } });

    // Notify both parties
    const msg = `المدير ${req.user.name} وافق على التبديل ✓`;
    await notify(swap.requester._id, 'swap_approved', 'تمت الموافقة على التبديل', msg, swap._id);
    await notify(swap.acceptor._id,  'swap_approved', 'تمت الموافقة على التبديل', msg, swap._id);

    res.json({ success: true, swap, message: 'تمت الموافقة — تم إشعار الطرفين' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/:id/reject', managerOnly, async (req, res) => {
  try {
    const swap = await SwapRequest.findById(req.params.id)
      .populate('requesterShift')
      .populate('requester', 'name')
      .populate('acceptor',  'name');

    if (!swap)
      return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
    if (!['مقبول', 'مفتوح'].includes(swap.status))
      return res.status(400).json({ success: false, message: 'لا يمكن رفض هذا الطلب في حالته الحالية' });

    swap.status     = 'مرفوض';
    swap.reviewedBy = req.user._id;
    swap.reviewedAt = new Date();
    swap.reviewNote = req.body.note || '';
    await swap.save();

    // Restore shift to confirmed
    if (swap.requesterShift) {
      swap.requesterShift.status = 'مؤكد';
      await swap.requesterShift.save();
    }

    const reason = req.body.note ? `السبب: ${req.body.note}` : '';
    await notify(swap.requester._id, 'swap_rejected', 'رفض طلب التبديل',
      `تم رفض طلب التبديل بتاعك من المدير. ${reason}`, swap._id);
    if (swap.acceptor) {
      await notify(swap.acceptor._id, 'swap_rejected', 'رفض طلب التبديل',
        `تم رفض طلب التبديل من المدير. ${reason}`, swap._id);
    }

    res.json({ success: true, message: 'تم الرفض — تم إشعار الطرفين' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ─────────────────────────────────────────
   GET /api/swaps/stats/summary  (manager)
───────────────────────────────────────── */
router.get('/stats/summary', managerOnly, async (req, res) => {
  try {
    const [open, pending, approved, rejected, total] = await Promise.all([
      SwapRequest.countDocuments({ status: 'مفتوح' }),
      SwapRequest.countDocuments({ status: 'مقبول' }),
      SwapRequest.countDocuments({ status: 'موافق عليه' }),
      SwapRequest.countDocuments({ status: 'مرفوض' }),
      SwapRequest.countDocuments()
    ]);

    const urgentOpen = await SwapRequest.countDocuments({ status: 'مفتوح', urgency: 'عاجلة' });

    res.json({ success: true, stats: { open, pending, approved, rejected, total, urgentOpen } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
