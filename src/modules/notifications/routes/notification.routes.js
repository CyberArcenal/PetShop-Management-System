const { Router } = require('express');
const NotificationController = require('../controllers/notification.controller');
const { authenticateToken } = require('../../middlewares/auth.middleware');

const router = Router();

router.use(authenticateToken); // lahat ng routes dito ay protected

router.get('/', NotificationController.getAll);
router.get('/stats', NotificationController.getStats);
router.get('/unread-count', NotificationController.getUnreadCount);
router.get('/:id', NotificationController.getById);
router.post('/', NotificationController.create);
router.patch('/:id/read', NotificationController.markAsRead);
router.post('/mark-all-read', NotificationController.markAllAsRead);
router.delete('/:id', NotificationController.delete);

module.exports = router;