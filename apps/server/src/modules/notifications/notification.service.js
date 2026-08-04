import { notificationRepository } from './notification.repository.js';
import { domainEvents } from '../../utils/domainEvents.js';
import { AppError } from '../../utils/AppError.js';

export const notificationService = {
  async create(userId, type, payload) {
    const notification = await notificationRepository.create(userId, type, payload);
    domainEvents.emit('notification:created', { userId, notification });
    return notification;
  },

  async list(userId, opts) {
    return notificationRepository.listForUser(userId, opts);
  },

  async markRead(userId, notificationId) {
    const result = await notificationRepository.markRead(notificationId, userId);
    if (result.count === 0) throw AppError.notFound('Notification not found');
    return { read: true };
  },

  async markAllRead(userId) {
    await notificationRepository.markAllRead(userId);
    return { read: true };
  },

  async unreadCount(userId) {
    return notificationRepository.countUnread(userId);
  },
};