// apps/web/src/features/sync/components/StreamRoomPlayer.jsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { FileVideo, Loader2, Maximize, Minimize, Pause, Play, Radio, Users, Volume2, VolumeX } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useFullscreen } from '@/hooks/useFullscreen';
import { formatDuration } from '@/features/music/format';
import { useStreamRoom } from '../hooks/useStreamRoom';

const CONTROLS_HIDE_MS = 3000;

function ViewerPlayer({ stream, playback, connState, hostName, onCommand, onRetry }) {
  const wrapRef = useRef(null);
  const videoRef = useRef(null);
  const hideRef = useRef(null);
  const fullscreen = useFullscreen(wrapRef);

  const [volume, setVolume] = useState(80);
  const [needsTap, setNeedsTap] = useState(false);
  const [dragMs, setDragMs] = useState(null);
  const [showControls, setShowControls] = useState(true);
  const [, setTick] = useState(0);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.srcObject !== stream) v.srcObject = stream || null;
    if (stream) {
      Promise.resolve(v.play())
        .then(() => setNeedsTap(false))
        .catch(() => setNeedsTap(true));
    }
  }, [stream]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = volume / 100;
  }, [volume]);

  // keeps the time and the seek bar moving between updates
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => () => clearTimeout(hideRef.current), []);

  const wake = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideRef.current);
    hideRef.current = setTimeout(() => setShowControls(false), CONTROLS_HIDE_MS);
  }, []);

  const playing = !!playback?.playing;
  const durationMs = playback?.durationMs || 0;
  const livePosition = playback
    ? Math.min(durationMs || Infinity, playback.positionMs + (playing ? Date.now() - playback.receivedAt : 0))
    : 0;
  const positionMs = dragMs ?? livePosition;
  const visible = showControls || !playing || dragMs !== null;
  const ready = connState === 'connected' && !!playback;

  const toggle = () => onCommand({ t: playing ? 'pause' : 'play' });

  const commitSeek = () => {
    if (dragMs === null) return;
    onCommand({ t: 'seek', positionMs: dragMs });
    setTimeout(() => setDragMs(null), 800); // until the new position comes back
  };

  return (
    <div
      ref={wrapRef}
      onMouseMove={wake}
      onTouchStart={wake}
      className="surface relative aspect-video w-full overflow-hidden rounded-lg bg-black sm:rounded-xl2"
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        onClick={ready ? toggle : undefined}
        className="h-full w-full bg-black object-contain"
      />

      {connState === 'connecting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 text-white">
          <Loader2 className="h-7 w-7 animate-spin" />
          <p className="text-sm">Connecting to {hostName}…</p>
        </div>
      )}

      {connState === 'failed' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 px-4 text-center text-white">
          <p className="text-sm">The connection to {hostName} was lost or could not be made.</p>
          <Button size="sm" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}

      {needsTap && connState === 'connected' && (
        <button
          type="button"
          onClick={() => {
            videoRef.current?.play?.();
            setNeedsTap(false);
          }}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/75 text-white"
        >
          <Play className="h-9 w-9 fill-current" />
          <span className="text-sm font-semibold">Tap to watch</span>
        </button>
      )}

      <div
        className={`absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-3 pb-3 pt-12 text-white transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <input
          type="range"
          min={0}
          max={durationMs || 1}
          step={1000}
          value={Math.min(positionMs, durationMs || 1)}
          disabled={!ready}
          onChange={(e) => setDragMs(Number(e.target.value))}
          onPointerUp={commitSeek}
          onKeyUp={commitSeek}
          aria-label="Movie position"
          className="h-1.5 w-full cursor-pointer accent-ember"
        />
        <div className="mt-1 flex items-center gap-3">
          <button
            type="button"
            onClick={toggle}
            disabled={!ready}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ember-gradient disabled:opacity-40"
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
          </button>
          <span className="text-xs text-white/85">
            {formatDuration(positionMs / 1000)} / {formatDuration(durationMs / 1000)}
          </span>

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
              className="hidden h-1.5 w-20 cursor-pointer accent-ember sm:block"
            />
            {fullscreen.supported && (
              <button
                type="button"
                onClick={fullscreen.toggle}
                aria-label={fullscreen.active ? 'Exit full screen' : 'Full screen'}
              >
                {fullscreen.active ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StreamRoomPlayer({ roomId, currentUserId, members = [] }) {
  const inputRef = useRef(null);
  const s = useStreamRoom(roomId, currentUserId);

  const nameOf = (userId) => {
    const m = members.find((x) => (x.userId ?? x.user?.id) === userId);
    return m?.user?.profile?.displayName || m?.user?.username || 'Someone';
  };
  const hostName = nameOf(s.info?.hostId);

  const choose = () => inputRef.current?.click();
  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) s.startFile(file);
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="video/*,.mkv,.mp4,.webm,.mov,.m4v"
        className="hidden"
        onChange={onFile}
      />

      {/* The person streaming: a normal player with its own controls */}
      {s.role === 'host' && (
        <>
          <div className="surface relative aspect-video w-full overflow-hidden rounded-lg bg-black sm:rounded-xl2">
            <video
              ref={s.hostVideoRef}
              src={s.hostUrl || undefined}
              controls
              playsInline
              preload="metadata"
              className="h-full w-full bg-black"
              onLoadedMetadata={s.onHostLoaded}
              onPlay={s.onHostStateChange}
              onPause={s.onHostStateChange}
              onSeeked={s.onHostStateChange}
              onError={s.onHostError}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-paper-muted">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ember/10 px-2.5 py-1 text-ember">
              <Radio className="h-3.5 w-3.5" /> Streaming
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {s.viewerCount} watching
            </span>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="secondary" onClick={choose}>
                Change movie
              </Button>
              <Button size="sm" variant="danger" onClick={s.stopStreaming}>
                Stop streaming
              </Button>
            </div>
          </div>
          <p className="text-xs text-paper-muted">
            Everyone in the room can play, pause and skip. Keep this tab open while you stream. Use headphones, and
            mute your mic in the voice call, or the movie sound will echo for everyone.
          </p>
        </>
      )}

      {/* A viewer */}
      {s.role === 'viewer' && (
        <>
          <ViewerPlayer
            stream={s.remoteStream}
            playback={s.playback}
            connState={s.connState}
            hostName={hostName}
            onCommand={s.sendCommand}
            onRetry={s.joinStream}
          />
          <div className="flex flex-wrap items-center gap-2 text-xs text-paper-muted">
            <span className="min-w-0 truncate">
              Watching &ldquo;{s.info?.title}&rdquo; from {hostName} &middot; use headphones to avoid echo
            </span>
            <div className="ml-auto">
              <Button size="sm" variant="ghost" onClick={s.leaveViewing}>
                Stop watching
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Nobody is streaming yet, or you have not joined */}
      {s.role === 'none' && (
        <div className="surface flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-lg px-4 text-center sm:rounded-xl2">
          {s.info ? (
            <>
              <Radio className="h-9 w-9 text-ember" />
              <p className="font-display font-bold text-paper">{hostName} is streaming</p>
              <p className="max-w-sm break-words text-sm text-paper-muted">&ldquo;{s.info.title}&rdquo;</p>
              <Button size="sm" onClick={s.joinStream}>
                <Play className="h-4 w-4 fill-current" /> Watch now
              </Button>
            </>
          ) : (
            <>
              <FileVideo className="h-9 w-9 text-ember" />
              <p className="font-display font-bold text-paper">Stream a movie to the room</p>
              <p className="max-w-sm text-sm text-paper-muted">
                Choose a movie file on your computer. Everyone in the room watches it live, and anyone can play,
                pause and skip. Only you need the file.
              </p>
              <Button size="sm" onClick={choose}>
                Choose movie file
              </Button>
            </>
          )}
        </div>
      )}

      {s.notice && <p className="text-sm text-paper-muted">{s.notice}</p>}
      {s.error && <p className="text-sm text-red-400">{s.error}</p>}
    </div>
  );
}