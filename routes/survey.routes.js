const router = require('express').Router();
const ctrl = require('../controllers/survey.controller');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(protect);

router.get('/',    ctrl.getSurveys);
router.get('/:id', ctrl.getSurvey);

router.post('/',
  authorize('manager'),
  ctrl.scheduleSurvey
);

// Surveyor: start survey
router.put('/:id/start',
  authorize('surveyor'),
  ctrl.startSurvey
);

// Surveyor: submit with disposition + images
router.put('/:id/submit',
  authorize('surveyor'),
  upload.array('images', 10),
  ctrl.submitSurvey
);

// Manager: reassign survey to different surveyor
router.put('/:id/reassign',
  authorize('manager'),
  ctrl.reassignSurvey
);

module.exports = router;