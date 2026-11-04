import { prisma } from '../../config/prisma.js';

const SAFE_USER_SELECT = {
  id: true,
  username: true,
  email: true,
  presenceStatus: true,
  lastSeenAt: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  profile: true,
};

export const userRepository = {
  findById: (id) =>
    prisma.user.findUnique({ where: { id }, select: SAFE_USER_SELECT }),

  searchByUsername: (query, excludeUserId) =>
    prisma.user.findMany({
      where: {
        username: { contains: query, mode: 'insensitive' },
        id: { not: excludeUserId },
        deletedAt: null,
      },
      select: { id: true, username: true, profile: true, presenceStatus: true },
      take: 20,
    }),

  updateProfile: (userId, data) =>
    prisma.profile.update({ where: { userId }, data }),

  updateAvatar: (userId, avatarUrl) =>
    prisma.profile.update({ where: { userId }, data: { avatarUrl } }),

  updatePrivacy: (userId, privacy) =>
    prisma.profile.update({ where: { userId }, data: { privacy } }),

  softDelete: (userId) =>
    prisma.user.update({ where: { id: userId }, data: { deletedAt: new Date() } }),

  listSessions: (userId) =>
    prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, userAgent: true, ipAddress: true, createdAt: true, deviceLabel: true },
      orderBy: { createdAt: 'desc' },
    }),

  revokeSessionForUser: (userId, sessionId) =>
    prisma.session.updateMany({
      where: { id: sessionId, userId },
      data: { revokedAt: new Date() },
    }),
};