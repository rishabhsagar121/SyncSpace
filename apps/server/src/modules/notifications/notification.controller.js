import { notificationService } from './notification.service.js';
import { catchAsync } from '../../utils/catchAsync.js';

export const notificationController = {
  list: catchAsync(async (req, res) => {
    const { unreadOnly, cursor } = req.query;
    const notifications = await notificationService.list(req.user.id, {
      unreadOnly: unreadOnly === 'true',
      cursor,
    });
    res.json({ success: true, data: { notifications } });
  }),

  unreadCount: catchAsync(async (req, res) => {
    const count = await notificationService.unreadCount(req.user.id);
    res.json({ success: true, data: { count } });
  }),

  markRead: catchAsync(async (req, res) => {
    const result = await notificationService.markRead(req.user.id, req.params.id);
    res.json({ success: true, data: result });
  }),

  markAllRead: catchAsync(async (req, res) => {
    const result = await notificationService.markAllRead(req.user.id);
    res.json({ success: true, data: result });
  }),
};