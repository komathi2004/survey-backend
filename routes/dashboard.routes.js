const router = require('express').Router();
const ctrl = require('../controllers/dashboard.controller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/manager',     authorize('manager'), ctrl.managerDashboard);
router.get('/stakeholder', authorize('manager', 'stakeholder'), ctrl.stakeholderDashboard);
router.get('/surveyor',    authorize('surveyor'), ctrl.surveyorDashboard);

module.exports = router;