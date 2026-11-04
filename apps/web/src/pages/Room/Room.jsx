// apps/web/src/pages/Room/Room.jsx
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Copy, LogOut, Crown, Radio } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import { useRoom } from '@/features/rooms/hooks/useRooms';
import { roomsApi } from '@/features/rooms/api/roomsApi';
import { selectCurrentUser } from '@/features/auth/authSlice';
import { getSocket } from '@/lib/socket';
import ChatPanel from '@/features/chat/components/ChatPanel';
import YouTubePlayer from '@/features/sync/components/YouTubePlayer';
import SourceBar from '@/features/sync/components/SourceBar';
import { useRoomSync } from '@/features/sync/hooks/useRoomSync';
import VoiceBar from '@/features/webrtc/components/VoiceBar';
import RoomsList from '@/features/rooms/components/RoomsList';

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useSelector(selectCurrentUser);
  const { data: room, isLoading } = useRoom(roomId);
  const [copied, setCopied] = useState(false);

  const myMembership = room?.members?.find((m) => m.userId === currentUser?.id);
  const isHost = myMembership?.role === 'HOST' || myMembership?.role === 'CO_HOST';
  const allowGuestControl = room?.settings?.allowGuestControl ?? false;

  const { source, changeSource, canControl, registerPlayer, emitPlay, emitPause, emitSeek } =
    useRoomSync(roomId, { isHost, allowGuestControl });

  useEffect(() => {
    if (!roomId) return;
    const socket = getSocket();
    socket.emit('room:join', roomId);
    return () => {
      socket.emit('room:leave', roomId);
    };
  }, [roomId]);

  const copyCode = () => {
    if (!room) return;
    navigator.clipboard?.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const leave = async () => {
    await roomsApi.leave(roomId);
    queryClient.invalidateQueries({ queryKey: ['rooms', 'mine'] });
    navigate('/app');
  };

  if (isLoading) {
    return (
      <div className="flex h-full">
        <RoomsList />
        <div className="flex-1 animate-pulse bg-stage-raised" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex h-full">
        <RoomsList />
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p className="font-display font-bold text-paper">Room not found</p>
          <p className="text-sm text-paper-muted">It may have ended, or you may not have access.</p>
          <Button onClick={() => navigate('/app')}>Back to your rooms</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <RoomsList />

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h1 className="font-display text-lg font-bold text-paper">{room.name}</h1>
            <p className="text-xs text-paper-muted">
              Hosted by {room.host?.username} &middot; {room.mode.replace('_', ' ').toLowerCase()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyCode}
              className="surface flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-xs text-paper hover:bg-stage-overlay"
            >
              {room.code} <Copy className="h-3 w-3" />
              {copied && <span className="text-ember">copied</span>}
            </button>
            <Button variant="ghost" size="sm" onClick={leave}>
              <LogOut className="h-4 w-4" /> Leave
            </Button>
          </div>
        </div>

        <div className="grid flex-1 gap-4 overflow-hidden p-4 md:grid-cols-[1fr,320px]">
          <div className="flex flex-col gap-3 overflow-hidden">
            <div className={`surface relative aspect-video w-full overflow-hidden rounded-xl2 ${
              source && room.mode === 'YOUTUBE'
                ? 'bg-black'
                : 'flex flex-col items-center justify-center gap-3'
            }`}>
              {room.mode !== 'YOUTUBE' ? (
                <>
                  <Radio className="h-8 w-8 text-ember" />
                  <p className="font-display font-bold text-paper">
                    {room.mode.replace('_', ' ').toLowerCase()} sync coming soon
                  </p>
                  <p className="max-w-xs text-center text-sm text-paper-muted">
                    YouTube rooms are fully synced right now — chat still works great here.
                  </p>
                </>
              ) : source ? (
                <YouTubePlayer
                  videoId={source.videoId}
                  onRegister={registerPlayer}
                  onPlay={emitPlay}
                  onPause={emitPause}
                  onSeek={emitSeek}
                />
              ) : (
                <>
                  <Radio className="h-8 w-8 text-ember" />
                  <p className="font-display font-bold text-paper">
                    {canControl ? 'Paste a YouTube link to get started' : 'Waiting for the host to pick something'}
                  </p>
                </>
              )}
            </div>

            {room.mode === 'YOUTUBE' && canControl && <SourceBar onSetSource={changeSource} />}
          </div>

          <div className="flex flex-col gap-4 overflow-hidden">
            <VoiceBar roomId={roomId} currentUserId={currentUser?.id} />

            <div className="surface rounded-xl2 p-4">
              <p className="mb-3 text-sm font-semibold text-paper-muted">
                In the room &middot; {room.members.length}
              </p>
              <div className="flex flex-col gap-3">
                {room.members.map((m) => (
                  <div key={m.id} className="flex items-center gap-3">
                    <Avatar name={m.user.username} src={m.user.profile?.avatarUrl} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm text-paper">{m.user.username}</p>
                      {m.role !== 'MEMBER' && (
                        <p className="flex items-center gap-1 text-xs text-paper-muted">
                          <Crown className="h-3 w-3 text-ember" /> {m.role.replace('_', ' ').toLowerCase()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-hidden">
              <ChatPanel roomId={roomId} currentUserId={currentUser?.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}