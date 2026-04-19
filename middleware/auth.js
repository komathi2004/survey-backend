const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT token
// const protect = async (req, res, next) => {
//   let token;
//   if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
//     token = req.headers.authorization.split(' ')[1];
//   }
//   if (!token) return res.status(401).json({ success: false, message: 'Not authorized, no token' });

//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     req.user = await User.findById(decoded.id).select('-password -otp -otpExpiry');
//     if (!req.user || !req.user.isActive) {
//       return res.status(401).json({ success: false, message: 'User not found or deactivated' });
//     }
//     next();
//   } catch (err) {
//     return res.status(401).json({ success: false, message: 'Token invalid or expired' });
//   }
// };
const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  // Also accept token from query param (for report downloads)
  if (!token && req.query.token) {
    token = req.query.token;
  }
  if (!token) return res.status(401).json({ success: false, message: 'Not authorized, no token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password -otp -otpExpiry');
    if (!req.user || !req.user.isActive) {
      return res.status(401).json({ success: false, message: 'User not found or deactivated' });
    }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }
};

// Role-based access
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Role '${req.user.role}' is not allowed to access this route`,
    });
  }
  next();
};

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

module.exports = { protect, authorize, generateToken };