const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  siteEngineer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Worker being marked (field worker, not app user)
  workerName: { type: String, required: true, trim: true },
  workerId: { type: String, required: true, trim: true },

  date: { type: String, required: true }, // "YYYY-MM-DD"
  checkInTime: { type: Date },
  checkOutTime: { type: Date },

  checkInLocation: {
    latitude: { type: Number },
    longitude: { type: Number },
    address: String,
  },
  checkOutLocation: {
    latitude: Number,
    longitude: Number,
    address: String,
  },

  siteLocation: { type: String }, // site name / address
  status: {
    type: String,
    enum: ['present', 'absent', 'half_day', 'on_leave'],
    default: 'present',
  },
  notes: { type: String },
}, { timestamps: true });

// Prevent duplicate check-in per worker per date
attendanceSchema.index({ workerId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);