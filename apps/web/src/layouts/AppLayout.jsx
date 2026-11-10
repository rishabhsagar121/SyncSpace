// apps/web/src/layouts/AppLayout.jsx
import { Outlet } from 'react-router-dom';
import Sidebar from '@/components/layout/Sidebar';
import SyncPulse from '@/components/brand/SyncPulse';
import NotificationBell from '@/features/notifications/components/NotificationBell';
import { MusicProvider } from '@/features/music/MusicProvider';
import MusicDock from '@/features/music/components/MusicDock';

export default function AppLayout() {
  return (
    <MusicProvider>
      <div className="flex h-[100dvh] overflow-hidden bg-stage">
        <Sidebar />
        {/* pb-14 leaves room for the bottom menu on phones */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden pb-14 md:pb-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-2 md:justify-end md:px-6 md:py-3">
            <div className="flex items-center gap-2 md:hidden">
              <SyncPulse size={22} />
              <span className="font-display text-base font-bold text-paper">SyncSpace</span>
            </div>
            <NotificationBell />
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <Outlet />
          </div>
          {/* Stays here while you move between pages, so the music keeps playing */}
          <MusicDock />
        </div>
      </div>
    </MusicProvider>
  );
}