import { useState } from 'react';
import CallTile from './CallTile';

// Video tiles of the call. People without a camera are not shown here, but their tile stays
// mounted out of sight, because that element is what plays their voice.
export default function CallStage({ call, members = [] }) {
  const { joined, muted, cameraOn, sharing, remotes, localStream } = call;
  const [pinnedId, setPinnedId] = useState(null);

  if (!joined) return null;

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

  const visible = tiles.filter((t) => t.showVideo).length;

  return (
    <div className={`relative mb-3 grid gap-2 ${visible > 1 ? 'grid-cols-2' : 'grid-cols-1'} ${visible === 0 ? 'hidden' : ''}`}>
      {tiles.map((t) => (
        <div
          key={t.id}
          className={
            t.showVideo
              ? pinnedId === t.id
                ? 'col-span-2'
                : ''
              : 'pointer-events-none absolute h-px w-px overflow-hidden opacity-0'
          }
        >
          <CallTile
            {...t}
            pinned={pinnedId === t.id}
            onPin={() => setPinnedId(pinnedId === t.id ? null : t.id)}
          />
        </div>
      ))}
    </div>
  );
}