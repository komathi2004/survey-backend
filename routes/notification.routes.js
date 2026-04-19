const router = require('express').Router();
const ctrl = require('../controllers/notification.controller');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/',              ctrl.getNotifications);
router.put('/read-all',      ctrl.markAllRead);
router.put('/:id/read',      ctrl.markRead);
router.delete('/:id',        ctrl.deleteNotification);

module.exports = router;