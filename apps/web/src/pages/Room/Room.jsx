// apps/web/src/pages/Room/Room.jsx
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ArrowLeft, Copy, LogOut, Crown, Radio } from 'lucide-react';
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

  // Everyone in the room can control playback
  const { source, changeSource, canControl, registerPlayer, emitPlay, emitPause, emitSeek } =
    useRoomSync(roomId, { isHost: true, allowGuestControl: true });

  // Join the live room channel (and rejoin if the socket reconnects)
  useEffect(() => {
    if (!roomId) return;
    const socket = getSocket();
    const join = () => socket.emit('room:join', { roomId });

    if (socket.connected) join();
    socket.on('connect', join);

    return () => {
      socket.off('connect', join);
      socket.emit('room:leave', { roomId });
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
        <RoomsList compact />
        <div className="flex-1 animate-pulse bg-stage-raised" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex h-full">
        <RoomsList compact />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
          <p className="font-display font-bold text-paper">Room not found</p>
          <p className="text-sm text-paper-muted">It may have ended, or you may not have access.</p>
          <Button onClick={() => navigate('/app')}>Back to your rooms</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <RoomsList compact />

      {/* Phones and tablets: the whole page scrolls. Computers: panels fit the screen. */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => navigate('/app')}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-paper-muted hover:bg-stage-overlay hover:text-paper lg:hidden"
              aria-label="Back to rooms"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate font-display text-lg font-bold text-paper">{room.name}</h1>
              <p className="truncate text-xs text-paper-muted">
                Hosted by {room.host?.username} &middot; {room.mode.replace('_', ' ').toLowerCase()}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={copyCode}
              className="surface flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-xs text-paper hover:bg-stage-overlay"
            >
              <span className="hidden sm:inline">{room.code}</span>
              <span className="sm:hidden">Code</span>
              <Copy className="h-3 w-3" />
              {copied && <span className="text-ember">copied</span>}
            </button>
            <Button variant="ghost" size="sm" onClick={leave}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Leave</span>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 p-2 sm:p-4 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-4 lg:overflow-hidden">
          <div className="flex min-w-0 flex-col gap-3 lg:overflow-hidden">
            <div className={`surface relative aspect-video w-full overflow-hidden rounded-lg sm:rounded-xl2 ${
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
                  <p className="max-w-xs px-2 text-center text-sm text-paper-muted">
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
                  <p className="px-2 text-center font-display font-bold text-paper">
                    Paste a YouTube link to get started
                  </p>
                </>
              )}
            </div>

            {room.mode === 'YOUTUBE' && canControl && <SourceBar onSetSource={changeSource} />}
          </div>

          <div className="flex min-w-0 flex-col gap-3 lg:gap-4 lg:overflow-hidden">
            <VoiceBar roomId={roomId} currentUserId={currentUser?.id} members={room.members} />

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

            {/* Phones: chat has its own fixed height. Computers: it fills the space that is left. */}
            <div className="h-[60vh] min-h-[320px] overflow-hidden lg:h-auto lg:min-h-0 lg:flex-1">
              <ChatPanel roomId={roomId} currentUserId={currentUser?.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}