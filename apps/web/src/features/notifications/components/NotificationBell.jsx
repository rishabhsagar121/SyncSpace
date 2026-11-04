// apps/web/src/features/notifications/components/NotificationBell.jsx
import { useState } from 'react';
import { Bell, UserPlus, UserCheck } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function NotificationRow({ notification, onRead }) {
  const { type, payload, isRead, createdAt, id } = notification;
  const Icon = type === 'FRIEND_REQUEST' ? UserPlus : UserCheck;
  const text =
    type === 'FRIEND_REQUEST'
      ? `${payload.fromUsername || 'Someone'} sent you a friend request`
      : type === 'FRIEND_ACCEPTED'
      ? `${payload.fromUsername || 'Someone'} accepted your friend request`
      : 'New notification';

  return (
    <button
      onClick={() => !isRead && onRead(id)}
      className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white/5 ${
        isRead ? 'opacity-60' : ''
      }`}
    >
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stage-overlay">
        <Icon className="h-4 w-4 text-ember" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-paper">{text}</p>
        <p className="mt-0.5 text-xs text-paper-muted">{timeAgo(createdAt)}</p>
      </div>
      {!isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-ember-hot" />}
    </button>
  );
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { notifications, loading, unreadCount, markRead, markAllRead } = useNotifications();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-paper-muted hover:bg-stage-overlay hover:text-paper"
        aria-label="Notifications"
      >
        <Bell className="h-4.5 w-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-ember-hot px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="surface absolute right-0 top-12 z-40 max-h-[420px] w-80 overflow-y-auto rounded-xl2 p-2 shadow-card">
            <div className="flex items-center justify-between px-2 py-1.5">
              <p className="text-sm font-semibold text-paper">Notifications</p>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead()}
                  className="text-xs text-ember hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>

            {loading && (
              <div className="space-y-2 p-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-lg bg-stage-overlay" />
                ))}
              </div>
            )}

            {!loading && notifications.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-paper-muted">You're all caught up</p>
            )}

            {notifications.map((n) => (
              <NotificationRow key={n.id} notification={n} onRead={markRead} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}