// apps/web/src/components/layout/Sidebar.jsx
import { NavLink, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Home, MessageSquare, Users, CalendarDays, Settings, LogOut } from 'lucide-react';
import SyncPulse from '@/components/brand/SyncPulse';
import Avatar from '@/components/ui/Avatar';
import { selectCurrentUser } from '@/features/auth/authSlice';
import { useLogout } from '@/features/auth/hooks/useAuth';

const NAV_ITEMS = [
  { to: '/app', label: 'Home', icon: Home, end: true },
  { to: '/app/rooms', label: 'Chat', icon: MessageSquare },
  { to: '/app/friends', label: 'Friends', icon: Users },
  { to: '/app/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/app/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const user = useSelector(selectCurrentUser);
  const navigate = useNavigate();
  const logout = useLogout();

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-border bg-stage-raised">
      <button
        onClick={() => navigate('/app')}
        className="flex items-center gap-2 px-5 py-5"
      >
        <SyncPulse size={24} />
        <span className="font-display text-base font-bold text-paper">SyncSpace</span>
      </button>

      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-ember/10 text-ember'
                  : 'text-paper-muted hover:bg-white/5 hover:text-paper'
              }`
            }
          >
            <Icon className="h-4.5 w-4.5" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border px-3 py-4">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <Avatar name={user?.username} src={user?.profile?.avatarUrl} size="sm" live />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-paper">{user?.username}</p>
            <p className="text-xs text-paper-muted">Online</p>
          </div>
          <button
            onClick={() => logout.mutate()}
            className="flex h-7 w-7 items-center justify-center rounded-md text-paper-muted hover:bg-white/5 hover:text-paper"
            aria-label="Log out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}