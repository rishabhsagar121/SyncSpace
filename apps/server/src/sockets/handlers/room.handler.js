import { SOCKET_EVENTS } from '../../../../../packages/shared/constants/socketEvents.js';
import { roomRepository } from '../../modules/rooms/room.repository.js';
import { redisClient } from '../../config/redis.js';
import { logger } from '../../config/logger.js';

const roomChannel = (roomId) => `room:${roomId}`;
const userChannel = (userId) => `user:${userId}`;
const onlineKey = (roomId) => `room:${roomId}:online`;

export function registerRoomHandlers(io, socket) {
  socket.on(SOCKET_EVENTS.ROOM_JOIN, async ({ roomId } = {}, ack) => {
    try {
      const membership = roomId && (await roomRepository.findMembership(roomId, socket.userId));
      if (!membership || membership.leftAt) {
        const error = 'Not a member of this room';
        socket.emit(SOCKET_EVENTS.ROOM_ERROR, { roomId, message: error });
        return ack?.({ ok: false, error });
      }

      socket.join(roomChannel(roomId));
      socket.data.roomId = roomId;
      await redisClient.sAdd(onlineKey(roomId), socket.userId);

      socket.to(roomChannel(roomId)).emit(SOCKET_EVENTS.ROOM_MEMBER_JOINED, {
        roomId,
        userId: socket.userId,
      });

      ack?.({
        ok: true,
        role: membership.role,
        onlineMemberIds: await redisClient.sMembers(onlineKey(roomId)),
      });
    } catch (err) {
      logger.error(`ROOM_JOIN failed: ${err.message}`);
      socket.emit(SOCKET_EVENTS.ROOM_ERROR, { roomId, message: 'Failed to join room' });
      ack?.({ ok: false, error: 'Failed to join room' });
    }
  });

  const leave = async (roomId) => {
    socket.leave(roomChannel(roomId));
    await redisClient.sRem(onlineKey(roomId), socket.userId);
    socket.data.roomId = null;
    io.to(roomChannel(roomId)).emit(SOCKET_EVENTS.ROOM_MEMBER_LEFT, { roomId, userId: socket.userId });
  };

  socket.on(SOCKET_EVENTS.ROOM_LEAVE, ({ roomId } = {}) => {
    if (roomId) leave(roomId).catch((err) => logger.error(`ROOM_LEAVE failed: ${err.message}`));
  });

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (roomId) leave(roomId).catch((err) => logger.error(`disconnect cleanup failed: ${err.message}`));
  });
}

// Turns REST-side actions (kick, mute, transfer host, delete) into live socket pushes.
export function bridgeRoomDomainEvents(io, domainEvents) {
  domainEvents.on('room:member-joined', ({ roomId, userId }) => {
    io.to(roomChannel(roomId)).emit(SOCKET_EVENTS.ROOM_MEMBER_JOINED, { roomId, userId });
  });

  domainEvents.on('room:member-left', ({ roomId, userId }) => {
    io.to(roomChannel(roomId)).emit(SOCKET_EVENTS.ROOM_MEMBER_LEFT, { roomId, userId });
  });

  domainEvents.on('room:member-kicked', ({ roomId, userId, byUserId }) => {
    io.to(userChannel(userId)).emit(SOCKET_EVENTS.ROOM_MEMBER_KICKED, { roomId, byUserId });
    io.in(userChannel(userId)).socketsLeave(roomChannel(roomId)); // stop their live updates
    io.to(roomChannel(roomId)).emit(SOCKET_EVENTS.ROOM_MEMBER_LEFT, { roomId, userId });
  });

  domainEvents.on('room:member-muted', ({ roomId, userId, isMuted }) => {
    io.to(roomChannel(roomId)).emit(SOCKET_EVENTS.ROOM_MEMBER_MUTED, { roomId, userId, isMuted });
  });

  domainEvents.on('room:host-transferred', ({ roomId, newHostId }) => {
    io.to(roomChannel(roomId)).emit(SOCKET_EVENTS.ROOM_HOST_TRANSFERRED, { roomId, newHostId });
  });

  domainEvents.on('room:deleted', ({ roomId }) => {
    io.to(roomChannel(roomId)).emit(SOCKET_EVENTS.ROOM_DELETED, { roomId });
  });
}