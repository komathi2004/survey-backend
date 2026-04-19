const mongoose = require('mongoose');

const surveySchema = new mongoose.Schema({
  surveyId: { type: String, unique: true },
  lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
  assignedSurveyor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  scheduledDate: { type: Date, required: true },
  scheduledTime: { type: String }, // "10:00 AM"

  status: {
    type: String,
    enum: ['scheduled', 'in_progress', 'completed', 'work_not_completed', 'dispute', 'out_of_scope', 'reassigned', 'cancelled'],
    default: 'scheduled',
  },

  // Disposition set by surveyor
  disposition: {
    type: String,
    enum: ['work_completed', 'work_not_completed', 'dispute', 'out_of_scope'],
  },
  dispositionNotes: { type: String },

  // Dispute details
  disputeReason: {
    type: String,
    enum: ['access_denied', 'ownership_issue', 'site_mismatch', 'customer_unavailable', 'other'],
  },
  disputeDetails: { type: String },

  // Out of scope details
  outOfScopeDetails: { type: String },

  // Site images uploaded by surveyor
  images: [{ type: String }], // file paths

  // Geolocation at survey start and completion
  startLocation: {
    latitude: Number,
    longitude: Number,
    capturedAt: Date,
  },
  completionLocation: {
    latitude: Number,
    longitude: Number,
    capturedAt: Date,
  },

  startedAt: { type: Date },
  completedAt: { type: Date },

  // SMS sent to customer
  customerSmsStatus: { type: String, enum: ['sent', 'failed', 'pending'], default: 'pending' },
  customerSmsSentAt: { type: Date },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reassignedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // previous surveyor if reassigned
  reassignedAt: { type: Date },
}, { timestamps: true });

surveySchema.pre('save', async function (next) {
  if (!this.surveyId) {
    const count = await mongoose.model('Survey').countDocuments();
    this.surveyId = `SRV-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Survey', surveySchema);