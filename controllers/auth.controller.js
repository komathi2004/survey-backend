const User = require('../models/User');
const { generateToken } = require('../middleware/auth');
const logGeo = require('../utils/geoLogger');
const sendSMS = require('../utils/sendSMS');

// POST /api/auth/register  (Manager only creates users)
exports.register = async (req, res) => {
  try {
    const { name, email, mobile, password, role, employeeId } = req.body;
    if (!name || !role) return res.status(400).json({ success: false, message: 'Name and role are required' });

    const exists = await User.findOne({ $or: [{ email }, { mobile }] });
    if (exists) return res.status(400).json({ success: false, message: 'User already exists' });

    const user = await User.create({ name, email, mobile, password, role, employeeId, createdBy: req.user._id });
    res.status(201).json({ success: true, message: 'User created', data: { _id: user._id, name: user.name, role: user.role } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/auth/login  (password-based)
exports.login = async (req, res) => {
  try {
    const { email, mobile, password, latitude, longitude } = req.body;
    if (!password) return res.status(400).json({ success: false, message: 'Password is required' });

    const user = await User.findOne(email ? { email } : { mobile });
    if (!user || !user.isActive) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const match = await user.matchPassword(password);
    if (!match) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    // Capture geolocation
    if (latitude && longitude) {
      user.lastLoginLocation = { latitude, longitude, capturedAt: new Date() };
      await user.save();
      await logGeo({ userId: user._id, event: 'login', latitude, longitude });
    }

    const token = generateToken(user._id);
    res.json({ success: true, token, data: { _id: user._id, name: user.name, role: user.role, email: user.email, mobile: user.mobile } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/auth/send-otp
exports.sendOTP = async (req, res) => {
  try {
    const { mobile } = req.body;
    if (!mobile) return res.status(400).json({ success: false, message: 'Mobile required' });

    const user = await User.findOne({ mobile });
    if (!user || !user.isActive) return res.status(404).json({ success: false, message: 'User not found' });

    const otp = user.generateOTP();
    await user.save();

    await sendSMS(mobile, `Your OTP is ${otp}. Valid for 10 minutes.`);
    res.json({ success: true, message: 'OTP sent' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/auth/verify-otp
exports.verifyOTP = async (req, res) => {
  try {
    const { mobile, otp, latitude, longitude } = req.body;
    const user = await User.findOne({ mobile });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.otp !== otp || user.otpExpiry < new Date()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    user.otp = undefined;
    user.otpExpiry = undefined;
    if (latitude && longitude) {
      user.lastLoginLocation = { latitude, longitude, capturedAt: new Date() };
      await logGeo({ userId: user._id, event: 'login', latitude, longitude });
    }
    await user.save();

    const token = generateToken(user._id);
    res.json({ success: true, token, data: { _id: user._id, name: user.name, role: user.role } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  res.json({ success: true, data: req.user });
};

// GET /api/auth/users  (Manager: list all users)
exports.getAllUsers = async (req, res) => {
  try {
    const { role, isActive } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    const users = await User.find(filter).select('-password -otp -otpExpiry').sort('-createdAt');
    res.json({ success: true, count: users.length, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/auth/users/:id  (Manager: update/deactivate user)
exports.updateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-password -otp');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/auth/fcm-token
exports.updateFCMToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;
    await User.findByIdAndUpdate(req.user._id, { fcmToken });
    res.json({ success: true, message: 'FCM token updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
// POST /api/auth/logout
exports.logout = async (req, res) => {
  try {
    // Clear FCM token on logout so no push notifications are sent
    await User.findByIdAndUpdate(req.user._id, { fcmToken: null });
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};