import { redisClient } from '../config/redis.js';

// Last-known playback state per room, so late joiners / reconnects can
// catch up (source, queue, timestamp, play state, speed).
const key = (roomId) => `room:${roomId}:state`;
const TTL_SECONDS = 60 * 60 * 24;

export async function getRoomState(roomId) {
  const raw = await redisClient.get(key(roomId));
  return raw ? JSON.parse(raw) : null;
}

export async function mergeRoomState(roomId, patch) {
  const current = (await getRoomState(roomId)) ?? {};
  const next = { ...current, ...patch, updatedAt: Date.now() };
  await redisClient.set(key(roomId), JSON.stringify(next), { EX: TTL_SECONDS });
  return next;
}