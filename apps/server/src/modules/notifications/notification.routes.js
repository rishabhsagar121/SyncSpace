import { Router } from 'express';
import { notificationController } from './notification.controller.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';

const router = Router();
router.use(authMiddleware);

router.get('/', notificationController.list);
router.get('/unread-count', notificationController.unreadCount);
router.patch('/:id/read', notificationController.markRead);
router.patch('/read-all', notificationController.markAllRead);

export default router;