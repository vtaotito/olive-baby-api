// Olive Baby API - Notification Routes
import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validateQuery } from '../middlewares/validation.middleware';
import { listNotificationsSchema } from '../controllers/notification.controller';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// GET /notifications - List notifications
router.get('/', validateQuery(listNotificationsSchema), NotificationController.listNotifications);

// GET /notifications/count - Get unread count
router.get('/count', NotificationController.getUnreadCount);

// POST /notifications/read-all - Mark all as read
router.post('/read-all', NotificationController.markAllAsRead);

// POST /notifications/:id/read - Mark as read
router.post('/:id/read', NotificationController.markAsRead);

// POST /notifications/:id/archive - Archive notification
router.post('/:id/archive', NotificationController.archive);

// DELETE /notifications/:id - Delete notification
router.delete('/:id', NotificationController.delete);

export default router;
