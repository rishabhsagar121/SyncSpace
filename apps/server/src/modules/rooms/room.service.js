import { roomRepository } from './room.repository.js';
import { hashPassword, comparePassword } from '../../utils/password.js';
import { AppError } from '../../utils/AppError.js';
import { domainEvents } from '../../utils/domainEvents.js';

function assertHostOrCoHost(membership) {
  if (!membership || (membership.role !== 'HOST' && membership.role !== 'CO_HOST')) {
    throw AppError.forbidden('Only the host or co-host can do this');
  }
}

function assertHost(membership) {
  if (!membership || membership.role !== 'HOST') {
    throw AppError.forbidden('Only the host can do this');
  }
}

export const roomService = {
  async create(hostId, { name, visibility, password, mode }) {
    const passwordHash = visibility === 'PASSWORD_PROTECTED' && password ? await hashPassword(password) : null;
    const room = await roomRepository.create({ name, hostId, visibility, passwordHash, mode });
    return room;
  },

  async getRoom(roomId, userId) {
    const room = await roomRepository.findById(roomId);
    if (!room) throw AppError.notFound('Room not found');

    const isMember = room.members.some((m) => m.userId === userId);
    if (room.visibility !== 'PUBLIC' && !isMember) {
      throw AppError.forbidden('You do not have access to this room');
    }
    return room;
  },

  async joinByCode(code, userId, password) {
    const room = await roomRepository.findByCode(code);
    if (!room) throw AppError.notFound('Invalid room code');

    if (room.visibility === 'PASSWORD_PROTECTED') {
      const valid = await comparePassword(password, room.passwordHash);
      if (!valid) throw AppError.unauthorized('Incorrect room password');
    }

    const existing = await roomRepository.findMembership(room.id, userId);
    if (existing && !existing.leftAt) return roomRepository.findById(room.id);

    if (existing?.leftAt) {
      await roomRepository.reactivateMember(existing.id);
    } else {
      await roomRepository.addMember(room.id, userId);
    }

    const full = await roomRepository.findById(room.id);
    domainEvents.emit('room:member-joined', { roomId: room.id, userId });
    return full;
  },

  async leave(roomId, userId) {
    const membership = await roomRepository.findMembership(roomId, userId);
    if (!membership || membership.leftAt) throw AppError.notFound('Not a member of this room');

    await roomRepository.removeMember(roomId, userId);

    // If the host leaves, auto-promote the longest-standing co-host/member
    if (membership.role === 'HOST') {
      const room = await roomRepository.findById(roomId);
      const nextHost = room.members.find((m) => m.userId !== userId);
      if (nextHost) await roomRepository.setMemberRole(roomId, nextHost.userId, 'HOST');
      else await roomRepository.softDelete(roomId); // room empty
    }

    domainEvents.emit('room:member-left', { roomId, userId });
    return { left: true };
  },

  async kick(roomId, actingUserId, targetUserId) {
    const membership = await roomRepository.findMembership(roomId, actingUserId);
    assertHostOrCoHost(membership);
    if (actingUserId === targetUserId) throw AppError.badRequest("You can't kick yourself");

    await roomRepository.removeMember(roomId, targetUserId);
    domainEvents.emit('room:member-kicked', { roomId, userId: targetUserId, byUserId: actingUserId });
    return { kicked: true };
  },

  async mute(roomId, actingUserId, targetUserId, isMuted) {
    const membership = await roomRepository.findMembership(roomId, actingUserId);
    assertHostOrCoHost(membership);

    await roomRepository.setMemberMuted(roomId, targetUserId, isMuted);
    domainEvents.emit('room:member-muted', { roomId, userId: targetUserId, isMuted });
    return { isMuted };
  },

  async transferHost(roomId, currentHostId, newHostId) {
    const membership = await roomRepository.findMembership(roomId, currentHostId);
    assertHost(membership);

    const targetMembership = await roomRepository.findMembership(roomId, newHostId);
    if (!targetMembership || targetMembership.leftAt) throw AppError.notFound('User is not a room member');

    await roomRepository.setMemberRole(roomId, currentHostId, 'MEMBER');
    await roomRepository.setMemberRole(roomId, newHostId, 'HOST');

    domainEvents.emit('room:host-transferred', { roomId, newHostId });
    return { newHostId };
  },

  async updateSettings(roomId, actingUserId, settings) {
    const membership = await roomRepository.findMembership(roomId, actingUserId);
    assertHostOrCoHost(membership);
    return roomRepository.updateSettings(roomId, settings);
  },

  async updateMode(roomId, actingUserId, mode) {
    const membership = await roomRepository.findMembership(roomId, actingUserId);
    assertHostOrCoHost(membership);
    return roomRepository.updateRoom(roomId, { mode });
  },

  async delete(roomId, actingUserId) {
    const membership = await roomRepository.findMembership(roomId, actingUserId);
    assertHost(membership);
    await roomRepository.softDelete(roomId);
    domainEvents.emit('room:deleted', { roomId });
    return { deleted: true };
  },

  async listMyRooms(userId) {
    return roomRepository.listForUser(userId);
  },
};