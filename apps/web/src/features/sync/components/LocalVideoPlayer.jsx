// apps/web/src/features/sync/components/LocalVideoPlayer.jsx
import { useRef } from 'react';
import { AlertCircle, FileVideo, Play, RefreshCw } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useLocalVideoSync } from '../hooks/useLocalVideoSync';

const formatSize = (bytes) =>
  bytes >= 1e9 ? `${(bytes / 1e9).toFixed(2)} GB` : `${Math.max(1, Math.round(bytes / 1e6))} MB`;

export default function LocalVideoPlayer({ roomId, currentUserId }) {
  const inputRef = useRef(null);
  const intentRef = useRef('auto');
  const s = useLocalVideoSync(roomId, currentUserId);

  const choose = (intent) => {
    intentRef.current = intent;
    inputRef.current?.click();
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    // the first file, or "Change movie", becomes the movie for everyone
    const forEveryone = intentRef.current === 'replace' || !s.expected;
    intentRef.current = 'auto';
    s.attachFile(file, { announce: forEveryone });
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

      <div className="surface relative aspect-video w-full overflow-hidden rounded-lg bg-black sm:rounded-xl2">
        {s.videoUrl ? (
          <video
            ref={s.videoRef}
            src={s.videoUrl}
            controls
            playsInline
            preload="metadata"
            className="h-full w-full bg-black"
            onPlay={s.onPlay}
            onPause={s.onPause}
            onSeeked={s.onSeeked}
            onLoadedMetadata={s.onLoadedMetadata}
            onError={s.onError}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
            <FileVideo className="h-9 w-9 text-ember" />
            {s.expected ? (
              <>
                <p className="font-display font-bold text-paper">Pick the same movie file as everyone else</p>
                <p className="max-w-sm break-words text-sm text-paper-muted">
                  &ldquo;{s.expected.name}&rdquo; &middot; {formatSize(s.expected.size)}
                </p>
                <Button size="sm" onClick={() => choose('auto')}>
                  Choose the file
                </Button>
                <button
                  type="button"
                  onClick={() => choose('replace')}
                  className="text-xs text-paper-muted underline hover:text-paper"
                >
                  Or choose a different movie for everyone
                </button>
              </>
            ) : (
              <>
                <p className="font-display font-bold text-paper">Choose a movie file</p>
                <p className="max-w-sm text-sm text-paper-muted">
                  Everyone in the room picks the same file from their own device. Nothing is uploaded, and play, pause
                  and skipping stay in sync.
                </p>
                <Button size="sm" onClick={() => choose('replace')}>
                  Choose movie file
                </Button>
              </>
            )}
          </div>
        )}

        {s.needsTap && (
          <button
            type="button"
            onClick={s.tapToPlay}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/75 text-white"
          >
            <Play className="h-9 w-9 fill-current" />
            <span className="text-sm font-semibold">Tap to play</span>
          </button>
        )}
      </div>

      {s.videoUrl && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-paper-muted">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
              s.synced ? 'bg-ember/10 text-ember' : 'bg-stage-overlay'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${s.synced ? 'bg-ember' : 'bg-paper-muted'}`} />
            {s.synced ? 'In sync' : 'Not synced'}
          </span>
          <span className="min-w-0 max-w-[50%] truncate">{s.loaded?.name}</span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="ghost" onClick={s.resync}>
              <RefreshCw className="h-3.5 w-3.5" /> Resync
            </Button>
            <Button size="sm" variant="secondary" onClick={() => choose('replace')}>
              Change movie
            </Button>
          </div>
        </div>
      )}

      {s.mismatch && s.expected && s.loaded && (
        <div className="surface rounded-xl2 p-3 text-sm">
          <p className="flex items-start gap-2 text-paper">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-ember" />
            <span className="break-words">
              The room is watching &ldquo;{s.expected.name}&rdquo; ({formatSize(s.expected.size)}), but your file is
              &ldquo;{s.loaded.name}&rdquo;. Your video is not synced.
            </span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => choose('auto')}>
              Choose the right file
            </Button>
            <Button size="sm" variant="ghost" onClick={s.acceptAnyway}>
              Use my file anyway
            </Button>
            <Button size="sm" variant="ghost" onClick={s.announceCurrent}>
              Make mine the movie for everyone
            </Button>
          </div>
        </div>
      )}

      {s.lengthWarning && !s.mismatch && (
        <p className="flex items-start gap-2 text-xs text-paper-muted">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Your file is a different length than the one this room started with. Playback may not line up.
        </p>
      )}

      {s.playError && <p className="text-sm text-red-400">{s.playError}</p>}
    </div>
  );
}