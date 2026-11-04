import { SOCKET_EVENTS } from '../../../../../packages/shared/constants/socketEvents.js';

function roomChannel(roomId) {
  return `room:${roomId}`;
}

// In-memory cache of playback state per room so reloads/late-joiners never lose the video
const roomSyncStates = new Map();

export function registerSyncHandlers(io, socket) {
  socket.on(SOCKET_EVENTS.SYNC_PLAY, ({ roomId, positionMs }) => {
    const existing = roomSyncStates.get(roomId) || {};
    roomSyncStates.set(roomId, { ...existing, playing: true, positionMs, updatedAt: Date.now() });

    socket.to(roomChannel(roomId)).emit(SOCKET_EVENTS.SYNC_PLAY, {
      positionMs,
      byUserId: socket.userId,
    });
  });

  socket.on(SOCKET_EVENTS.SYNC_PAUSE, ({ roomId, positionMs }) => {
    const existing = roomSyncStates.get(roomId) || {};
    roomSyncStates.set(roomId, { ...existing, playing: false, positionMs, updatedAt: Date.now() });

    socket.to(roomChannel(roomId)).emit(SOCKET_EVENTS.SYNC_PAUSE, {
      positionMs,
      byUserId: socket.userId,
    });
  });

  socket.on(SOCKET_EVENTS.SYNC_SEEK, ({ roomId, positionMs }) => {
    const existing = roomSyncStates.get(roomId) || {};
    roomSyncStates.set(roomId, { ...existing, positionMs, updatedAt: Date.now() });

    socket.to(roomChannel(roomId)).emit(SOCKET_EVENTS.SYNC_SEEK, {
      positionMs,
      byUserId: socket.userId,
    });
  });

  socket.on(SOCKET_EVENTS.SYNC_SOURCE_CHANGE, ({ roomId, source }) => {
    const existing = roomSyncStates.get(roomId) || {};
    roomSyncStates.set(roomId, { ...existing, source, positionMs: 0, playing: true, updatedAt: Date.now() });

    socket.to(roomChannel(roomId)).emit(SOCKET_EVENTS.SYNC_SOURCE_CHANGE, {
      source,
      byUserId: socket.userId,
    });
  });

  socket.on(SOCKET_EVENTS.SYNC_QUEUE_UPDATE, ({ roomId, queue }) => {
    socket.to(roomChannel(roomId)).emit(SOCKET_EVENTS.SYNC_QUEUE_UPDATE, { queue });
  });

  // A late joiner or refreshed page asks the room for current playback state
  socket.on(SOCKET_EVENTS.SYNC_STATE_REQUEST, ({ roomId }) => {
    const cached = roomSyncStates.get(roomId);
    if (cached && cached.source) {
      socket.emit(SOCKET_EVENTS.SYNC_STATE_UPDATE, { state: cached });
    }

    socket.to(roomChannel(roomId)).emit(SOCKET_EVENTS.SYNC_STATE_REQUEST, {
      requestedBy: socket.userId,
    });
  });

  socket.on(SOCKET_EVENTS.SYNC_STATE_UPDATE, ({ roomId, targetUserId, state }) => {
    if (state) {
      const existing = roomSyncStates.get(roomId) || {};
      roomSyncStates.set(roomId, { ...existing, ...state, updatedAt: Date.now() });
    }
    io.to(roomChannel(roomId)).emit(SOCKET_EVENTS.SYNC_STATE_UPDATE, { targetUserId, state });
  });
}
