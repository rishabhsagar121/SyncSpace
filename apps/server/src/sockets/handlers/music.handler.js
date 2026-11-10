import { randomUUID } from 'node:crypto';
import { roomRepository } from '../../modules/rooms/room.repository.js';
import { getMusicState, updateMusicState, currentPositionMs, publicState, emptyMusicState } from '../musicState.js';
import { logger } from '../../config/logger.js';

const channel = (roomId) => `music:${roomId}`;
const VIDEO_ID = /^[a-zA-Z0-9_-]{11}$/;
const MAX_QUEUE = 100;
const RATE_LIMIT = { count: 30, windowMs: 5000 };
const MAX_MS = 24 * 60 * 60 * 1000;

class MusicError extends Error {}

const clampMs = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(n, MAX_MS)) : 0;
};

async function assertMember(roomId, userId) {
  if (!roomId || typeof roomId !== 'string') throw new MusicError('Room is required.');
  const membership = await roomRepository.findMembership(roomId, userId);
  if (!membership || membership.leftAt) throw new MusicError('You are not a member of this room.');
}

function cleanTrack(raw, userId, now) {
  const videoId = String(raw?.videoId || '');
  if (!VIDEO_ID.test(videoId)) throw new MusicError('That is not a valid YouTube video.');
  return {
    id: randomUUID(),
    videoId,
    title: String(raw?.title || 'Untitled').slice(0, 200),
    channel: String(raw?.channel || '').slice(0, 120),
    thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
    durationSec: Math.max(0, Math.min(Math.floor(Number(raw?.durationSec) || 0), 12 * 3600)),
    addedBy: userId,
    addedAt: now,
  };
}

// ---- the changes people can make to the room's music (each returns the new state, or null for "no change") ----
const actions = {
  play: (s, p, now) => {
    if (!s.queue.length) throw new MusicError('The queue is empty. Add a song first.');
    if (s.playing && s.index >= 0) return null;
    const index = s.index < 0 ? 0 : s.index;
    const positionMs = index === s.index ? currentPositionMs(s, now) : 0;
    return { ...s, index, playing: true, positionMs, updatedAt: now };
  },

  pause: (s, p, now) => {
    if (s.index < 0) throw new MusicError('Nothing is playing.');
    if (!s.playing) return null;
    return { ...s, playing: false, positionMs: currentPositionMs(s, now), updatedAt: now };
  },

  seek: (s, p, now) => {
    if (s.index < 0) throw new MusicError('Nothing is playing.');
    const track = s.queue[s.index];
    let positionMs = clampMs(p.positionMs);
    if (track?.durationSec) positionMs = Math.min(positionMs, Math.max(0, track.durationSec * 1000 - 500));
    return { ...s, positionMs, updatedAt: now };
  },

  next: (s, p, now) => {
    if (!s.queue.length) throw new MusicError('The queue is empty.');
    if (s.index + 1 >= s.queue.length) throw new MusicError('This is the last song in the queue.');
    return { ...s, index: s.index + 1, playing: true, positionMs: 0, updatedAt: now };
  },

  prev: (s, p, now) => {
    if (s.index < 0) throw new MusicError('Nothing is playing.');
    // like most players: after 3 seconds, "previous" restarts the song
    if (currentPositionMs(s, now) > 3000 || s.index === 0) {
      return { ...s, positionMs: 0, updatedAt: now };
    }
    return { ...s, index: s.index - 1, playing: true, positionMs: 0, updatedAt: now };
  },

  add: (s, p, now, userId) => {
    if (s.queue.length >= MAX_QUEUE) throw new MusicError(`The queue is full (${MAX_QUEUE} songs).`);
    const track = cleanTrack(p.track, userId, now);
    if (s.queue.some((item) => item.videoId === track.videoId)) {
      throw new MusicError('That song is already in the queue.');
    }
    const queue = [...s.queue, track];
    // nothing selected yet: the new song starts playing
    if (s.index < 0) {
      return { ...s, queue, index: queue.length - 1, playing: true, positionMs: 0, updatedAt: now };
    }
    return { ...s, queue };
  },

  remove: (s, p, now) => {
    const at = s.queue.findIndex((item) => item.id === p.itemId);
    if (at === -1) return null;
    const queue = s.queue.filter((item) => item.id !== p.itemId);

    if (!queue.length) return { ...s, queue, index: -1, playing: false, positionMs: 0, updatedAt: now };
    if (at < s.index) return { ...s, queue, index: s.index - 1 };
    if (at > s.index) return { ...s, queue };

    // the song that was playing got removed: the next one slides into its place
    if (at < queue.length) return { ...s, queue, positionMs: 0, updatedAt: now };
    return { ...s, queue, index: -1, playing: false, positionMs: 0, updatedAt: now };
  },

  'play-item': (s, p, now) => {
    const at = s.queue.findIndex((item) => item.id === p.itemId);
    if (at === -1) throw new MusicError('That song is no longer in the queue.');
    return { ...s, index: at, playing: true, positionMs: 0, updatedAt: now };
  },

  // every listener reports "song finished"; only the first report counts
  ended: (s, p, now) => {
    if (s.queue[s.index]?.id !== p.itemId) return null;
    if (s.index + 1 < s.queue.length) {
      return { ...s, index: s.index + 1, playing: true, positionMs: 0, updatedAt: now };
    }
    return { ...s, playing: false, positionMs: 0, updatedAt: now };
  },
};

export function registerMusicHandlers(io, socket) {
  const sentAt = [];
  const isRateLimited = () => {
    const now = Date.now();
    while (sentAt.length && now - sentAt[0] > RATE_LIMIT.windowMs) sentAt.shift();
    if (sentAt.length >= RATE_LIMIT.count) return true;
    sentAt.push(now);
    return false;
  };

  const reply = (ack, data) => typeof ack === 'function' && ack(data);

  const fail = (name, err, ack) => {
    if (!(err instanceof MusicError)) logger.error(`${name} failed: ${err.message}`);
    reply(ack, { ok: false, message: err instanceof MusicError ? err.message : 'Something went wrong.' });
  };

  // Join the room's music channel (done again by the browser after every reconnect)
  socket.on('music:join', async (payload, ack) => {
    try {
      const roomId = payload?.roomId;
      await assertMember(roomId, socket.userId);
      socket.join(channel(roomId));
      const state = (await getMusicState(roomId)) ?? emptyMusicState();
      reply(ack, { ok: true, state: publicState(state) });
    } catch (err) {
      fail('music:join', err, ack);
    }
  });

  socket.on('music:leave', (payload) => {
    if (payload?.roomId) socket.leave(channel(payload.roomId));
  });

  // Browsers ask now and then to correct drift: one small reply, nothing is broadcast
  socket.on('music:get-state', async (payload, ack) => {
    try {
      const roomId = payload?.roomId;
      await assertMember(roomId, socket.userId);
      if (!socket.rooms.has(channel(roomId))) throw new MusicError('Join the music room first.');
      const state = (await getMusicState(roomId)) ?? emptyMusicState();
      reply(ack, { ok: true, state: publicState(state) });
    } catch (err) {
      fail('music:get-state', err, ack);
    }
  });

  Object.keys(actions).forEach((name) => {
    const event = `music:${name}`;
    socket.on(event, async (payload, ack) => {
      try {
        const data = payload ?? {};
        if (isRateLimited()) throw new MusicError('You are doing that too fast. Wait a moment.');
        await assertMember(data.roomId, socket.userId);
        if (!socket.rooms.has(channel(data.roomId))) throw new MusicError('Join the music room first.');

        const next = await updateMusicState(data.roomId, (state, now) =>
          actions[name](state, data, now, socket.userId)
        );

        if (next) {
          io.to(channel(data.roomId)).emit('music:state', { ...publicState(next), by: socket.userId });
          return reply(ack, { ok: true, state: publicState(next) });
        }
        const current = (await getMusicState(data.roomId)) ?? emptyMusicState();
        reply(ack, { ok: true, state: publicState(current) });
      } catch (err) {
        fail(event, err, ack);
      }
    });
  });
}