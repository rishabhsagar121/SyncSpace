import { useMemo, useState } from 'react';
import { Copy, Mic, MicOff, Users } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import ChatPanel from '@/features/chat/components/ChatPanel';
import CallStage from '@/features/webrtc/components/CallStage';
import CallToolbar from '@/features/webrtc/components/CallToolbar';
import { useProfileCard } from '@/features/profile/ProfileCardProvider';

const GRADIENTS = {
  MUSIC: 'from-emerald-500 via-green-500 to-teal-500',
  DEFAULT: 'from-fuchsia-500 via-purple-500 to-indigo-500',
};

function PersonTile({ member, label, mic, online, size, onOpen }) {
  const u = member.user || {};
  const name = u.profile?.displayName || u.username || 'Member';
  return (
    <button
      type="button"
      onClick={() => onOpen(member)}
      title={`View ${name}'s profile`}
      className={`flex min-w-0 flex-col items-center gap-1 rounded-xl p-1 text-center transition-colors hover:bg-white/5 ${
        online ? '' : 'opacity-55'
      }`}
    >
      <span className="relative">
        <Avatar name={u.username} src={u.profile?.avatarUrl} size={size} live={online} />
        {mic && (
          <span
            className={`absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full ring-2 ring-stage-raised ${
              mic === 'muted' ? 'bg-violet-500/30 text-violet-200' : 'bg-stage-overlay text-paper'
            }`}
          >
            {mic === 'muted' ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
          </span>
        )}
      </span>
      <span className="w-full truncate text-xs font-medium text-paper">{name}</span>
      {label && <span className="-mt-0.5 text-[11px] text-violet-300">{label}</span>}
    </button>
  );
}

export default function RoomPanel({ room, currentUserId, onlineIds, call, onLeaveRoom, onCopyCode, copied }) {
  const [tab, setTab] = useState('people');
  const { openProfile } = useProfileCard();

  const isOnline = (userId) => userId === currentUserId || onlineIds.has(userId);
  const onlineCount = room.members.filter((m) => isOnline(m.userId)).length;
  const gradient = GRADIENTS[room.mode] || GRADIENTS.DEFAULT;

  const micOf = (userId) => {
    if (userId === currentUserId) return call.joined ? (call.muted ? 'muted' : 'on') : null;
    const r = call.remotes[userId];
    return r ? (r.muted ? 'muted' : 'on') : null;
  };

  const inCall = (userId) => (userId === currentUserId ? call.joined : !!call.remotes[userId]);

  const { stage, audience } = useMemo(() => {
    const rank = { HOST: 0, CO_HOST: 1, MEMBER: 2 };
    const byRole = [...room.members].sort((a, b) => (rank[a.role] ?? 2) - (rank[b.role] ?? 2));
    const onStage = [];
    const rest = [];
    byRole.forEach((m) => {
      if (m.role !== 'MEMBER' || inCall(m.userId)) onStage.push(m);
      else rest.push(m);
    });
    rest.sort((a, b) => Number(isOnline(b.userId)) - Number(isOnline(a.userId)));
    return { stage: onStage, audience: rest };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.members, onlineIds, call.joined, call.remotes, currentUserId]);

  const open = (member) =>
    openProfile(member.userId, {
      username: member.user?.username,
      displayName: member.user?.profile?.displayName,
      avatarUrl: member.user?.profile?.avatarUrl,
    });

  const labelOf = (m) => (m.role === 'HOST' ? 'Host' : m.role === 'CO_HOST' ? 'Co-host' : inCall(m.userId) ? 'Speaker' : null);

  const copyChip = (
    <button
      type="button"
      onClick={onCopyCode}
      className="flex items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-1 text-xs font-medium text-white hover:bg-black/40"
      title="Copy the room code"
    >
      <Copy className="h-3 w-3" /> {copied ? 'Copied' : 'Code'}
    </button>
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Room card */}
      {tab === 'people' ? (
        <div className={`shrink-0 rounded-2xl bg-gradient-to-br ${gradient} p-4 text-white shadow-card`}>
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-stage">
              <Users className="h-3.5 w-3.5" /> {room.members.length}
              <span className="font-normal text-stage/70">&middot; {onlineCount} online</span>
            </span>
            {copyChip}
          </div>
          <h2 className="mt-3 line-clamp-2 break-words font-display text-lg font-bold leading-snug">{room.name}</h2>
          <p className="mt-1 truncate text-xs text-white/85">
            Hosted by {room.host?.username} &middot; {room.mode.replace('_', ' ').toLowerCase()}
          </p>
        </div>
      ) : (
        <div
          className={`flex shrink-0 items-center justify-between gap-2 rounded-2xl bg-gradient-to-br ${gradient} px-4 py-2.5 text-white shadow-card`}
        >
          <h2 className="min-w-0 truncate font-display text-sm font-bold">{room.name}</h2>
          <span className="flex shrink-0 items-center gap-1 text-xs">
            <Users className="h-3.5 w-3.5" /> {onlineCount}/{room.members.length}
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex shrink-0 gap-1 rounded-full bg-stage-raised p-1">
        {[
          { id: 'people', label: 'People' },
          { id: 'chat', label: 'Chat' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-ember-gradient text-white' : 'text-paper-muted hover:text-paper'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* People */}
      <div className={`surface min-h-0 flex-1 overflow-y-auto rounded-xl2 p-3 ${tab === 'people' ? '' : 'hidden'}`}>
        <CallStage call={call} members={room.members} />

        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-paper-muted">On stage</p>
        <div className="grid grid-cols-3 gap-1 sm:grid-cols-4">
          {stage.map((m) => (
            <PersonTile
              key={m.id}
              member={m}
              label={labelOf(m)}
              mic={micOf(m.userId)}
              online={isOnline(m.userId)}
              size={60}
              onOpen={open}
            />
          ))}
        </div>

        {audience.length > 0 && (
          <>
            <div className="my-3 border-t border-border" />
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-paper-muted">
              Members &middot; {audience.length}
            </p>
            <div className="grid grid-cols-3 gap-1 sm:grid-cols-4">
              {audience.map((m) => (
                <PersonTile
                  key={m.id}
                  member={m}
                  label={null}
                  mic={null}
                  online={isOnline(m.userId)}
                  size={48}
                  onOpen={open}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Chat (stays mounted so messages keep arriving while you look at People) */}
      <div className={`surface min-h-0 flex-1 overflow-hidden rounded-xl2 ${tab === 'chat' ? '' : 'hidden'}`}>
        <ChatPanel roomId={room.id} currentUserId={currentUserId} embedded active={tab === 'chat'} />
      </div>

      <CallToolbar call={call} onLeaveRoom={onLeaveRoom} />
    </div>
  );
}