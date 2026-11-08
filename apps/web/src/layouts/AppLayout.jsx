// apps/web/src/layouts/AppLayout.jsx
import { Outlet } from 'react-router-dom';
import Sidebar from '@/components/layout/Sidebar';
import SyncPulse from '@/components/brand/SyncPulse';
import NotificationBell from '@/features/notifications/components/NotificationBell';

export default function AppLayout() {
  return (
    <div className="flex h-[100dvh] overflow-hidden bg-stage">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-2 md:justify-end md:px-6 md:py-3">
          <div className="flex items-center gap-2 md:hidden">
            <SyncPulse size={22} />
            <span className="font-display text-base font-bold text-paper">SyncSpace</span>
          </div>
          <NotificationBell />
        </div>
        {/* pb-14 leaves room for the bottom menu on phones */}
        <div className="min-h-0 flex-1 overflow-hidden pb-14 md:pb-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}