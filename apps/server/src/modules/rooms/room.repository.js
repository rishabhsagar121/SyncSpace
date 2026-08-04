import { prisma } from '../../config/prisma.js';

export const roomRepository = {
  create: (data) =>
    prisma.room.create({
      data: {
        ...data,
        members: { create: { userId: data.hostId, role: 'HOST' } },
        settings: { create: {} },
      },
      include: { members: true, settings: true },
    }),

  findById: (id) =>
    prisma.room.findFirst({
      where: { id, deletedAt: null },
      include: {
        members: { where: { leftAt: null }, include: { user: { select: { id: true, username: true, profile: true } } } },
        settings: true,
        host: { select: { id: true, username: true } },
      },
    }),

  findByCode: (code) =>
    prisma.room.findFirst({ where: { code, deletedAt: null }, include: { settings: true } }),

  findMembership: (roomId, userId) =>
    prisma.roomMember.findUnique({ where: { roomId_userId: { roomId, userId } } }),

  addMember: (roomId, userId) =>
    prisma.roomMember.create({ data: { roomId, userId, role: 'MEMBER' } }),

  reactivateMember: (id) =>
    prisma.roomMember.update({ where: { id }, data: { leftAt: null } }),

  removeMember: (roomId, userId) =>
    prisma.roomMember.update({
      where: { roomId_userId: { roomId, userId } },
      data: { leftAt: new Date() },
    }),

  setMemberRole: (roomId, userId, role) =>
    prisma.roomMember.update({ where: { roomId_userId: { roomId, userId } }, data: { role } }),

  setMemberMuted: (roomId, userId, isMuted) =>
    prisma.roomMember.update({ where: { roomId_userId: { roomId, userId } }, data: { isMuted } }),

  updateSettings: (roomId, data) =>
    prisma.roomSettings.update({ where: { roomId }, data }),

  updateRoom: (roomId, data) => prisma.room.update({ where: { id: roomId }, data }),

  softDelete: (roomId) =>
    prisma.room.update({ where: { id: roomId }, data: { deletedAt: new Date() } }),

  listForUser: (userId) =>
    prisma.room.findMany({
      where: { deletedAt: null, members: { some: { userId, leftAt: null } } },
      include: { host: { select: { id: true, username: true } }, _count: { select: { members: true } } },
      orderBy: { updatedAt: 'desc' },
    }),
};