import { redisClient } from '../config/redis.js';

// Music state per room: queue, current song, playing/paused and position.
// Saved in Redis when it is available, and always in memory as a fallback.
const key = (roomId) => `room:${roomId}:music`;
const TTL_SECONDS = 60 * 60 * 24 * 7;
const MAX_ROOMS_IN_MEMORY = 500;
const memory = new Map();
const locks = new Map();

export const emptyMusicState = () => ({
  queue: [],
  index: -1,
  playing: false,
  positionMs: 0,
  updatedAt: Date.now(),
  version: 0,
});

export async function getMusicState(roomId) {
  if (redisClient?.isReady) {
    try {
      const raw = await redisClient.get(key(roomId));
      if (raw) {
        const state = JSON.parse(raw);
        memory.set(roomId, state);
        return state;
      }
    } catch {
      // fall back to memory
    }
  }
  return memory.get(roomId) ?? null;
}

async function saveMusicState(roomId, state) {
  memory.set(roomId, state);
  if (memory.size > MAX_ROOMS_IN_MEMORY) memory.delete(memory.keys().next().value);

  if (redisClient?.isReady) {
    try {
      await redisClient.set(key(roomId), JSON.stringify(state), { EX: TTL_SECONDS });
    } catch {
      // memory keeps the room working until Redis is back
    }
  }
}

// Changes to one room run one at a time, so two people adding songs at once never overwrite each other
function withLock(roomId, task) {
  const previous = locks.get(roomId) ?? Promise.resolve();
  const run = previous.catch(() => {}).then(task);
  const tail = run.catch(() => {});
  locks.set(roomId, tail);
  tail.then(() => {
    if (locks.get(roomId) === tail) locks.delete(roomId);
  });
  return run;
}

// mutator(state, now) returns the new state, or null when nothing changed
export function updateMusicState(roomId, mutator) {
  return withLock(roomId, async () => {
    const current = (await getMusicState(roomId)) ?? emptyMusicState();
    const next = mutator(current, Date.now());
    if (!next) return null;
    const saved = { ...next, version: (current.version || 0) + 1 };
    await saveMusicState(roomId, saved);
    return saved;
  });
}

export function currentPositionMs(state, now = Date.now()) {
  const track = state.queue[state.index];
  let position = state.positionMs || 0;
  if (state.playing) position += now - state.updatedAt;
  const max = track?.durationSec ? track.durationSec * 1000 : Infinity;
  return Math.max(0, Math.min(position, max));
}

// What clients receive: the position is already worked out for "right now"
export function publicState(state) {
  const now = Date.now();
  return {
    queue: state.queue,
    index: state.index,
    playing: state.playing,
    positionNowMs: Math.round(currentPositionMs(state, now)),
    version: state.version,
    serverNow: now,
  };
}