// apps/web/src/features/sync/hooks/useRoomSync.js
import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket } from '@/lib/socket';

const EVENTS = {
  SYNC_PLAY: 'sync:play',
  SYNC_PAUSE: 'sync:pause',
  SYNC_SEEK: 'sync:seek',
  SYNC_SOURCE_CHANGE: 'sync:source-change',
  SYNC_STATE_REQUEST: 'sync:state-request',
  SYNC_STATE_UPDATE: 'sync:state-update',
};

// After we apply a remote command, our own player reports it back.
// This window stops that report from being sent out again.
const ECHO_SUPPRESS_MS = 1500;
// A fresh player starts on its own; ignore its first events
const NEW_PLAYER_SUPPRESS_MS = 3000;
// A fresh player needs a moment before it can be seeked or paused safely
const PLAYER_SETTLE_MS = 1500;
// Only jump the video if we are further than this from the room's position
const PLAY_DRIFT_MS = 1500;
const PAUSE_DRIFT_MS = 500;

export function extractYouTubeId(input) {
  if (!input) return null;
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  const urlStr = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(urlStr);
    if (url.hostname.includes('youtu.be')) {
      const id = url.pathname.replace(/^\//, '').split('/')[0];
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }
    const vParam = url.searchParams.get('v');
    if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) return vParam;

    const shortsMatch = url.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (shortsMatch) return shortsMatch[1];

    const liveMatch = url.pathname.match(/\/live\/([a-zA-Z0-9_-]{11})/);
    if (liveMatch) return liveMatch[1];

    const embedMatch = url.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
    if (embedMatch) return embedMatch[1];
  } catch {
    return null;
  }
  return null;
}

const storageKey = (roomId) => `syncspace:room:${roomId}:source`;

function readSavedSource(roomId) {
  if (!roomId) return null;
  try {
    const saved = localStorage.getItem(storageKey(roomId));
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function seekIfNeeded(player, positionMs, toleranceMs) {
  const current = player.getState?.().positionMs ?? 0;
  if (Math.abs(current - positionMs) > toleranceMs) player.seekTo?.(positionMs / 1000);
}

export function useRoomSync(roomId, { isHost, allowGuestControl }) {
  const socket = getSocket();
  const canControl = !!(isHost || allowGuestControl);

  const [source, setSourceState] = useState(() => readSavedSource(roomId));
  const sourceRef = useRef(source);
  const playerRef = useRef(null); // set by the player component
  const pendingStateRef = useRef(null); // state received before the player was ready
  const suppressUntilRef = useRef(0);
  const readyAtRef = useRef(0); // the player is safe to command after this time
  const flushTimerRef = useRef(null);
  const applyStateRef = useRef(null);
  const syncedPlayingRef = useRef(null); // what the room is doing: true, false, or unknown
  const canControlRef = useRef(canControl);

  useEffect(() => {
    canControlRef.current = canControl;
  }, [canControl]);

  // Only ever extends the quiet period, never shortens it
  const suppressEcho = useCallback((ms = ECHO_SUPPRESS_MS) => {
    suppressUntilRef.current = Math.max(suppressUntilRef.current, Date.now() + ms);
  }, []);

  const isEchoSuppressed = useCallback(() => Date.now() < suppressUntilRef.current, []);

  // Apply the waiting state once the player has settled
  const flushLater = useCallback((delay) => {
    clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(() => {
      const pending = pendingStateRef.current;
      if (!pending || !playerRef.current) return;
      pendingStateRef.current = null;
      applyStateRef.current?.(pending);
    }, Math.max(delay, 0));
  }, []);

  // True if the player is still settling: the state is kept and applied a moment later
  const deferIfSettling = useCallback(
    (state) => {
      const remaining = readyAtRef.current - Date.now();
      if (remaining <= 0) return false;
      pendingStateRef.current = state;
      flushLater(remaining + 50);
      return true;
    },
    [flushLater]
  );

  // Only changes anything when the video is actually different
  const setSource = useCallback(
    (newSource) => {
      if (sourceRef.current?.videoId === newSource?.videoId) return;
      sourceRef.current = newSource;
      setSourceState(newSource);
      try {
        if (newSource && roomId) {
          localStorage.setItem(storageKey(roomId), JSON.stringify(newSource));
        }
      } catch {
        /* storage unavailable */
      }
    },
    [roomId]
  );

  // Switching to another room: load that room's saved video
  useEffect(() => {
    const saved = readSavedSource(roomId);
    pendingStateRef.current = null;
    syncedPlayingRef.current = null;
    clearTimeout(flushTimerRef.current);
    if (saved?.videoId !== sourceRef.current?.videoId) {
      sourceRef.current = saved;
      setSourceState(saved);
    }
  }, [roomId]);

  useEffect(() => () => clearTimeout(flushTimerRef.current), []);

  const applyState = useCallback(
    (state) => {
      if (!state) return;

      // A different video: switch first, apply the position once the player is ready
      if (state.source && state.source.videoId !== sourceRef.current?.videoId) {
        pendingStateRef.current = state;
        setSource(state.source);
        return;
      }

      const player = playerRef.current;
      if (!player) {
        pendingStateRef.current = state;
        return;
      }

      // Wait until a freshly loaded player has settled
      if (deferIfSettling(state)) return;

      suppressEcho();
      if (typeof state.positionMs === 'number') {
        seekIfNeeded(player, state.positionMs, PLAY_DRIFT_MS);
      }
      if (state.playing === true) {
        syncedPlayingRef.current = true;
        player.play?.();
      } else if (state.playing === false) {
        syncedPlayingRef.current = false;
        player.pause?.();
      }
    },
    [setSource, suppressEcho, deferIfSettling]
  );

  useEffect(() => {
    applyStateRef.current = applyState;
  }, [applyState]);

  const registerPlayer = useCallback(
    (player) => {
      playerRef.current = player;
      if (!player) {
        clearTimeout(flushTimerRef.current);
        return;
      }
      // A brand-new player starts by itself: ignore its first events and give it time to settle
      suppressEcho(NEW_PLAYER_SUPPRESS_MS);
      readyAtRef.current = Date.now() + PLAYER_SETTLE_MS;
      if (pendingStateRef.current) flushLater(PLAYER_SETTLE_MS + 50);
    },
    [suppressEcho, flushLater]
  );

  useEffect(() => {
    if (!roomId) return;

    const onPlay = ({ positionMs }) => {
      syncedPlayingRef.current = true;
      const player = playerRef.current;
      if (!player) return;
      if (deferIfSettling({ positionMs, playing: true })) return;
      suppressEcho();
      seekIfNeeded(player, positionMs, PLAY_DRIFT_MS);
      player.play?.();
    };

    const onPause = ({ positionMs }) => {
      syncedPlayingRef.current = false;
      const player = playerRef.current;
      if (!player) return;
      if (deferIfSettling({ positionMs, playing: false })) return;
      suppressEcho();
      seekIfNeeded(player, positionMs, PAUSE_DRIFT_MS);
      player.pause?.();
    };

    const onSeek = ({ positionMs }) => {
      const player = playerRef.current;
      if (!player) return;
      if (deferIfSettling({ positionMs })) return;
      suppressEcho();
      player.seekTo?.(positionMs / 1000);
    };

    const onSourceChange = ({ source: newSource }) => {
      pendingStateRef.current = null;
      syncedPlayingRef.current = true; // a new video starts playing
      setSource(newSource);
    };

    // Someone joined or refreshed and wants the current state: only that person gets the answer
    const onStateRequest = ({ requestedBy } = {}) => {
      if (!canControlRef.current || !requestedBy) return;
      const state = playerRef.current?.getState?.();
      if (!state || !sourceRef.current) return;
      socket.emit(EVENTS.SYNC_STATE_UPDATE, {
        roomId,
        targetUserId: requestedBy,
        state: { ...state, source: sourceRef.current },
      });
    };

    const onStateUpdate = ({ state }) => applyState(state);

    const requestState = () => socket.emit(EVENTS.SYNC_STATE_REQUEST, { roomId });

    socket.on(EVENTS.SYNC_PLAY, onPlay);
    socket.on(EVENTS.SYNC_PAUSE, onPause);
    socket.on(EVENTS.SYNC_SEEK, onSeek);
    socket.on(EVENTS.SYNC_SOURCE_CHANGE, onSourceChange);
    socket.on(EVENTS.SYNC_STATE_REQUEST, onStateRequest);
    socket.on(EVENTS.SYNC_STATE_UPDATE, onStateUpdate);

    // Ask once on join, and again whenever the socket (re)connects
    if (socket.connected) requestState();
    socket.on('connect', requestState);

    return () => {
      socket.off(EVENTS.SYNC_PLAY, onPlay);
      socket.off(EVENTS.SYNC_PAUSE, onPause);
      socket.off(EVENTS.SYNC_SEEK, onSeek);
      socket.off(EVENTS.SYNC_SOURCE_CHANGE, onSourceChange);
      socket.off(EVENTS.SYNC_STATE_REQUEST, onStateRequest);
      socket.off(EVENTS.SYNC_STATE_UPDATE, onStateUpdate);
      socket.off('connect', requestState);
    };
  }, [roomId, socket, setSource, applyState, suppressEcho, deferIfSettling]);

  const changeSource = useCallback(
    (rawInput) => {
      const videoId = extractYouTubeId(rawInput);
      if (!videoId) return false;
      const newSource = { videoId, url: rawInput.trim() };
      syncedPlayingRef.current = true;
      setSource(newSource);
      socket.emit(EVENTS.SYNC_SOURCE_CHANGE, { roomId, source: newSource });
      return true;
    },
    [roomId, socket, setSource]
  );

  // Only send a play if the room is not already playing (buffering must not re-send it)
  const emitPlay = useCallback(
    (positionMs) => {
      if (isEchoSuppressed() || !canControl) return;
      if (syncedPlayingRef.current === true) return;
      syncedPlayingRef.current = true;
      socket.emit(EVENTS.SYNC_PLAY, { roomId, positionMs });
    },
    [roomId, socket, canControl, isEchoSuppressed]
  );

  const emitPause = useCallback(
    (positionMs) => {
      if (isEchoSuppressed() || !canControl) return;
      if (syncedPlayingRef.current === false) return;
      syncedPlayingRef.current = false;
      socket.emit(EVENTS.SYNC_PAUSE, { roomId, positionMs });
    },
    [roomId, socket, canControl, isEchoSuppressed]
  );

  const emitSeek = useCallback(
    (positionMs) => {
      if (isEchoSuppressed() || !canControl) return;
      socket.emit(EVENTS.SYNC_SEEK, { roomId, positionMs });
    },
    [roomId, socket, canControl, isEchoSuppressed]
  );

  return { source, changeSource, canControl, registerPlayer, emitPlay, emitPause, emitSeek };
}