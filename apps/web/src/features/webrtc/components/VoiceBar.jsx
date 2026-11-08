// apps/web/src/features/webrtc/components/VoiceBar.jsx
import { useState } from 'react';
import { Mic, MicOff, PhoneCall, PhoneOff, ScreenShare, ScreenShareOff, Users, Video, VideoOff } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useVoiceCall } from '../hooks/useVoiceCall';
import CallTile from './CallTile';

const iconBtn = (active) =>
  `flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
    active ? 'bg-ember-dim text-white' : 'bg-stage-overlay text-paper hover:bg-white/10'
  }`;

// `members` is optional: the room's member list, used to show real names on the tiles.
export default function VoiceBar({ roomId, currentUserId, members = [] }) {
  const call = useVoiceCall(roomId, currentUserId);
  const { joined, muted, cameraOn, sharing, connecting, error, remotes, localStream } = call;
  const [pinnedId, setPinnedId] = useState(null);

  const canShareScreen = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia;

  const nameOf = (userId) => {
    const m = members.find((x) => (x.userId ?? x.user?.id ?? x.id) === userId);
    const u = m?.user ?? m;
    return u?.profile?.displayName || u?.displayName || u?.username || 'Participant';
  };

  const tiles = [
    {
      id: 'me',
      isLocal: true,
      label: 'You',
      stream: localStream,
      showVideo: cameraOn || sharing,
      sharing,
      muted,
    },
    ...Object.entries(remotes).map(([peerId, r]) => ({
      id: peerId,
      isLocal: false,
      label: nameOf(peerId),
      stream: r.stream,
      showVideo: r.video,
      sharing: r.sharing,
      muted: r.muted,
    })),
  ];

  const pinned = tiles.find((t) => t.id === pinnedId);
  const others = pinned ? tiles.filter((t) => t.id !== pinned.id) : tiles;
  const renderTile = (t) => (
    <CallTile key={t.id} {...t} pinned={pinnedId === t.id} onPin={() => setPinnedId(pinnedId === t.id ? null : t.id)} />
  );

  return (
    <div className="space-y-3">
      <div className="surface flex flex-wrap items-center justify-between gap-2 rounded-xl2 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-paper-muted">
          <Users className="h-4 w-4" />
          {joined ? `In call · ${call.peerCount + 1} connected` : 'Voice & video'}
        </div>

        <div className="flex items-center gap-2">
          {joined ? (
            <>
              <button onClick={call.toggleMute} className={iconBtn(muted)} aria-label={muted ? 'Unmute' : 'Mute'}>
                {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <button
                onClick={call.toggleCamera}
                className={iconBtn(!cameraOn)}
                aria-label={cameraOn ? 'Turn camera off' : 'Turn camera on'}
              >
                {cameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              </button>
              {canShareScreen && (
                <button
                  onClick={call.toggleShare}
                  className={iconBtn(sharing)}
                  aria-label={sharing ? 'Stop sharing' : 'Share screen'}
                >
                  {sharing ? <ScreenShareOff className="h-4 w-4" /> : <ScreenShare className="h-4 w-4" />}
                </button>
              )}
              <Button variant="danger" size="sm" onClick={call.leaveCall}>
                <PhoneOff className="h-4 w-4" /> Leave
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" size="sm" onClick={() => call.joinCall({ video: false })} isLoading={connecting}>
                <PhoneCall className="h-4 w-4" /> Join voice
              </Button>
              <Button size="sm" onClick={() => call.joinCall({ video: true })} disabled={connecting}>
                <Video className="h-4 w-4" /> Join video
              </Button>
            </>
          )}
        </div>
      </div>

      {error && <p className="px-1 text-xs text-red-400">{error}</p>}

      {joined &&
        (pinned ? (
          <div className="space-y-2">
            {renderTile(pinned)}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{others.map(renderTile)}</div>
          </div>
        ) : (
          <div className={`grid gap-2 ${tiles.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} ${tiles.length > 4 ? 'lg:grid-cols-3' : ''}`}>
            {tiles.map(renderTile)}
          </div>
        ))}
    </div>
  );
}