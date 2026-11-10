import { env } from '../../config/env.js';

export class MusicApiError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const API = 'https://www.googleapis.com/youtube/v3';
const ID_RE = /^[a-zA-Z0-9_-]{11}$/;
const CACHE_MS = 10 * 60 * 1000; // the same search within 10 minutes costs no quota
const CACHE_MAX = 200;
const searchCache = new Map();

async function callYouTube(path, params) {
  if (!env.YOUTUBE_API_KEY) {
    throw new MusicApiError('Music search is not set up on the server yet (YOUTUBE_API_KEY is missing).', 503);
  }

  const url = new URL(`${API}/${path}`);
  Object.entries({ ...params, key: env.YOUTUBE_API_KEY }).forEach(([k, v]) => url.searchParams.set(k, String(v)));

  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  } catch {
    throw new MusicApiError('Could not reach YouTube. Please try again in a moment.', 502);
  }

  if (!res.ok) {
    let reason = '';
    try {
      const body = await res.json();
      reason = body?.error?.errors?.[0]?.reason || body?.error?.status || '';
    } catch {
      /* no readable error body */
    }
    if (['quotaExceeded', 'dailyLimitExceeded', 'rateLimitExceeded'].includes(reason)) {
      throw new MusicApiError(
        'The daily YouTube search limit was reached. Paste a YouTube link instead, or try again tomorrow.',
        429
      );
    }
    if (['keyInvalid', 'API_KEY_INVALID', 'ipRefererBlocked'].includes(reason)) {
      throw new MusicApiError('The server YouTube API key is not valid.', 503);
    }
    if (reason === 'accessNotConfigured') {
      throw new MusicApiError('YouTube Data API v3 is not enabled for the server API key.', 503);
    }
    throw new MusicApiError('YouTube returned an error. Please try again later.', 502);
  }
  return res.json();
}

function parseDuration(iso) {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso || '');
  if (!m) return 0;
  const [, d = 0, h = 0, min = 0, s = 0] = m;
  return Number(d) * 86400 + Number(h) * 3600 + Number(min) * 60 + Number(s);
}

function toTrack(item) {
  const sn = item.snippet || {};
  const thumbs = sn.thumbnails || {};
  return {
    videoId: item.id,
    title: sn.title || 'Untitled',
    channel: sn.channelTitle || '',
    thumbnail: (thumbs.medium || thumbs.high || thumbs.default || {}).url || `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`,
    durationSec: parseDuration(item.contentDetails?.duration),
  };
}

// Only videos that can be played inside other websites, and are not live streams
async function fetchPlayable(ids, { allowUnlisted = false } = {}) {
  if (!ids.length) return [];
  const data = await callYouTube('videos', {
    part: 'snippet,contentDetails,status',
    id: ids.join(','),
    maxResults: ids.length,
  });
  const byId = new Map(
    (data.items || [])
      .filter((item) => item.status?.embeddable !== false)
      .filter((item) => item.status?.privacyStatus === 'public' || (allowUnlisted && item.status?.privacyStatus === 'unlisted'))
      .filter((item) => !item.snippet?.liveBroadcastContent || item.snippet.liveBroadcastContent === 'none')
      .map((item) => [item.id, toTrack(item)])
  );
  return ids.map((id) => byId.get(id)).filter((t) => t && t.durationSec > 0); // keeps the search order
}

export async function searchSongs(rawQuery) {
  const q = rawQuery.trim().slice(0, 100);
  if (q.length < 2) throw new MusicApiError('Type at least 2 characters to search.');

  const cacheKey = q.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_MS) return { tracks: cached.tracks };

  const found = await callYouTube('search', {
    part: 'snippet',
    type: 'video',
    q,
    maxResults: 12,
    videoEmbeddable: 'true',
    videoSyndicated: 'true',
  });
  const ids = (found.items || []).map((i) => i.id?.videoId).filter(Boolean);
  const tracks = (await fetchPlayable(ids)).slice(0, 10);

  searchCache.set(cacheKey, { at: Date.now(), tracks });
  if (searchCache.size > CACHE_MAX) searchCache.delete(searchCache.keys().next().value);
  return { tracks };
}

export function extractVideoId(input) {
  const text = input.trim();
  if (ID_RE.test(text)) return text;

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    throw new MusicApiError('That does not look like a link.');
  }

  const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');

  if (host.endsWith('spotify.com')) {
    throw new MusicApiError(
      'Spotify links cannot be played in SyncSpace yet. Search for the song name instead.'
    );
  }

  if (host === 'youtu.be') {
    const id = url.pathname.split('/')[1] || '';
    if (ID_RE.test(id)) return id;
  } else if (host === 'youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
    const v = url.searchParams.get('v');
    if (v && ID_RE.test(v)) return v;
    const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([a-zA-Z0-9_-]{11})/);
    if (m) return m[1];
  } else {
    throw new MusicApiError('This link is not supported. Paste a YouTube link.');
  }
  throw new MusicApiError('Could not find a video in that link.');
}

export async function resolveSong(rawUrl) {
  const id = extractVideoId(rawUrl);
  const [track] = await fetchPlayable([id], { allowUnlisted: true });
  if (!track) {
    throw new MusicApiError('That video was not found, is private, is a live stream, or cannot be played here.', 404);
  }
  return { track };
}