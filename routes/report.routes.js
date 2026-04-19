const router = require('express').Router();
const ctrl = require('../controllers/report.controller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('manager', 'stakeholder'));

// ?format=excel  OR  ?format=pdf
// Optional query filters: from, to, status, disposition, surveyorId

router.get('/survey-status',        ctrl.surveyStatusReport);
router.get('/surveyor-performance', ctrl.surveyorPerformanceReport);
router.get('/disputes',             ctrl.disputeReport);
router.get('/out-of-scope',         ctrl.outOfScopeReport);
router.get('/attendance',           ctrl.attendanceReport);
router.get('/engineer-activity',    ctrl.engineerActivityReport);

module.exports = router;