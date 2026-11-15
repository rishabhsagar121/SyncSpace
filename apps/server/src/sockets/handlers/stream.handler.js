import { roomRepository } from '../../modules/rooms/room.repository.js';
import { logger } from '../../config/logger.js';

const channel = (roomId) => `stream:${roomId}`;
const MAX_VIEWERS = 8;

// roomId -> { hostUserId, hostSocketId, title, kind, startedAt, viewers: Map(userId -> socketId) }
const streams = new Map();

class StreamError extends Error {}

const publicInfo = (entry) =>
  entry
    ? { hostId: entry.hostUserId, title: entry.title, kind: entry.kind, startedAt: entry.startedAt }
    : null;

async function assertMember(roomId, userId) {
  if (!roomId || typeof roomId !== 'string') throw new StreamError('Room is required.');
  const membership = await roomRepository.findMembership(roomId, userId);
  if (!membership || membership.leftAt) throw new StreamError('You are not a member of this room.');
}

function stopStream(io, roomId) {
  if (!streams.has(roomId)) return;
  streams.delete(roomId);
  io.to(channel(roomId)).emit('stream:status', { roomId, stream: null });
}

export function registerStreamHandlers(io, socket) {
  const reply = (ack, data) => typeof ack === 'function' && ack(data);
  const fail = (name, err, ack) => {
    if (!(err instanceof StreamError)) logger.error(`${name} failed: ${err.message}`);
    reply(ack, { ok: false, message: err instanceof StreamError ? err.message : 'Something went wrong.' });
  };

  // This socket stops being the streamer, or a viewer, of this room's stream
  const dropFromRoom = (roomId) => {
    const entry = streams.get(roomId);
    if (!entry) return;
    if (entry.hostSocketId === socket.id) {
      stopStream(io, roomId);
      return;
    }
    if (entry.viewers.get(socket.userId) === socket.id) {
      entry.viewers.delete(socket.userId);
      io.to(entry.hostSocketId).emit('stream:viewer-left', { roomId, viewerId: socket.userId });
    }
  };

  // Start listening for "who is streaming" in this room
  socket.on('stream:watch', async (payload, ack) => {
    try {
      const roomId = payload?.roomId;
      await assertMember(roomId, socket.userId);
      socket.join(channel(roomId));
      reply(ack, { ok: true, stream: publicInfo(streams.get(roomId)) });
    } catch (err) {
      fail('stream:watch', err, ack);
    }
  });

  socket.on('stream:unwatch', (payload) => {
    const roomId = payload?.roomId;
    if (!roomId) return;
    dropFromRoom(roomId);
    socket.leave(channel(roomId));
  });

  socket.on('stream:start', async (payload, ack) => {
    try {
      const roomId = payload?.roomId;
      await assertMember(roomId, socket.userId);

      const existing = streams.get(roomId);
      if (existing && existing.hostSocketId !== socket.id && io.sockets.sockets.has(existing.hostSocketId)) {
        throw new StreamError('Someone is already streaming in this room.');
      }

      const entry = {
        hostUserId: socket.userId,
        hostSocketId: socket.id,
        title: String(payload?.title || 'Movie').slice(0, 200),
        kind: payload?.kind === 'screen' ? 'screen' : 'file',
        startedAt: Date.now(),
        viewers: new Map(),
      };
      streams.set(roomId, entry);
      socket.join(channel(roomId));
      io.to(channel(roomId)).emit('stream:status', { roomId, stream: publicInfo(entry) });
      reply(ack, { ok: true });
    } catch (err) {
      fail('stream:start', err, ack);
    }
  });

  socket.on('stream:stop', (payload, ack) => {
    const roomId = payload?.roomId;
    const entry = streams.get(roomId);
    if (entry && entry.hostSocketId === socket.id) stopStream(io, roomId);
    reply(ack, { ok: true });
  });

  // A viewer asks to watch: the streamer is told to send them the video
  socket.on('stream:join', async (payload, ack) => {
    try {
      const roomId = payload?.roomId;
      await assertMember(roomId, socket.userId);
      if (!socket.rooms.has(channel(roomId))) socket.join(channel(roomId));

      const entry = streams.get(roomId);
      if (!entry) throw new StreamError('Nobody is streaming right now.');
      if (entry.hostUserId === socket.userId) throw new StreamError('You are the one streaming.');
      if (!entry.viewers.has(socket.userId) && entry.viewers.size >= MAX_VIEWERS) {
        throw new StreamError(`The stream is full (${MAX_VIEWERS} viewers).`);
      }

      entry.viewers.set(socket.userId, socket.id);
      io.to(entry.hostSocketId).emit('stream:viewer-joined', { roomId, viewerId: socket.userId });
      reply(ack, { ok: true });
    } catch (err) {
      fail('stream:join', err, ack);
    }
  });

  socket.on('stream:leave-view', (payload) => {
    if (payload?.roomId) dropFromRoom(payload.roomId);
  });

  // Connection setup messages go only between the streamer and one viewer
  const relay = (event, field) => {
    socket.on(event, (payload) => {
      try {
        const roomId = payload?.roomId;
        const toUserId = payload?.toUserId;
        const data = payload?.[field];
        const entry = streams.get(roomId);
        if (!entry || !toUserId || data == null) return;

        let targetSocketId = null;
        if (socket.id === entry.hostSocketId) {
          targetSocketId = entry.viewers.get(toUserId);
        } else if (entry.viewers.get(socket.userId) === socket.id && toUserId === entry.hostUserId) {
          targetSocketId = entry.hostSocketId;
        }
        if (!targetSocketId) return;

        io.to(targetSocketId).emit(event, { roomId, fromUserId: socket.userId, [field]: data });
      } catch (err) {
        logger.error(`${event} relay failed: ${err.message}`);
      }
    });
  };
  relay('stream:offer', 'offer');
  relay('stream:answer', 'answer');
  relay('stream:ice', 'candidate');

  socket.on('disconnecting', () => {
    [...streams.keys()].forEach(dropFromRoom);
  });
}

// Someone who leaves or is kicked stops streaming or watching
export function bridgeStreamDomainEvents(io, domainEvents) {
  const remove = ({ roomId, userId }) => {
    const entry = streams.get(roomId);
    if (entry) {
      if (entry.hostUserId === userId) {
        stopStream(io, roomId);
      } else if (entry.viewers.has(userId)) {
        entry.viewers.delete(userId);
        io.to(entry.hostSocketId).emit('stream:viewer-left', { roomId, viewerId: userId });
      }
    }
    io.in(`user:${userId}`).socketsLeave(channel(roomId));
  };
  domainEvents.on('room:member-left', remove);
  domainEvents.on('room:member-kicked', remove);
}