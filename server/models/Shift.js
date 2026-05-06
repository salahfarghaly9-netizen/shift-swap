const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: [true, 'تاريخ الشيفت مطلوب']
  },
  startTime: {
    type: String,   // "08:00"
    required: [true, 'وقت البداية مطلوب'],
    match: [/^\d{2}:\d{2}$/, 'صيغة الوقت غير صحيحة (HH:MM)']
  },
  endTime: {
    type: String,   // "16:00"
    required: [true, 'وقت النهاية مطلوب'],
    match: [/^\d{2}:\d{2}$/, 'صيغة الوقت غير صحيحة (HH:MM)']
  },
  department: {
    type: String,
    enum: ['العمليات', 'الدعم الفني', 'المبيعات', 'الإدارة'],
    required: true
  },
  type: {
    type: String,
    enum: ['صبح', 'مسا', 'ليل', 'نصف شيفت'],
    required: true
  },
  status: {
    type: String,
    enum: ['مؤكد', 'معلق', 'محتاج تغطية', 'مُبدَّل'],
    default: 'مؤكد'
  },
  notes: {
    type: String,
    maxlength: 300
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual: hours duration
shiftSchema.virtual('hours').get(function () {
  const [sh, sm] = this.startTime.split(':').map(Number);
  const [eh, em] = this.endTime.split(':').map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60; // overnight shift
  return Math.round(diff / 60 * 10) / 10;
});

// Compound index: one shift per user per date+start
shiftSchema.index({ user: 1, date: 1, startTime: 1 }, { unique: true });
shiftSchema.index({ date: 1, status: 1 });

module.exports = mongoose.model('Shift', shiftSchema);
