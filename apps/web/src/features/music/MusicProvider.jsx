import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getSocket } from '@/lib/socket';

const MusicContext = createContext(null);

const EMPTY_STATE = { queue: [], index: -1, playing: false, positionNowMs: 0, version: 0, receivedAt: 0 };
const REFRESH_MS = 15000; // small check with the server to correct drift
const VOLUME_KEY = 'syncspace:music:volume';

function readVolume() {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    const v = raw === null ? NaN : Number(raw);
    return Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 80;
  } catch {
    return 80;
  }
}

export function MusicProvider({ children }) {
  const [room, setRoom] = useState(null); // { id, name } of the room we are listening in
  const [state, setState] = useState(EMPTY_STATE);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [volume, setVolumeState] = useState(readVolume);

  const versionRef = useRef(0);
  const roomIdRef = useRef(null);

  useEffect(() => {
    roomIdRef.current = room?.id ?? null;
  }, [room]);

  const applyState = useCallback((incoming, { force = false } = {}) => {
    if (!incoming) return;
    if (!force && incoming.version < versionRef.current) return; // an older update arrived late
    versionRef.current = incoming.version;
    setState({
      queue: incoming.queue || [],
      index: incoming.index ?? -1,
      playing: !!incoming.playing,
      positionNowMs: incoming.positionNowMs || 0,
      version: incoming.version,
      receivedAt: Date.now(),
    });
  }, []);

  const request = useCallback(
    (event, payload) =>
      new Promise((resolve) => {
        const socket = getSocket();
        if (!socket.connected) {
          resolve({ ok: false, message: 'Not connected. Trying to reconnect…' });
          return;
        }
        socket.timeout(8000).emit(event, payload, (err, res) => {
          resolve(err ? { ok: false, message: 'The server did not respond. Try again.' } : res);
        });
      }),
    []
  );

  // Join the room's music channel, and again after every reconnect
  useEffect(() => {
    if (!room?.id) return undefined;
    const roomId = room.id;
    const socket = getSocket();

    versionRef.current = 0;
    setState(EMPTY_STATE);
    setError(null);

    const join = async () => {
      const res = await request('music:join', { roomId });
      if (res?.ok) {
        setConnected(true);
        setError(null);
        applyState(res.state, { force: true });
      } else {
        setConnected(false);
        setError(res?.message || 'Could not join the music room.');
      }
    };

    const refresh = async () => {
      const res = await request('music:get-state', { roomId });
      if (res?.ok) applyState(res.state);
    };

    const onState = (payload) => applyState(payload);
    const onDisconnect = () => setConnected(false);

    if (socket.connected) join();
    socket.on('connect', join);
    socket.on('disconnect', onDisconnect);
    socket.on('music:state', onState);
    const timer = setInterval(refresh, REFRESH_MS);

    return () => {
      clearInterval(timer);
      socket.off('connect', join);
      socket.off('disconnect', onDisconnect);
      socket.off('music:state', onState);
      socket.emit('music:leave', { roomId });
    };
  }, [room?.id, request, applyState]);

  const send = useCallback(
    async (name, extra = {}) => {
      const roomId = roomIdRef.current;
      if (!roomId) return { ok: false, message: 'Not listening in a room.' };
      const res = await request(`music:${name}`, { roomId, ...extra });
      if (res?.ok) {
        setError(null);
        applyState(res.state);
      } else {
        setError(res?.message || 'Something went wrong.');
      }
      return res;
    },
    [request, applyState]
  );

  const actions = useMemo(
    () => ({
      play: () => send('play'),
      pause: () => send('pause'),
      seek: (positionMs) => send('seek', { positionMs }),
      next: () => send('next'),
      prev: () => send('prev'),
      add: (track) => send('add', { track }),
      remove: (itemId) => send('remove', { itemId }),
      playItem: (itemId) => send('play-item', { itemId }),
      ended: (itemId) => send('ended', { itemId }),
    }),
    [send]
  );

  const joinMusic = useCallback((id, name) => {
    setRoom((prev) => (prev?.id === id && prev.name === name ? prev : { id, name }));
  }, []);

  const leaveMusic = useCallback(() => {
    setRoom(null);
    setState(EMPTY_STATE);
    setConnected(false);
    setError(null);
    versionRef.current = 0;
  }, []);

  const setVolume = useCallback((value) => {
    const v = Math.min(100, Math.max(0, Number(value) || 0));
    setVolumeState(v);
    try {
      localStorage.setItem(VOLUME_KEY, String(v));
    } catch {
      /* storage unavailable */
    }
  }, []);

  const value = useMemo(
    () => ({ room, state, connected, error, setError, volume, setVolume, actions, joinMusic, leaveMusic }),
    [room, state, connected, error, volume, setVolume, actions, joinMusic, leaveMusic]
  );

  return <MusicContext.Provider value={value}>{children}</MusicContext.Provider>;
}

export function useMusic() {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error('useMusic must be used inside MusicProvider');
  return ctx;
}