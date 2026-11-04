// apps/web/src/layouts/AppLayout.jsx
import { Outlet } from 'react-router-dom';
import Sidebar from '@/components/layout/Sidebar';
import NotificationBell from '@/features/notifications/components/NotificationBell';

export default function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-stage">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-end border-b border-border px-6 py-3">
          <NotificationBell />
        </div>
        <div className="flex-1 overflow-hidden">
          <Outlet />
        </div>
      </div>
    </div>
  );
}