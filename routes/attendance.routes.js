const router = require('express').Router();
const ctrl = require('../controllers/attendance.controller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/',               authorize('manager', 'stakeholder', 'site_engineer'), ctrl.getAttendance);
router.post('/checkin',       authorize('site_engineer'), ctrl.checkIn);
router.put('/:id/checkout',   authorize('site_engineer'), ctrl.checkOut);
router.put('/:id',            authorize('manager', 'site_engineer'), ctrl.updateAttendance);
router.post('/swap-engineer', authorize('manager'), ctrl.swapEngineer);

module.exports = router;