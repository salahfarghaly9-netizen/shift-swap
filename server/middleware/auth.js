const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT and attach user to req
const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'غير مصرح — سجّل دخولك' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'المستخدم غير موجود أو غير نشط' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'التوكن غير صالح أو منتهي' });
  }
};

// Manager-only middleware (must come after protect)
const managerOnly = (req, res, next) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ success: false, message: 'هذا الإجراء للمدير فقط' });
  }
  next();
};

module.exports = { protect, managerOnly };
