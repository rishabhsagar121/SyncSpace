import { SOCKET_EVENTS } from '../../../../../packages/shared/constants/socketEvents.js';
import { roomRepository } from '../../modules/rooms/room.repository.js';
import { getRoomState, mergeRoomState } from '../roomState.js';
import { logger } from '../../config/logger.js';

const roomChannel = (roomId) => `room:${roomId}`;
const userChannel = (userId) => `user:${userId}`;

// Only these keys may be stored from a client-sent state object
const STATE_KEYS = ['source', 'positionMs', 'playing', 'queue'];

const toPositionMs = (value) => (Number.isFinite(value) ? Math.max(0, value) : 0);

async function getMembership(roomId, userId) {
  if (!roomId) return null;
  const membership = await roomRepository.findMembership(roomId, userId);
  return membership && !membership.leftAt ? membership : null;
}

// Host and co-host always control playback; members only if the room allows guest control
async function canControl(roomId, userId) {
  const membership = await getMembership(roomId, userId);
  if (!membership) return false;
  if (membership.role === 'HOST' || membership.role === 'CO_HOST') return true;
  const room = await roomRepository.findById(roomId);
  return !!room?.settings?.allowGuestControl;
}

// Wraps a handler so it only runs for people allowed to control playback
function controllerOnly(socket, handler) {
  return async (payload = {}) => {
    try {
      if (!(await canControl(payload.roomId, socket.userId))) {
        socket.emit(SOCKET_EVENTS.ROOM_ERROR, {
          roomId: payload.roomId,
          message: 'You do not have permission to control playback',
        });
        return;
      }
      await handler(payload);
    } catch (err) {
      logger.error(`Sync handler failed: ${err.message}`);
    }
  };
}

export function registerSyncHandlers(io, socket) {
  socket.on(
    SOCKET_EVENTS.SYNC_PLAY,
    controllerOnly(socket, async ({ roomId, positionMs }) => {
      const pos = toPositionMs(positionMs);
      await mergeRoomState(roomId, { playing: true, positionMs: pos });
      socket.to(roomChannel(roomId)).emit(SOCKET_EVENTS.SYNC_PLAY, { positionMs: pos, byUserId: socket.userId });
    })
  );

  socket.on(
    SOCKET_EVENTS.SYNC_PAUSE,
    controllerOnly(socket, async ({ roomId, positionMs }) => {
      const pos = toPositionMs(positionMs);
      await mergeRoomState(roomId, { playing: false, positionMs: pos });
      socket.to(roomChannel(roomId)).emit(SOCKET_EVENTS.SYNC_PAUSE, { positionMs: pos, byUserId: socket.userId });
    })
  );

  socket.on(
    SOCKET_EVENTS.SYNC_SEEK,
    controllerOnly(socket, async ({ roomId, positionMs }) => {
      const pos = toPositionMs(positionMs);
      await mergeRoomState(roomId, { positionMs: pos });
      socket.to(roomChannel(roomId)).emit(SOCKET_EVENTS.SYNC_SEEK, { positionMs: pos, byUserId: socket.userId });
    })
  );

  socket.on(
    SOCKET_EVENTS.SYNC_SOURCE_CHANGE,
    controllerOnly(socket, async ({ roomId, source }) => {
      if (!source) return;
      await mergeRoomState(roomId, { source, positionMs: 0, playing: true });
      socket.to(roomChannel(roomId)).emit(SOCKET_EVENTS.SYNC_SOURCE_CHANGE, { source, byUserId: socket.userId });
    })
  );

  socket.on(
    SOCKET_EVENTS.SYNC_QUEUE_UPDATE,
    controllerOnly(socket, async ({ roomId, queue }) => {
      if (!Array.isArray(queue)) return;
      await mergeRoomState(roomId, { queue }); // saved, so late joiners get the queue too
      socket.to(roomChannel(roomId)).emit(SOCKET_EVENTS.SYNC_QUEUE_UPDATE, { queue });
    })
  );

  // A late joiner or refreshed page asks for the current playback state.
  // Any room member may ask; they get the saved state, and the others are asked too.
  socket.on(SOCKET_EVENTS.SYNC_STATE_REQUEST, async ({ roomId } = {}) => {
    try {
      if (!(await getMembership(roomId, socket.userId))) return;

      const cached = await getRoomState(roomId);
      if (cached && (cached.source || cached.queue?.length)) {
        // while playing, the saved position is stale by however long ago it was saved
        const elapsed = cached.playing && cached.updatedAt ? Date.now() - cached.updatedAt : 0;
        socket.emit(SOCKET_EVENTS.SYNC_STATE_UPDATE, {
          state: { ...cached, positionMs: toPositionMs((cached.positionMs ?? 0) + elapsed) },
        });
      }

      socket.to(roomChannel(roomId)).emit(SOCKET_EVENTS.SYNC_STATE_REQUEST, { requestedBy: socket.userId });
    } catch (err) {
      logger.error(`SYNC_STATE_REQUEST failed: ${err.message}`);
    }
  });

  // Someone with control answers a state request. It goes to the person who asked
  // (or the whole room if no target is given), and only known keys are saved.
  socket.on(
    SOCKET_EVENTS.SYNC_STATE_UPDATE,
    controllerOnly(socket, async ({ roomId, targetUserId, state }) => {
      const clean = {};
      if (state && typeof state === 'object') {
        for (const key of STATE_KEYS) if (key in state) clean[key] = state[key];
        if ('positionMs' in clean) clean.positionMs = toPositionMs(clean.positionMs);
        await mergeRoomState(roomId, clean);
      }
      const target = targetUserId ? io.to(userChannel(targetUserId)) : io.to(roomChannel(roomId));
      target.emit(SOCKET_EVENTS.SYNC_STATE_UPDATE, { targetUserId, state: clean });
    })
  );
}