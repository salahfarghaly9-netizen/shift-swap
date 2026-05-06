require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const morgan   = require('morgan');
const path     = require('path');
const connectDB = require('./config/db');

// ─── Connect to MongoDB ───────────────────────────────────────────────────────
connectDB();

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/users',         require('./routes/users'));
app.use('/api/shifts',        require('./routes/shifts'));
app.use('/api/swaps',         require('./routes/swapRequests'));
app.use('/api/notifications', require('./routes/notifications'));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'running',
    time: new Date().toISOString(),
    env: process.env.NODE_ENV
  });
});

// ─── Serve React / HTML frontend (production) ────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/public')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/public', 'index.html'));
  });
}

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `المسار ${req.originalUrl} غير موجود` });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('🔥', err.stack);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ success: false, message: messages.join(', ') });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({ success: false, message: `${field} مسجل مسبقًا` });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError')  return res.status(401).json({ success: false, message: 'توكن غير صالح' });
  if (err.name === 'TokenExpiredError')  return res.status(401).json({ success: false, message: 'انتهت صلاحية الجلسة — سجّل دخولك مجددًا' });

  res.status(err.status || 500).json({ success: false, message: err.message || 'خطأ في السيرفر' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 ShiftSwap server running on http://localhost:${PORT}`);
  console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
  console.log(`   MongoDB     : ${process.env.MONGODB_URI}`);
  console.log(`   API docs    : http://localhost:${PORT}/api/health\n`);
});

module.exports = app;
