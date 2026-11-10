// apps/web/src/features/webrtc/components/CallTile.jsx
import { useEffect, useRef } from 'react';
import { Maximize, MicOff, Minimize, Pin, PinOff, ScreenShare } from 'lucide-react';
import { useFullscreen } from '@/hooks/useFullscreen';

export default function CallTile({ stream, label, showVideo, muted, sharing, isLocal, pinned, onPin }) {
  const videoRef = useRef(null);
  const tileRef = useRef(null);
  const fullscreen = useFullscreen(tileRef);

  // The <video> element also plays the person's audio, so it must stay mounted while in the call
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream || null;
    if (stream) el.play?.().catch(() => {});
  }, [stream]);

  const initial = (label || '?').trim().charAt(0).toUpperCase() || '?';

  // iPhone can only open a <video> element itself in full screen
  const iosVideoFullscreen =
    typeof HTMLVideoElement !== 'undefined' && 'webkitEnterFullscreen' in HTMLVideoElement.prototype;
  const canFullscreen = showVideo && (fullscreen.supported || iosVideoFullscreen);

  const toggleFullscreen = () => {
    if (fullscreen.supported) fullscreen.toggle();
    else videoRef.current?.webkitEnterFullscreen?.();
  };

  const buttonVisibility = 'opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100';

  return (
    <div
      ref={tileRef}
      className={`group relative aspect-video overflow-hidden bg-stage-overlay ${
        fullscreen.active ? 'rounded-none bg-black' : 'rounded-xl'
      }`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal} // never play my own microphone back to me
        className={`h-full w-full ${sharing || fullscreen.active ? 'object-contain bg-black' : 'object-cover'} ${
          isLocal && !sharing ? '-scale-x-100' : ''
        } ${showVideo ? '' : 'invisible'}`}
      />

      {!showVideo && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-white/10 text-xl font-semibold text-paper">
            {initial}
          </div>
        </div>
      )}

      <div className="absolute bottom-2 left-2 flex max-w-[80%] items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white">
        {sharing && <ScreenShare className="h-3 w-3 shrink-0" />}
        {muted && <MicOff className="h-3 w-3 shrink-0 text-red-400" />}
        <span className="truncate">{label}</span>
      </div>

      {canFullscreen && (
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={fullscreen.active ? 'Exit full screen' : 'Full screen'}
          title={fullscreen.active ? 'Exit full screen' : 'Full screen'}
          className={`absolute right-12 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white ${
            fullscreen.active ? 'opacity-100' : buttonVisibility
          }`}
        >
          {fullscreen.active ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </button>
      )}

      <button
        type="button"
        onClick={onPin}
        aria-label={pinned ? 'Unpin' : 'Pin'}
        className={`absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white ${buttonVisibility}`}
      >
        {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
      </button>
    </div>
  );
}