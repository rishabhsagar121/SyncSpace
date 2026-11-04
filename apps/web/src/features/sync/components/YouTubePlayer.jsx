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

export default function YouTubePlayer({ videoId, onRegister, onPlay, onPause, onSeek }) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const seekingRef = useRef(false);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let player = null;
    setErrorMsg(null);

    if (!containerRef.current || !videoId) return;

    // Reset container with fresh target element so YouTube can safely attach the iframe
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
              playerRef.current = event.target;
              onRegister?.({
                play: () => {
                  try {
                    event.target.playVideo();
                  } catch {}
                },
                pause: () => {
                  try {
                    event.target.pauseVideo();
                  } catch {}
                },
                seekTo: (seconds) => {
                  try {
                    seekingRef.current = true;
                    event.target.seekTo(seconds, true);
                  } catch {}
                },
                getState: () => {
                  try {
                    return {
                      positionMs: Math.round((event.target.getCurrentTime?.() || 0) * 1000),
                      playing: event.target.getPlayerState?.() === 1,
                    };
                  } catch {
                    return { positionMs: 0, playing: false };
                  }
                },
              });
            },
            onStateChange: (e) => {
              if (cancelled || !playerRef.current) return;
              try {
                const positionMs = Math.round((playerRef.current.getCurrentTime?.() || 0) * 1000);
                if (seekingRef.current) {
                  seekingRef.current = false;
                  onSeek?.(positionMs);
                  return;
                }
                if (e.data === window.YT.PlayerState.PLAYING) onPlay?.(positionMs);
                if (e.data === window.YT.PlayerState.PAUSED) onPause?.(positionMs);
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
      try {
        player?.destroy?.();
      } catch {}
      playerRef.current = null;
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
