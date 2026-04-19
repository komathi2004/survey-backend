const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  mobile: { type: String, unique: true, sparse: true, trim: true },
  password: { type: String },
  role: {
    type: String,
    enum: ['manager', 'surveyor', 'site_engineer', 'stakeholder'],
    required: true,
  },
  employeeId: { type: String, unique: true, sparse: true },
  isActive: { type: Boolean, default: true },

  // OTP fields
  otp: { type: String },
  otpExpiry: { type: Date },

  // Geolocation at last login
  lastLoginLocation: {
    latitude: Number,
    longitude: Number,
    address: String,
    capturedAt: Date,
  },

  // FCM token for push notifications
  fcmToken: { type: String },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

userSchema.methods.generateOTP = function () {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.otp = otp;
  this.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
  return otp;
};

module.exports = mongoose.model('User', userSchema);