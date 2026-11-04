// apps/web/src/pages/Dashboard/DashBoard.jsx
import { MessageSquare } from 'lucide-react';
import RoomsList from '@/features/rooms/components/RoomsList';

export default function Dashboard() {
  return (
    <div className="flex h-full">
      <RoomsList />
      <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-stage">
        <MessageSquare className="h-10 w-10 text-paper-muted" />
        <p className="font-display font-bold text-paper">Pick a room to start watching</p>
        <p className="max-w-xs text-center text-sm text-paper-muted">
          Choose a room on the left, or create a new one to get everyone in the same place.
        </p>
      </div>
    </div>
  );
}