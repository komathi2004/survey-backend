const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: {
    type: String,
    enum: [
      'survey_assigned',
      'survey_reassigned',
      'survey_completed',
      'dispute_flagged',
      'out_of_scope_flagged',
      'engineer_swapped',
      'general',
    ],
    default: 'general',
  },
  referenceId: { type: mongoose.Schema.Types.ObjectId }, // survey or lead _id
  referenceModel: { type: String, enum: ['Survey', 'Lead', 'Attendance'] },
  isRead: { type: Boolean, default: false },
  readAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);