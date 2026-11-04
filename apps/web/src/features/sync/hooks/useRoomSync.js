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

// Applying a remote event triggers our own player's onStateChange, which
// would otherwise re-broadcast it right back out. This window suppresses
// that echo.
const ECHO_SUPPRESS_MS = 600;

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

export function useRoomSync(roomId, { isHost, allowGuestControl }) {
  const socket = getSocket();

  // Restore active video source from localStorage across page refreshes
  const [source, setSourceState] = useState(() => {
    if (!roomId) return null;
    try {
      const saved = localStorage.getItem(`syncspace:room:${roomId}:source`);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const setSource = useCallback(
    (newSource) => {
      setSourceState(newSource);
      try {
        if (newSource && roomId) {
          localStorage.setItem(`syncspace:room:${roomId}:source`, JSON.stringify(newSource));
        }
      } catch {
        /* storage unavailable */
      }
    },
    [roomId]
  );

  const suppressUntilRef = useRef(0);
  const playerRef = useRef(null); // set by the player component

  const canControl = isHost || allowGuestControl;

  const suppressEcho = () => {
    suppressUntilRef.current = Date.now() + ECHO_SUPPRESS_MS;
  };
  const isEchoSuppressed = () => Date.now() < suppressUntilRef.current;

  const registerPlayer = useCallback((player) => {
    playerRef.current = player;
  }, []);

  useEffect(() => {
    if (!roomId) return;

    const onPlay = ({ positionMs }) => {
      suppressEcho();
      playerRef.current?.seekTo?.(positionMs / 1000);
      playerRef.current?.play?.();
    };
    const onPause = ({ positionMs }) => {
      suppressEcho();
      playerRef.current?.seekTo?.(positionMs / 1000);
      playerRef.current?.pause?.();
    };
    const onSeek = ({ positionMs }) => {
      suppressEcho();
      playerRef.current?.seekTo?.(positionMs / 1000);
    };
    const onSourceChange = ({ source: newSource }) => {
      setSource(newSource);
    };
    const onStateRequest = () => {
      const state = playerRef.current?.getState?.();
      if (!state && !source) return;
      socket.emit(EVENTS.SYNC_STATE_UPDATE, { roomId, state: { ...state, source } });
    };
    const onStateUpdate = ({ state }) => {
      if (!state) return;
      suppressEcho();
      if (state.source) setSource(state.source);
      if (typeof state.positionMs === 'number') {
        playerRef.current?.seekTo?.(state.positionMs / 1000);
      }
      if (state.playing) playerRef.current?.play?.();
      else if (state.playing === false) playerRef.current?.pause?.();
    };

    socket.on(EVENTS.SYNC_PLAY, onPlay);
    socket.on(EVENTS.SYNC_PAUSE, onPause);
    socket.on(EVENTS.SYNC_SEEK, onSeek);
    socket.on(EVENTS.SYNC_SOURCE_CHANGE, onSourceChange);
    socket.on(EVENTS.SYNC_STATE_REQUEST, onStateRequest);
    socket.on(EVENTS.SYNC_STATE_UPDATE, onStateUpdate);

    // Ask the room for current playback state on join / refresh
    socket.emit(EVENTS.SYNC_STATE_REQUEST, { roomId });

    return () => {
      socket.off(EVENTS.SYNC_PLAY, onPlay);
      socket.off(EVENTS.SYNC_PAUSE, onPause);
      socket.off(EVENTS.SYNC_SEEK, onSeek);
      socket.off(EVENTS.SYNC_SOURCE_CHANGE, onSourceChange);
      socket.off(EVENTS.SYNC_STATE_REQUEST, onStateRequest);
      socket.off(EVENTS.SYNC_STATE_UPDATE, onStateUpdate);
    };
  }, [roomId, socket, setSource, source]);

  const changeSource = useCallback(
    (rawInput) => {
      const videoId = extractYouTubeId(rawInput);
      if (!videoId) return false;
      const newSource = { videoId, url: rawInput.trim() };
      setSource(newSource);
      socket.emit(EVENTS.SYNC_SOURCE_CHANGE, { roomId, source: newSource });
      return true;
    },
    [roomId, socket, setSource]
  );

  const emitPlay = useCallback(
    (positionMs) => {
      if (isEchoSuppressed() || !canControl) return;
      socket.emit(EVENTS.SYNC_PLAY, { roomId, positionMs });
    },
    [roomId, socket, canControl]
  );

  const emitPause = useCallback(
    (positionMs) => {
      if (isEchoSuppressed() || !canControl) return;
      socket.emit(EVENTS.SYNC_PAUSE, { roomId, positionMs });
    },
    [roomId, socket, canControl]
  );

  const emitSeek = useCallback(
    (positionMs) => {
      if (isEchoSuppressed() || !canControl) return;
      socket.emit(EVENTS.SYNC_SEEK, { roomId, positionMs });
    },
    [roomId, socket, canControl]
  );

  return { source, changeSource, canControl, registerPlayer, emitPlay, emitPause, emitSeek };
}
