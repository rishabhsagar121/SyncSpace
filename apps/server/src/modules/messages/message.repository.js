import { prisma } from '../../config/prisma.js';

export const messageRepository = {
  create: (data) =>
    prisma.message.create({
      data,
      include: { sender: { select: { id: true, username: true, profile: true } } },
    }),

  findById: (id) => prisma.message.findUnique({ where: { id } }),

  listByRoom: (roomId, { take = 30, cursor } = {}) =>
    prisma.message.findMany({
      where: { roomId, deletedAt: null },
      include: {
        sender: { select: { id: true, username: true, profile: true } },
        reactions: true,
        replyTo: { select: { id: true, content: true, senderId: true } },
      },
      orderBy: { createdAt: 'desc' },
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    }),

  softDelete: (id, senderId) =>
    prisma.message.updateMany({ where: { id, senderId }, data: { deletedAt: new Date(), content: null } }),

  edit: (id, senderId, content) =>
    prisma.message.updateMany({ where: { id, senderId }, data: { content, editedAt: new Date() } }),

  addReaction: (messageId, userId, emoji) =>
    prisma.messageReaction.upsert({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
      create: { messageId, userId, emoji },
      update: {},
    }),

  removeReaction: (messageId, userId, emoji) =>
    prisma.messageReaction.deleteMany({ where: { messageId, userId, emoji } }),
};