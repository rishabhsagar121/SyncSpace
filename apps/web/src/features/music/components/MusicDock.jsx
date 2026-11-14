import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Maximize,
  Minimize,
  Music,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useMusic } from '../MusicProvider';
import { expectedPositionMs, formatDuration } from '../format';
import { useFullscreen } from '@/hooks/useFullscreen';

let apiLoadPromise = null;
function loadYouTubeApi() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (apiLoadPromise) return apiLoadPromise;

  apiLoadPromise = new Promise((resolve) => {
    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prevCallback?.();
      resolve(window.YT);
    };
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
  });
  return apiLoadPromise;
}

const DRIFT_MS = 1500; // how far off we may drift before jumping back
const SEEK_TOLERANCE_MS = 1200;
const DRIFT_CHECK_MS = 5000;
const GESTURE_CHECK_MS = 2500;
const FS_CONTROLS_HIDE_MS = 3000;
const TYPING_RESTORE_MS = 300;
const COLLAPSE_KEY = 'syncspace:music:dockCollapsed';

const roundBtn =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stage-overlay text-paper transition-colors hover:bg-white/10 disabled:opacity-40';
const smallBtn =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stage-overlay text-paper transition-colors hover:bg-white/10 disabled:opacity-40';

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

function DockBody() {
  const { room, state, connected, error, volume, setVolume, actions, leaveMusic } = useMusic();

  const containerRef = useRef(null);
  const videoWrapRef = useRef(null);
  const playerRef = useRef(null);
  const readyRef = useRef(false);
  const loadedRef = useRef(null); // the video currently loaded in the player
  const gestureTimerRef = useRef(null);
  const hideTimerRef = useRef(null);
  const typingTimerRef = useRef(null);
  const stateRef = useRef(state);
  const actionsRef = useRef(actions);
  const volumeRef = useRef(volume);

  const fullscreen = useFullscreen(videoWrapRef);

  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState(false); // the browser refused to start the sound
  const [playerError, setPlayerError] = useState(null);
  const [dragMs, setDragMs] = useState(null);
  const [showFsControls, setShowFsControls] = useState(true);
  const [collapsed, setCollapsedState] = useState(readCollapsed);
  const [typing, setTyping] = useState(false); // phones and tablets: hide while typing in the chat
  const [, setTick] = useState(0);

  stateRef.current = state;
  actionsRef.current = actions;
  volumeRef.current = volume;

  const isCollapsed = collapsed || typing;

  const setCollapsed = useCallback((value) => {
    setCollapsedState(value);
    try {
      localStorage.setItem(COLLAPSE_KEY, value ? '1' : '0');
    } catch {
      /* storage unavailable */
    }
  }, []);

  const showPlayer = useCallback(() => {
    setTyping(false);
    setCollapsed(false);
  }, [setCollapsed]);

  // The chat box tells us when you start and stop typing
  useEffect(() => {
    const small = window.matchMedia('(max-width: 1023px)');
    const onChatFocus = (e) => {
      clearTimeout(typingTimerRef.current);
      if (e.detail) {
        if (small.matches) setTyping(true);
      } else {
        typingTimerRef.current = setTimeout(() => setTyping(false), TYPING_RESTORE_MS);
      }
    };
    window.addEventListener('syncspace:chat-focus', onChatFocus);
    return () => {
      window.removeEventListener('syncspace:chat-focus', onChatFocus);
      clearTimeout(typingTimerRef.current);
    };
  }, []);

  // In full screen the controls show on mouse move / touch and hide again after a few seconds
  const wakeControls = useCallback(() => {
    setShowFsControls(true);
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowFsControls(false), FS_CONTROLS_HIDE_MS);
  }, []);

  useEffect(() => {
    if (fullscreen.active) wakeControls();
    else clearTimeout(hideTimerRef.current);
    return () => clearTimeout(hideTimerRef.current);
  }, [fullscreen.active, wakeControls]);

  // The browser may refuse to start sound on its own: then we ask for one tap
  const armGestureCheck = useCallback(() => {
    clearTimeout(gestureTimerRef.current);
    gestureTimerRef.current = setTimeout(() => {
      const p = playerRef.current;
      if (!p || !stateRef.current.playing) return;
      try {
        const ps = p.getPlayerState();
        if (ps !== 1 && ps !== 3) setBlocked(true);
      } catch {
        /* player not ready */
      }
    }, GESTURE_CHECK_MS);
  }, []);

  // Make the player match the room's state
  const reconcile = useCallback(() => {
    const p = playerRef.current;
    if (!p || !readyRef.current) return;
    const s = stateRef.current;
    const item = s.queue[s.index];

    try {
      if (!item) {
        if (loadedRef.current) p.stopVideo();
        loadedRef.current = null;
        return;
      }

      const expected = expectedPositionMs(s);

      if (loadedRef.current !== item.videoId) {
        loadedRef.current = item.videoId;
        setPlayerError(null);
        if (s.playing) {
          p.loadVideoById({ videoId: item.videoId, startSeconds: expected / 1000 });
          armGestureCheck();
        } else {
          p.cueVideoById({ videoId: item.videoId, startSeconds: expected / 1000 });
        }
        return;
      }

      const playerState = p.getPlayerState();
      const current = (p.getCurrentTime() || 0) * 1000;

      if (s.playing) {
        if (playerState !== 1 && playerState !== 3) p.playVideo();
        if (Math.abs(current - expected) > SEEK_TOLERANCE_MS) p.seekTo(expected / 1000, true);
        armGestureCheck();
      } else {
        if (playerState === 1 || playerState === 3) p.pauseVideo();
        if (Math.abs(current - expected) > 500) {
          if (playerState === 5 || playerState === -1 || playerState === 0) {
            p.cueVideoById({ videoId: item.videoId, startSeconds: expected / 1000 });
          } else {
            p.seekTo(expected / 1000, true);
          }
        }
      }
    } catch {
      /* the player is still starting up */
    }
  }, [armGestureCheck]);

  // Create the player once
  useEffect(() => {
    let cancelled = false;
    let player = null;
    const host = containerRef.current;
    if (!host) return undefined;

    host.innerHTML = '<div style="width:100%;height:100%"></div>';
    const target = host.firstElementChild;

    loadYouTubeApi().then((YT) => {
      if (cancelled) return;
      player = new YT.Player(target, {
        width: '100%',
        height: '100%',
        playerVars: {
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          playsinline: 1,
          modestbranding: 1,
          iv_load_policy: 3,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (e) => {
            if (cancelled) return;
            playerRef.current = e.target;
            readyRef.current = true;
            try {
              e.target.setVolume(volumeRef.current);
            } catch {
              /* ignore */
            }
            setReady(true);
          },
          onStateChange: (e) => {
            const PS = window.YT.PlayerState;
            if (e.data === PS.PLAYING) setBlocked(false);
            if (e.data === PS.ENDED) {
              const s = stateRef.current;
              const item = s.queue[s.index];
              // everyone reports it, the server only accepts the first report
              if (item && item.videoId === loadedRef.current) actionsRef.current.ended(item.id);
            }
          },
          onError: (e) => {
            const s = stateRef.current;
            const item = s.queue[s.index];
            setPlayerError(
              e.data === 101 || e.data === 150
                ? 'The owner does not allow this song to be played outside YouTube. Skipping it.'
                : 'This song could not be played. Skipping it.'
            );
            if (item && item.videoId === loadedRef.current) actionsRef.current.ended(item.id);
          },
        },
      });
    });

    return () => {
      cancelled = true;
      clearTimeout(gestureTimerRef.current);
      readyRef.current = false;
      playerRef.current = null;
      loadedRef.current = null;
      try {
        player?.destroy?.();
      } catch {
        /* ignore */
      }
    };
  }, []);

  // Every time the room's state changes
  useEffect(() => {
    reconcile();
  }, [state, ready, reconcile]);

  useEffect(() => {
    try {
      playerRef.current?.setVolume(volume);
    } catch {
      /* ignore */
    }
  }, [volume, ready]);

  // Keeps the progress bar moving
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, []);

  // Every few seconds: if we drifted from the room, jump back. Nothing is sent to the server.
  useEffect(() => {
    const id = setInterval(() => {
      const p = playerRef.current;
      if (!p || !readyRef.current) return;
      const s = stateRef.current;
      const item = s.queue[s.index];
      if (!item || !s.playing || loadedRef.current !== item.videoId) return;
      try {
        const ps = p.getPlayerState();
        if (ps === 3 || ps === -1 || ps === 5 || ps === 0) return;
        if (ps !== 1) {
          reconcile();
          return;
        }
        const expected = expectedPositionMs(s);
        const current = (p.getCurrentTime() || 0) * 1000;
        if (Math.abs(current - expected) > DRIFT_MS) p.seekTo(expected / 1000, true);
      } catch {
        /* ignore */
      }
    }, DRIFT_CHECK_MS);
    return () => clearInterval(id);
  }, [reconcile]);

  const item = state.queue[state.index];
  const durationMs = (item?.durationSec || 0) * 1000;
  const positionMs = dragMs ?? expectedPositionMs(state);
  const toggle = () => (state.playing ? actions.pause() : actions.play());
  const hasNext = state.index + 1 < state.queue.length;
  const statusText = !connected ? 'Reconnecting…' : state.playing ? 'Playing together' : 'Paused';

  const commitSeek = () => {
    if (dragMs === null) return;
    const target = dragMs;
    Promise.resolve(actions.seek(target)).finally(() => setDragMs(null));
  };

  const tapToListen = () => {
    try {
      playerRef.current?.playVideo();
    } catch {
      /* ignore */
    }
    setBlocked(false);
    reconcile();
  };

  const message = error || playerError;
  const needsTap = blocked && !!item && state.playing;

  return (
    <div className="shrink-0 border-t border-border bg-stage-raised">
      <div className={isCollapsed ? 'flex items-center gap-2 px-3 py-1.5' : 'flex'}>
        {/* The video player stays mounted when hidden, so the music keeps playing without a break */}
        <div
          ref={videoWrapRef}
          aria-hidden={isCollapsed}
          onMouseMove={fullscreen.active ? wakeControls : undefined}
          onTouchStart={fullscreen.active ? wakeControls : undefined}
          className={
            isCollapsed
              ? 'fixed -left-[9999px] top-0 h-[112px] w-[200px] bg-black'
              : 'relative min-h-[104px] w-[104px] shrink-0 self-stretch bg-black sm:min-h-[112px] sm:w-[200px]'
          }
        >
          <div ref={containerRef} className="absolute inset-0" />

          {item && fullscreen.supported && !isCollapsed && (
            <button
              type="button"
              onClick={fullscreen.toggle}
              aria-label={fullscreen.active ? 'Exit full screen' : 'Full screen'}
              title={fullscreen.active ? 'Exit full screen' : 'Full screen'}
              className="absolute right-1.5 top-1.5 z-30 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
            >
              {fullscreen.active ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>
          )}

          {!item && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black px-2 text-center">
              <Music className="h-6 w-6 text-ember" />
              <p className="hidden text-[11px] text-paper-muted sm:block">Nothing playing</p>
            </div>
          )}

          {item && (
            <button
              type="button"
              onClick={toggle}
              aria-label={state.playing ? 'Pause' : 'Play'}
              className="absolute inset-0"
            />
          )}

          {needsTap && (
            <button
              type="button"
              onClick={tapToListen}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 bg-black/75 text-white"
            >
              <Play className="h-7 w-7 fill-current" />
              <span className="text-xs font-semibold">Tap to listen</span>
            </button>
          )}

          {/* Controls shown on top of the video while it is full screen */}
          {fullscreen.active && item && (
            <div
              className={`absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 pb-4 pt-16 text-white transition-opacity duration-300 ${
                showFsControls ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
            >
              <p className="mb-2 truncate text-sm font-semibold">{item.title}</p>

              <input
                type="range"
                min={0}
                max={durationMs || 1}
                step={1000}
                value={Math.min(positionMs, durationMs || 1)}
                onChange={(e) => setDragMs(Number(e.target.value))}
                onPointerUp={commitSeek}
                onKeyUp={commitSeek}
                aria-label="Song position"
                className="h-1.5 w-full cursor-pointer accent-ember"
              />
              <div className="mt-1 flex justify-between text-xs text-white/80">
                <span>{formatDuration(positionMs / 1000)}</span>
                <span>{formatDuration(item.durationSec || 0)}</span>
              </div>

              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={actions.prev}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
                  aria-label="Previous song"
                >
                  <SkipBack className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={toggle}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-ember-gradient"
                  aria-label={state.playing ? 'Pause' : 'Play'}
                >
                  {state.playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
                </button>
                <button
                  type="button"
                  onClick={actions.next}
                  disabled={!hasNext}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 disabled:opacity-40"
                  aria-label="Next song"
                >
                  <SkipForward className="h-5 w-5" />
                </button>

                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setVolume(volume === 0 ? 80 : 0)}
                    aria-label={volume === 0 ? 'Unmute' : 'Mute'}
                  >
                    {volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    aria-label="Volume (only for you)"
                    className="h-1.5 w-24 cursor-pointer accent-ember"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {isCollapsed ? (
          /* Hidden: one thin bar, the music keeps playing */
          <>
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                !connected ? 'bg-red-400' : state.playing ? 'animate-pulse bg-ember' : 'bg-paper-muted'
              }`}
            />
            <Music className="h-4 w-4 shrink-0 text-ember" />
            <p className="min-w-0 flex-1 truncate text-xs font-medium text-paper">
              {item ? item.title : 'Nothing playing'}
            </p>
            {needsTap && (
              <button
                type="button"
                onClick={tapToListen}
                className="shrink-0 rounded-full bg-ember-gradient px-3 py-1 text-xs font-semibold text-white"
              >
                Tap to listen
              </button>
            )}
            <button type="button" onClick={actions.prev} disabled={!item} className={smallBtn} aria-label="Previous song">
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={toggle}
              disabled={!state.queue.length}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ember-gradient text-white disabled:opacity-40"
              aria-label={state.playing ? 'Pause' : 'Play'}
            >
              {state.playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
            </button>
            <button type="button" onClick={actions.next} disabled={!hasNext} className={smallBtn} aria-label="Next song">
              <SkipForward className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={showPlayer}
              className={smallBtn}
              aria-label="Show the player"
              title="Show the player"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={leaveMusic}
              className="shrink-0 rounded-full p-1 text-paper-muted hover:bg-white/10 hover:text-paper"
              aria-label="Stop and leave music"
              title="Stop and leave music"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          /* Shown: a compact player */
          <div className="flex min-w-0 flex-1 flex-col justify-between gap-1 overflow-hidden p-2 sm:p-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-paper-muted">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  !connected ? 'bg-red-400' : state.playing ? 'animate-pulse bg-ember' : 'bg-paper-muted'
                }`}
              />
              <span className="truncate">
                {statusText} · {room.name}
              </span>
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                className="ml-auto flex shrink-0 items-center gap-1 rounded-full px-2 py-1 normal-case text-paper-muted hover:bg-white/10 hover:text-paper"
                title="Hide the player (the music keeps playing)"
                aria-label="Hide the player"
              >
                <ChevronDown className="h-4 w-4" />
                <span className="text-xs">Hide</span>
              </button>
              <button
                type="button"
                onClick={leaveMusic}
                className="shrink-0 rounded-full p-1 text-paper-muted hover:bg-white/10 hover:text-paper"
                aria-label="Stop and leave music"
                title="Stop and leave music"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="truncate text-sm font-semibold text-paper">{item ? item.title : 'Nothing playing'}</p>

            <div className="flex items-center gap-2 text-[11px] text-paper-muted">
              <span className="w-9 shrink-0 text-right tabular-nums">{formatDuration(positionMs / 1000)}</span>
              <input
                type="range"
                min={0}
                max={durationMs || 1}
                step={1000}
                value={Math.min(positionMs, durationMs || 1)}
                disabled={!item}
                onChange={(e) => setDragMs(Number(e.target.value))}
                onPointerUp={commitSeek}
                onKeyUp={commitSeek}
                aria-label="Song position"
                className="h-1 min-w-0 flex-1 cursor-pointer accent-ember"
              />
              <span className="w-9 shrink-0 tabular-nums">{formatDuration(item?.durationSec || 0)}</span>
            </div>

            <div className="flex items-center gap-2">
              <button type="button" onClick={actions.prev} disabled={!item} className={roundBtn} aria-label="Previous song">
                <SkipBack className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={toggle}
                disabled={!state.queue.length}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ember-gradient text-white disabled:opacity-40"
                aria-label={state.playing ? 'Pause' : 'Play'}
              >
                {state.playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
              </button>
              <button type="button" onClick={actions.next} disabled={!hasNext} className={roundBtn} aria-label="Next song">
                <SkipForward className="h-4 w-4" />
              </button>

              <div className="ml-auto hidden items-center gap-2 sm:flex">
                <button
                  type="button"
                  onClick={() => setVolume(volume === 0 ? 80 : 0)}
                  className="text-paper-muted hover:text-paper"
                  aria-label={volume === 0 ? 'Unmute' : 'Mute'}
                >
                  {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  aria-label="Volume (only for you)"
                  className="h-1 w-24 cursor-pointer accent-ember"
                />
              </div>
            </div>

            {message && <p className="truncate text-xs text-red-400">{message}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

// Only exists while we are listening in a music room
export default function MusicDock() {
  const { room } = useMusic();
  if (!room) return null;
  return <DockBody key={room.id} />;
}