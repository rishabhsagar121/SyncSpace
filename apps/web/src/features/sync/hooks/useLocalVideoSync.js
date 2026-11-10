// apps/web/src/features/sync/hooks/useLocalVideoSync.js
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

// After we apply a remote command, our own video reports it back: this window stops it being re-sent
const ECHO_SUPPRESS_MS = 1200;
const PLAY_DRIFT_MS = 1000;
const PAUSE_DRIFT_MS = 400;
const SEEK_DEBOUNCE_MS = 250;
const LENGTH_TOLERANCE_S = 2;

const sameMovie = (a, b) => !!a && !!b && a.name === b.name && a.size === b.size;
const movieKey = (m) => (m ? `${m.name}|${m.size}` : '');

function cleanSource(source) {
  if (!source || source.type !== 'local' || typeof source.name !== 'string') return null;
  return {
    type: 'local',
    name: source.name.slice(0, 300),
    size: Number(source.size) || 0,
    durationSec: Number(source.durationSec) || 0,
  };
}

// A saved answer is older by the time the file has loaded: move it forward, unless it is clearly stale
function resolvePending(p, durationSec) {
  let positionMs = Number(p.positionMs) || 0;
  let playing = !!p.playing;
  if (playing) positionMs += Date.now() - p.at;
  if (durationSec && positionMs / 1000 > durationSec + 5) {
    positionMs = 0;
    playing = false;
  }
  return { positionMs, playing };
}

export function useLocalVideoSync(roomId, currentUserId) {
  const socket = getSocket();

  const videoRef = useRef(null);
  const urlRef = useRef(null);
  const readyRef = useRef(false);
  const announceRef = useRef(false);
  const pendingRef = useRef(null);
  const suppressUntilRef = useRef(0);
  const syncedPlayingRef = useRef(null);
  const seekTimerRef = useRef(null);
  const expectedRef = useRef(null); // the movie the room is watching
  const loadedRef = useRef(null); // the file I picked
  const acceptedRef = useRef('');

  const [expected, setExpectedState] = useState(null);
  const [loaded, setLoadedState] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [acceptedFor, setAcceptedForState] = useState('');
  const [lengthWarning, setLengthWarning] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const [playError, setPlayError] = useState(null);

  const suppress = useCallback(() => {
    suppressUntilRef.current = Date.now() + ECHO_SUPPRESS_MS;
  }, []);
  const isSuppressed = useCallback(() => Date.now() < suppressUntilRef.current, []);

  // Playback is shared only when my file is the room's movie (or I chose to use it anyway)
  const inSync = useCallback(() => {
    const e = expectedRef.current;
    const l = loadedRef.current;
    return !!(e && l && (sameMovie(e, l) || acceptedRef.current === movieKey(e)));
  }, []);

  const setExpected = useCallback((m) => {
    expectedRef.current = m;
    setExpectedState(m);
  }, []);
  const setLoaded = useCallback((m) => {
    loadedRef.current = m;
    setLoadedState(m);
  }, []);
  const setAccepted = useCallback((key) => {
    acceptedRef.current = key;
    setAcceptedForState(key);
  }, []);

  const requestState = useCallback(() => {
    socket.emit(EVENTS.SYNC_STATE_REQUEST, { roomId });
  }, [socket, roomId]);

  const apply = useCallback(
    (state) => {
      const v = videoRef.current;
      if (!v || !readyRef.current) {
        pendingRef.current = { positionMs: state.positionMs, playing: state.playing, at: Date.now() };
        return;
      }
      suppress();
      const current = (v.currentTime || 0) * 1000;
      if (Number.isFinite(state.positionMs)) {
        const tolerance = state.playing ? PLAY_DRIFT_MS : PAUSE_DRIFT_MS;
        if (Math.abs(current - state.positionMs) > tolerance) v.currentTime = state.positionMs / 1000;
      }
      if (state.playing === true) {
        syncedPlayingRef.current = true;
        Promise.resolve(v.play())
          .then(() => setNeedsTap(false))
          .catch(() => setNeedsTap(true)); // the browser wants a tap before it plays
      } else if (state.playing === false) {
        syncedPlayingRef.current = false;
        v.pause();
      }
    },
    [suppress]
  );

  // Make my file the movie for everyone, paused at the start
  const announce = useCallback(
    (v) => {
      const l = loadedRef.current;
      if (!l) return;
      const meta = { type: 'local', name: l.name, size: l.size, durationSec: Math.round(v.duration || 0) };
      setExpected(meta);
      setAccepted('');
      setLengthWarning(false);
      syncedPlayingRef.current = false;
      socket.emit(EVENTS.SYNC_STATE_UPDATE, {
        roomId,
        state: { source: meta, positionMs: 0, playing: false },
      });
    },
    [roomId, socket, setExpected, setAccepted]
  );

  const handleSource = useCallback(
    (raw) => {
      const next = cleanSource(raw);
      if (!next || sameMovie(expectedRef.current, next)) return;
      pendingRef.current = null;
      setExpected(next);
      setLengthWarning(false);

      const v = videoRef.current;
      if (v && loadedRef.current && !inSync()) {
        // someone changed the movie: stop mine so it does not play out of step
        suppress();
        v.pause();
        syncedPlayingRef.current = false;
      }
      if (v && readyRef.current && next.durationSec && Math.abs(v.duration - next.durationSec) > LENGTH_TOLERANCE_S) {
        setLengthWarning(true);
      }
    },
    [setExpected, inSync, suppress]
  );

  // Messages from the room
  useEffect(() => {
    if (!roomId) return undefined;

    const remotePlay = ({ positionMs } = {}) => {
      if (inSync()) apply({ positionMs, playing: true });
    };
    const remotePause = ({ positionMs } = {}) => {
      if (inSync()) apply({ positionMs, playing: false });
    };
    const remoteSeek = ({ positionMs } = {}) => {
      const v = videoRef.current;
      if (!inSync() || !v || !readyRef.current || !Number.isFinite(positionMs)) return;
      suppress();
      v.currentTime = positionMs / 1000;
    };
    const remoteSource = ({ source } = {}) => handleSource(source);

    // Someone joined and asks where we are: if I have the movie loaded, I answer them only
    const remoteStateRequest = ({ requestedBy } = {}) => {
      const v = videoRef.current;
      if (!requestedBy || !v || !readyRef.current || !inSync()) return;
      socket.emit(EVENTS.SYNC_STATE_UPDATE, {
        roomId,
        targetUserId: requestedBy,
        state: {
          source: expectedRef.current,
          positionMs: Math.round((v.currentTime || 0) * 1000),
          playing: !v.paused && !v.ended,
        },
      });
    };

    const remoteStateUpdate = ({ targetUserId, state } = {}) => {
      if (!state) return;
      if (state.source) handleSource(state.source);
      // Only an answer to MY request says where to play. Other updates just tell me which movie it is.
      if (targetUserId && targetUserId === currentUserId) {
        if (inSync() && readyRef.current) {
          apply({ positionMs: state.positionMs, playing: state.playing });
        } else {
          pendingRef.current = { positionMs: state.positionMs, playing: state.playing, at: Date.now() };
        }
      }
    };

    socket.on(EVENTS.SYNC_PLAY, remotePlay);
    socket.on(EVENTS.SYNC_PAUSE, remotePause);
    socket.on(EVENTS.SYNC_SEEK, remoteSeek);
    socket.on(EVENTS.SYNC_SOURCE_CHANGE, remoteSource);
    socket.on(EVENTS.SYNC_STATE_REQUEST, remoteStateRequest);
    socket.on(EVENTS.SYNC_STATE_UPDATE, remoteStateUpdate);

    // Ask once on join, and again after every reconnect
    if (socket.connected) requestState();
    socket.on('connect', requestState);

    return () => {
      socket.off(EVENTS.SYNC_PLAY, remotePlay);
      socket.off(EVENTS.SYNC_PAUSE, remotePause);
      socket.off(EVENTS.SYNC_SEEK, remoteSeek);
      socket.off(EVENTS.SYNC_SOURCE_CHANGE, remoteSource);
      socket.off(EVENTS.SYNC_STATE_REQUEST, remoteStateRequest);
      socket.off(EVENTS.SYNC_STATE_UPDATE, remoteStateUpdate);
      socket.off('connect', requestState);
    };
  }, [roomId, currentUserId, socket, apply, handleSource, inSync, suppress, requestState]);

  // What I do on my own video is sent to the room
  const onPlay = useCallback(() => {
    const v = videoRef.current;
    if (!v || isSuppressed() || !inSync() || syncedPlayingRef.current === true) return;
    syncedPlayingRef.current = true;
    socket.emit(EVENTS.SYNC_PLAY, { roomId, positionMs: Math.round((v.currentTime || 0) * 1000) });
  }, [socket, roomId, isSuppressed, inSync]);

  const onPause = useCallback(() => {
    const v = videoRef.current;
    if (!v || isSuppressed() || !inSync() || syncedPlayingRef.current === false) return;
    syncedPlayingRef.current = false;
    socket.emit(EVENTS.SYNC_PAUSE, { roomId, positionMs: Math.round((v.currentTime || 0) * 1000) });
  }, [socket, roomId, isSuppressed, inSync]);

  const onSeeked = useCallback(() => {
    if (!videoRef.current || isSuppressed() || !inSync()) return;
    clearTimeout(seekTimerRef.current);
    seekTimerRef.current = setTimeout(() => {
      const v = videoRef.current;
      if (!v || isSuppressed() || !inSync()) return;
      socket.emit(EVENTS.SYNC_SEEK, { roomId, positionMs: Math.round((v.currentTime || 0) * 1000) });
    }, SEEK_DEBOUNCE_MS);
  }, [socket, roomId, isSuppressed, inSync]);

  const onLoadedMetadata = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    readyRef.current = true;
    setPlayError(null);

    if (announceRef.current) {
      announceRef.current = false;
      announce(v);
      return;
    }

    const e = expectedRef.current;
    if (e?.durationSec && Math.abs(v.duration - e.durationSec) > LENGTH_TOLERANCE_S) setLengthWarning(true);

    if (inSync() && pendingRef.current) {
      const p = resolvePending(pendingRef.current, e?.durationSec || v.duration);
      pendingRef.current = null;
      apply(p);
    }
    requestState(); // ask the others where they are
  }, [announce, apply, inSync, requestState]);

  const onError = useCallback(() => {
    setPlayError('This browser cannot play that file. MP4 (H.264) or WebM files work best.');
  }, []);

  const attachFile = useCallback(
    (file, { announce: shouldAnnounce } = {}) => {
      if (!file) return;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(file);
      urlRef.current = url;
      readyRef.current = false;
      announceRef.current = !!shouldAnnounce;
      syncedPlayingRef.current = null;
      setNeedsTap(false);
      setPlayError(null);
      setLengthWarning(false);
      setLoaded({ name: file.name, size: file.size });
      setVideoUrl(url);
    },
    [setLoaded]
  );

  const announceCurrent = useCallback(() => {
    const v = videoRef.current;
    if (v && readyRef.current) announce(v);
  }, [announce]);

  const acceptAnyway = useCallback(() => {
    setAccepted(movieKey(expectedRef.current));
    requestState();
  }, [setAccepted, requestState]);

  const tapToPlay = useCallback(() => {
    setNeedsTap(false);
    videoRef.current?.play?.().catch(() => {});
  }, []);

  useEffect(
    () => () => {
      clearTimeout(seekTimerRef.current);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    []
  );

  const mismatch = !!(loaded && expected && !sameMovie(loaded, expected) && acceptedFor !== movieKey(expected));
  const synced = !!loaded && !!expected && !mismatch;

  return {
    videoRef,
    videoUrl,
    expected,
    loaded,
    mismatch,
    synced,
    lengthWarning,
    needsTap,
    playError,
    attachFile,
    announceCurrent,
    acceptAnyway,
    tapToPlay,
    resync: requestState,
    onPlay,
    onPause,
    onSeeked,
    onLoadedMetadata,
    onError,
  };
}