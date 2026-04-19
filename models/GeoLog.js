const mongoose = require('mongoose');

const geoLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  event: {
    type: String,
    enum: ['login', 'survey_start', 'survey_complete', 'attendance_checkin', 'attendance_checkout'],
    required: true,
  },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  address: { type: String },
  referenceId: { type: mongoose.Schema.Types.ObjectId }, // survey or attendance _id
  capturedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('GeoLog', geoLogSchema);