const express = require('express');
const { body, query, validationResult } = require('express-validator');
const User = require('../models/User');
const Shift = require('../models/Shift');
const { protect, managerOnly } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// ─── GET /api/users ─── (manager sees all; employee sees team list)
router.get('/', async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.department) filter.department = req.query.department;
    if (req.query.role)       filter.role = req.query.role;

    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);

    const [users, total] = await Promise.all([
      User.find(filter)
          .select('-password')
          .sort({ name: 1 })
          .skip((page - 1) * limit)
          .limit(limit),
      User.countDocuments(filter)
    ]);

    res.json({ success: true, total, page, pages: Math.ceil(total / limit), users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/users/:id ───
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/users/:id/shifts ───
router.get('/:id/shifts', async (req, res) => {
  try {
    const { from, to } = req.query;
    const filter = { user: req.params.id };
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to)   filter.date.$lte = new Date(to);
    }
    const shifts = await Shift.find(filter).sort({ date: 1, startTime: 1 });
    res.json({ success: true, shifts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PATCH /api/users/:id ─── (manager only)
router.patch('/:id', managerOnly, [
  body('role').optional().isIn(['employee', 'manager']),
  body('isActive').optional().isBoolean(),
  body('department').optional().notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  try {
    const allowed = ['name', 'department', 'role', 'isActive'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DELETE /api/users/:id ─── soft delete (manager only)
router.delete('/:id', managerOnly, async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'لا تستطيع حذف حسابك بنفسك' });
    }
    await User.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'تم تعطيل المستخدم' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
