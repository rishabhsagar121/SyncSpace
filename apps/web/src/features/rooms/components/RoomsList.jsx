// apps/web/src/features/rooms/components/RoomsList.jsx
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, KeyRound, Radio, Users } from 'lucide-react';
import { useState } from 'react';
import { useMyRooms } from '../hooks/useRooms';
import CreateRoomModal from './CreateRoomModal';
import JoinRoomModal from './JoinRoomModal';

// compact: used inside a room. Narrow on computers, hidden on phones and tablets.
export default function RoomsList({ compact = false }) {
  const navigate = useNavigate();
  const { roomId: activeRoomId } = useParams();
  const { data: rooms, isLoading } = useMyRooms();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const wrapperClass = compact
    ? 'hidden h-full shrink-0 flex-col border-r border-border bg-stage lg:flex lg:w-56'
    : 'flex h-full w-full shrink-0 flex-col border-r border-border bg-stage md:w-80';

  return (
    <div className={wrapperClass}>
      <div className="flex items-center justify-between px-4 py-5">
        <h2 className="font-display text-lg font-bold text-paper">Rooms</h2>
        <div className="flex gap-1">
          <button
            onClick={() => setJoinOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-paper-muted hover:bg-stage-overlay hover:text-paper"
            aria-label="Join with code"
          >
            <KeyRound className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-ember text-white hover:bg-ember-dim"
            aria-label="Create room"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto px-2 pb-4">
        {isLoading && (
          <div className="space-y-2 px-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-stage-overlay" />
            ))}
          </div>
        )}

        {!isLoading && rooms?.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <Radio className="h-7 w-7 text-paper-muted" />
            <p className="text-sm text-paper-muted">No rooms yet — create one to get started.</p>
          </div>
        )}

        {rooms?.map((room) => {
          const active = room.id === activeRoomId;
          return (
            <button
              key={room.id}
              onClick={() => navigate(`/app/rooms/${room.id}`)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                active ? 'bg-ember/10' : 'hover:bg-white/5'
              }`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  active ? 'bg-ember text-white' : 'bg-stage-overlay text-paper-muted'
                }`}
              >
                <Radio className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-medium ${active ? 'text-ember' : 'text-paper'}`}>
                  {room.name}
                </p>
                <p className="flex items-center gap-1 text-xs text-paper-muted">
                  <Users className="h-3 w-3" />
                  {room._count?.members ?? 0} member{room._count?.members === 1 ? '' : 's'}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <CreateRoomModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <JoinRoomModal open={joinOpen} onClose={() => setJoinOpen(false)} />
    </div>
  );
}