const mongoose = require('mongoose');

const swapRequestSchema = new mongoose.Schema({
  // Who is offering their shift
  requester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  requesterShift: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shift',
    required: true
  },

  // Who accepted (filled after someone accepts)
  acceptor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // Partial swap: only part of the shift
  isPartial: {
    type: Boolean,
    default: false
  },
  partialStart: { type: String, default: null }, // "08:00"
  partialEnd:   { type: String, default: null }, // "12:00"

  // Why they need a swap
  reason: {
    type: String,
    maxlength: 500
  },

  // Available times they can cover in return
  availableTimes: {
    type: String,
    maxlength: 300
  },

  urgency: {
    type: String,
    enum: ['عادية', 'متوسطة', 'عاجلة'],
    default: 'عادية'
  },

  // Lifecycle status
  status: {
    type: String,
    enum: [
      'مفتوح',          // visible to team, no acceptor yet
      'مقبول',          // someone accepted, awaiting manager
      'موافق عليه',     // manager approved  ✓
      'مرفوض',          // manager rejected  ✗
      'منسحب',          // requester withdrew
      'منتهي'           // expired (no takers)
    ],
    default: 'مفتوح'
  },

  // Manager decision
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reviewedAt: { type: Date, default: null },
  reviewNote:  { type: String, default: '' },

  // Auto-expire after 72 hours if still open
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 72 * 60 * 60 * 1000)
  }
}, {
  timestamps: true
});

swapRequestSchema.index({ status: 1, createdAt: -1 });
swapRequestSchema.index({ requester: 1 });
swapRequestSchema.index({ acceptor: 1 });

module.exports = mongoose.model('SwapRequest', swapRequestSchema);
