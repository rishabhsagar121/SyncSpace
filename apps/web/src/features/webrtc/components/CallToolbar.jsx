import { Loader2, LogOut, Mic, MicOff, PhoneOff, ScreenShare, ScreenShareOff, Video, VideoOff } from 'lucide-react';

const base = 'grid shrink-0 place-items-center rounded-full transition-colors disabled:opacity-50';

// The full round toolbar, shown at the bottom of the People tab
export default function CallToolbar({ call, onLeaveRoom }) {
  const { joined, muted, cameraOn, sharing, connecting, error } = call;
  const canShare = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia;

  const btn = `${base} h-11 w-11`;
  const normal = `${btn} bg-white/5 text-paper hover:bg-white/10`;
  const off = `${btn} bg-violet-500/25 text-violet-300 hover:bg-violet-500/35`;

  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5">
      {error && <p className="max-w-full px-2 text-center text-xs text-red-400">{error}</p>}

      <div className="flex items-center gap-2 rounded-full bg-stage-overlay px-2 py-2 shadow-card ring-1 ring-white/10">
        <button
          type="button"
          onClick={onLeaveRoom}
          className={`${btn} bg-white/5 text-paper hover:bg-red-500/20 hover:text-red-300`}
          aria-label="Leave the room"
          title="Leave the room"
        >
          <LogOut className="h-5 w-5" />
        </button>

        {joined ? (
          <button
            type="button"
            onClick={call.toggleMute}
            className={muted ? off : normal}
            aria-label={muted ? 'Unmute' : 'Mute'}
            title={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
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
            {connecting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mic className="h-5 w-5" />}
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
            {cameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
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
            <Video className="h-5 w-5" />
          </button>
        )}

        {joined && canShare && (
          <button
            type="button"
            onClick={call.toggleShare}
            className={sharing ? `${btn} bg-ember/25 text-ember` : normal}
            aria-label={sharing ? 'Stop sharing' : 'Share screen'}
            title={sharing ? 'Stop sharing' : 'Share screen'}
          >
            {sharing ? <ScreenShareOff className="h-5 w-5" /> : <ScreenShare className="h-5 w-5" />}
          </button>
        )}

        {joined && (
          <button
            type="button"
            onClick={call.leaveCall}
            className={`${btn} bg-red-500/90 text-white hover:bg-red-500`}
            aria-label="Leave the call"
            title="Leave the call"
          >
            <PhoneOff className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}

// Small call buttons placed next to the tabs while the chat is open: they take almost no space
export function CallMiniControls({ call }) {
  const { joined, muted, cameraOn, connecting } = call;

  const btn = `${base} h-9 w-9`;
  const normal = `${btn} bg-stage-raised text-paper hover:bg-white/10`;
  const off = `${btn} bg-violet-500/25 text-violet-300 hover:bg-violet-500/35`;

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {joined ? (
        <button
          type="button"
          onClick={call.toggleMute}
          className={muted ? off : normal}
          aria-label={muted ? 'Unmute' : 'Mute'}
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
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
          {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
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
          {cameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
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
          <Video className="h-4 w-4" />
        </button>
      )}

      {joined && (
        <button
          type="button"
          onClick={call.leaveCall}
          className={`${btn} bg-red-500/90 text-white hover:bg-red-500`}
          aria-label="Leave the call"
          title="Leave the call"
        >
          <PhoneOff className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}