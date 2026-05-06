const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Helper: sign JWT
const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

// ─── POST /api/auth/register ───
router.post('/register', [
  body('name').trim().notEmpty().withMessage('الاسم مطلوب'),
  body('email').isEmail().withMessage('بريد إلكتروني غير صحيح').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('كلمة المرور 6 أحرف على الأقل'),
  body('department').notEmpty().withMessage('القسم مطلوب'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { name, email, password, department, role } = req.body;

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ success: false, message: 'البريد الإلكتروني مسجل مسبقًا' });
    }

    const user = await User.create({ name, email, password, department, role: role || 'employee' });
    const token = signToken(user._id);

    res.status(201).json({ success: true, token, user: user.toSafeObject() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/auth/login ───
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'البريد أو كلمة المرور غلط' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'الحساب غير نشط — تواصل مع المدير' });
    }

    const token = signToken(user._id);
    res.json({ success: true, token, user: user.toSafeObject() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/auth/me ───
router.get('/me', protect, async (req, res) => {
  res.json({ success: true, user: req.user });
});

// ─── PATCH /api/auth/me ───
router.patch('/me', protect, [
  body('name').optional().trim().notEmpty(),
  body('department').optional().notEmpty(),
], async (req, res) => {
  try {
    const updates = {};
    if (req.body.name)       updates.name = req.body.name;
    if (req.body.department) updates.department = req.body.department;

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
