import { prisma } from '../../config/prisma.js';

export const notificationRepository = {
  create: (userId, type, payload) =>
    prisma.notification.create({ data: { userId, type, payload } }),

  listForUser: (userId, { unreadOnly = false, take = 30, cursor } = {}) =>
    prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { isRead: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    }),

  markRead: (id, userId) =>
    prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true } }),

  markAllRead: (userId) =>
    prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } }),

  countUnread: (userId) =>
    prisma.notification.count({ where: { userId, isRead: false } }),
};