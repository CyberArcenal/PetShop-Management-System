const { Router } = require('express');
const NotificationLogController = require('../controllers/notificationLog.controller');
const { authenticateToken } = require('../../middlewares/auth.middleware');

const router = Router();

router.use(authenticateToken);
// optionally add admin-only check

router.get('/', NotificationLogController.getAll);
router.get('/search', NotificationLogController.search);
router.get('/stats', NotificationLogController.getStats);
router.get('/recipient/:email', NotificationLogController.getByRecipient);
router.get('/:id', NotificationLogController.getById);
router.delete('/:id', NotificationLogController.delete);
router.post('/:id/retry', NotificationLogController.retry);
router.post('/:id/resend', NotificationLogController.resend);

module.exports = router;