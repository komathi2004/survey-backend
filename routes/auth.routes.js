const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');
const { protect, authorize } = require('../middleware/auth');

router.post('/register',    protect, authorize('manager'), ctrl.register);
router.post('/login',       ctrl.login);
router.post('/send-otp',    ctrl.sendOTP);
router.post('/verify-otp',  ctrl.verifyOTP);
router.get('/me',           protect, ctrl.getMe);
router.put('/fcm-token',    protect, ctrl.updateFCMToken);
router.get('/users',        protect, authorize('manager', 'stakeholder'), ctrl.getAllUsers);
router.put('/users/:id',    protect, authorize('manager'), ctrl.updateUser);
router.post('/logout', protect, ctrl.logout);
module.exports = router;
