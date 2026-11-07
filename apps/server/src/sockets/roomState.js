import { redisClient } from '../config/redis.js';

// Last-known playback state per room, so late joiners / reconnects can
// catch up (source, queue, timestamp, play state, speed).
const key = (roomId) => `room:${roomId}:state`;
const TTL_SECONDS = 60 * 60 * 24;
const memoryState = new Map();

function getMemoryState(roomId) {
  const entry = memoryState.get(roomId);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    memoryState.delete(roomId);
    return null;
  }

  return entry.state;
}

function saveMemoryState(roomId, state) {
  memoryState.set(roomId, {
    state,
    expiresAt: Date.now() + TTL_SECONDS * 1000,
  });
}

export async function getRoomState(roomId) {
  if (!redisClient.isReady) return getMemoryState(roomId);

  try {
    const raw = await redisClient.get(key(roomId));
    if (!raw) return getMemoryState(roomId);

    const state = JSON.parse(raw);
    saveMemoryState(roomId, state);
    return state;
  } catch {
    return getMemoryState(roomId);
  }
}

export async function mergeRoomState(roomId, patch) {
  const current = (await getRoomState(roomId)) ?? {};
  const next = { ...current, ...patch, updatedAt: Date.now() };
  saveMemoryState(roomId, next);

  if (redisClient.isReady) {
    try {
      await redisClient.set(key(roomId), JSON.stringify(next), { EX: TTL_SECONDS });
    } catch {
      // The in-memory state keeps active room sync working until Redis reconnects.
    }
  }

  return next;
}
