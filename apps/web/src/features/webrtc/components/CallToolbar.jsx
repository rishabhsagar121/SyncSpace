import { Loader2, LogOut, Mic, MicOff, PhoneOff, ScreenShare, ScreenShareOff, Video, VideoOff } from 'lucide-react';

// The round toolbar at the bottom of the room panel. compact: smaller buttons, used on the Chat tab.
export default function CallToolbar({ call, onLeaveRoom, compact = false }) {
  const { joined, muted, cameraOn, sharing, connecting, error } = call;
  const canShare = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia;

  const size = compact ? 'h-9 w-9' : 'h-11 w-11';
  const icon = compact ? 'h-4 w-4' : 'h-5 w-5';
  const base = `grid ${size} shrink-0 place-items-center rounded-full transition-colors disabled:opacity-50`;
  const normal = `${base} bg-white/5 text-paper hover:bg-white/10`;
  const off = `${base} bg-violet-500/25 text-violet-300 hover:bg-violet-500/35`;

  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5">
      {error && <p className="max-w-full px-2 text-center text-xs text-red-400">{error}</p>}

      <div
        className={`flex items-center gap-2 rounded-full bg-stage-overlay shadow-card ring-1 ring-white/10 ${
          compact ? 'px-1.5 py-1.5' : 'px-2 py-2'
        }`}
      >
        <button
          type="button"
          onClick={onLeaveRoom}
          className={`${base} bg-white/5 text-paper hover:bg-red-500/20 hover:text-red-300`}
          aria-label="Leave the room"
          title="Leave the room"
        >
          <LogOut className={icon} />
        </button>

        {joined ? (
          <button
            type="button"
            onClick={call.toggleMute}
            className={muted ? off : normal}
            aria-label={muted ? 'Unmute' : 'Mute'}
            title={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <MicOff className={icon} /> : <Mic className={icon} />}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => call.joinCall({ video: false })}
            disabled={connecting}
            className={normal}
            aria-label="Join voice"
            title="Join voice"
          >
            {connecting ? <Loader2 className={`${icon} animate-spin`} /> : <Mic className={icon} />}
          </button>
        )}

        {joined ? (
          <button
            type="button"
            onClick={call.toggleCamera}
            className={cameraOn ? normal : off}
            aria-label={cameraOn ? 'Turn camera off' : 'Turn camera on'}
            title={cameraOn ? 'Turn camera off' : 'Turn camera on'}
          >
            {cameraOn ? <Video className={icon} /> : <VideoOff className={icon} />}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => call.joinCall({ video: true })}
            disabled={connecting}
            className={normal}
            aria-label="Join with video"
            title="Join with video"
          >
            <Video className={icon} />
          </button>
        )}

        {joined && canShare && (
          <button
            type="button"
            onClick={call.toggleShare}
            className={sharing ? `${base} bg-ember/25 text-ember` : normal}
            aria-label={sharing ? 'Stop sharing' : 'Share screen'}
            title={sharing ? 'Stop sharing' : 'Share screen'}
          >
            {sharing ? <ScreenShareOff className={icon} /> : <ScreenShare className={icon} />}
          </button>
        )}

        {joined && (
          <button
            type="button"
            onClick={call.leaveCall}
            className={`${base} bg-red-500/90 text-white hover:bg-red-500`}
            aria-label="Leave the call"
            title="Leave the call"
          >
            <PhoneOff className={icon} />
          </button>
        )}
      </div>
    </div>
  );
}