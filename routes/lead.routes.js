const router = require('express').Router();
const ctrl = require('../controllers/lead.controller');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

// All routes require auth
router.use(protect);

router.get('/',             ctrl.getLeads);
router.get('/:id',          ctrl.getLead);
router.post('/',            authorize('manager'), ctrl.createLead);
router.put('/:id',          authorize('manager'), ctrl.updateLead);
router.delete('/:id',       authorize('manager'), ctrl.deleteLead);
router.post('/:id/assign',  authorize('manager'), ctrl.assignLead);

// Bulk import via Excel upload
router.post('/import/excel',
  authorize('manager'),
  upload.single('file'),
  ctrl.importLeads
);

module.exports = router;