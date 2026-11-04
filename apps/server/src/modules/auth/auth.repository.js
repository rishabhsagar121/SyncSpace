import { prisma } from '../../config/prisma.js';

export const authRepository = {
  findByEmail: (email) => prisma.user.findFirst({ where: { email, deletedAt: null } }),

  findByUsername: (username) =>
    prisma.user.findFirst({ where: { username, deletedAt: null } }),

  findByIdentifier: (identifier) =>
    prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [{ email: identifier }, { username: identifier }],
      },
      include: { profile: true },
    }),

  createUser: ({ username, email, passwordHash }) =>
    prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        profile: { create: {} },
      },
      include: { profile: true },
    }),

  createSession: ({ userId, refreshToken, expiresAt, userAgent, ipAddress, deviceLabel }) =>
    prisma.session.create({
      data: { userId, refreshToken, expiresAt, userAgent, ipAddress, deviceLabel },
    }),

  findValidSessionByToken: (refreshToken) =>
    prisma.session.findFirst({
      where: { refreshToken, revokedAt: null, expiresAt: { gt: new Date() } },
    }),

  revokeSessionByToken: (refreshToken) =>
    prisma.session.updateMany({
      where: { refreshToken },
      data: { revokedAt: new Date() },
    }),

  rotateSessionToken: (sessionId, newRefreshToken, newExpiresAt) =>
    prisma.session.update({
      where: { id: sessionId },
      data: { refreshToken: newRefreshToken, expiresAt: newExpiresAt },
    }),
};