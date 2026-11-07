// apps/web/src/features/sync/components/YouTubePlayer.jsx
import { useEffect, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';

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

const POLL_MS = 500;
const SEEK_JUMP_PLAYING_S = 1.5; // time jump that counts as a skip while playing
const SEEK_JUMP_PAUSED_S = 0.5; // time jump that counts as a skip while paused

export default function YouTubePlayer({ videoId, onRegister, onPlay, onPause, onSeek }) {
  const containerRef = useRef(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Always call the newest handlers, even though the player is created once per video
  const handlersRef = useRef({ onRegister, onPlay, onPause, onSeek });
  useEffect(() => {
    handlersRef.current = { onRegister, onPlay, onPause, onSeek };
  });

  useEffect(() => {
    let cancelled = false;
    let player = null;
    let poll = null;
    setErrorMsg(null);

    if (!containerRef.current || !videoId) return;

    // Fresh target element so YouTube can safely attach the iframe
    containerRef.current.innerHTML = '<div id="yt-player-target" style="width: 100%; height: 100%;"></div>';
    const targetElement = containerRef.current.firstElementChild;

    loadYouTubeApi().then((YT) => {
      if (cancelled || !targetElement) return;

      try {
        player = new YT.Player(targetElement, {
          width: '100%',
          height: '100%',
          videoId,
          playerVars: {
            autoplay: 1,
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              if (cancelled) return;
              const p = event.target;

              handlersRef.current.onRegister?.({
                play: () => {
                  try {
                    p.playVideo();
                  } catch {}
                },
                pause: () => {
                  try {
                    p.pauseVideo();
                  } catch {}
                },
                seekTo: (seconds) => {
                  try {
                    p.seekTo(seconds, true);
                  } catch {}
                },
                getState: () => {
                  try {
                    return {
                      positionMs: Math.round((p.getCurrentTime?.() || 0) * 1000),
                      playing: p.getPlayerState?.() === 1,
                    };
                  } catch {
                    return { positionMs: 0, playing: false };
                  }
                },
              });

              // Detect skips (the iframe gives no seek event): watch the time position
              let lastTime = null;
              let lastWall = 0;
              let lastPlaying = false;
              poll = setInterval(() => {
                try {
                  const state = p.getPlayerState?.();
                  const playing = state === 1;
                  const paused = state === 2;
                  const now = Date.now();

                  // Buffering, cued, etc.: start measuring again afterwards
                  if (!playing && !paused) {
                    lastTime = null;
                    return;
                  }

                  const current = p.getCurrentTime?.() || 0;
                  if (lastTime !== null && playing === lastPlaying) {
                    const expected = playing ? lastTime + (now - lastWall) / 1000 : lastTime;
                    const limit = playing ? SEEK_JUMP_PLAYING_S : SEEK_JUMP_PAUSED_S;
                    if (Math.abs(current - expected) > limit) {
                      handlersRef.current.onSeek?.(Math.round(current * 1000));
                    }
                  }
                  lastTime = current;
                  lastWall = now;
                  lastPlaying = playing;
                } catch {}
              }, POLL_MS);
            },
            onStateChange: (e) => {
              if (cancelled || !player) return;
              try {
                const positionMs = Math.round((player.getCurrentTime?.() || 0) * 1000);
                // Only real play/pause changes: buffering (3) and the rest are ignored
                if (e.data === window.YT.PlayerState.PLAYING) handlersRef.current.onPlay?.(positionMs);
                else if (e.data === window.YT.PlayerState.PAUSED) handlersRef.current.onPause?.(positionMs);
              } catch {}
            },
            onError: (e) => {
              if (e.data === 150 || e.data === 101) {
                setErrorMsg('The owner of this video has disabled playback in third-party embedded players. Please try another video!');
              } else if (e.data === 100) {
                setErrorMsg('Video not found or has been marked private.');
              } else {
                setErrorMsg('Could not load this video. Please check the link.');
              }
            },
          },
        });
      } catch (err) {
        console.error('Failed to create YouTube player:', err);
      }
    });

    return () => {
      cancelled = true;
      clearInterval(poll);
      // Tell the sync code this player is gone so it never talks to a dead player
      handlersRef.current.onRegister?.(null);
      try {
        player?.destroy?.();
      } catch {}
    };
  }, [videoId]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl2 bg-black">
      {errorMsg ? (
        <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center text-paper">
          <AlertCircle className="h-10 w-10 text-ember-hot" />
          <p className="mt-3 font-semibold text-paper">{errorMsg}</p>
          <p className="mt-1 text-xs text-paper-muted">Try pasting a different public YouTube video link below.</p>
        </div>
      ) : (
        <div ref={containerRef} className="h-full w-full" />
      )}
    </div>
  );
}