const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  leadId: { type: String, unique: true }, // auto-generated
  customerName: { type: String, required: true, trim: true },
  customerContact: { type: String, required: true, trim: true },
  customerEmail: { type: String, trim: true },
  address: { type: String, required: true },
  location: {
    latitude: Number,
    longitude: Number,
  },
  leadSource: {
    type: String,
    enum: ['manual', 'import', 'website', 'referral', 'other'],
    default: 'manual',
  },
  surveyType: { type: String, trim: true }, // e.g., "Structural", "Electrical"
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  },
  status: {
    type: String,
    enum: ['new', 'assigned', 'in_progress', 'completed', 'dispute', 'out_of_scope', 'cancelled'],
    default: 'new',
  },
  assignedSurveyor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedAt: { type: Date },

  notes: { type: String },
  importBatch: { type: String }, // for bulk-imported leads

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

// Auto-generate leadId before save
leadSchema.pre('save', async function (next) {
  if (!this.leadId) {
    const count = await mongoose.model('Lead').countDocuments();
    this.leadId = `LEAD-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Lead', leadSchema);