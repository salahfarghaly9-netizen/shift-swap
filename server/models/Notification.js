const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['swap_new', 'swap_accepted', 'swap_approved', 'swap_rejected', 'swap_withdrawn'],
    required: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  relatedSwap: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SwapRequest',
    default: null
  },
  isRead: { type: Boolean, default: false }
}, {
  timestamps: true
});

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
