// apps/web/src/features/friends/components/FriendsPanel.jsx
import { useState } from 'react';
import { Search, UserPlus, Check, X } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import {
  useFriendsList,
  useIncomingRequests,
  useOutgoingRequests,
  useRespondToRequest,
  useSendFriendRequest,
  useUserSearch,
} from '../hooks/useFriends';

const TABS = [
  { id: 'friends', label: 'Friends' },
  { id: 'requests', label: 'Requests' },
  { id: 'add', label: 'Add friend' },
];

function FriendsTab() {
  const { data: friends, isLoading } = useFriendsList();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-stage-overlay" />
        ))}
      </div>
    );
  }

  if (!friends?.length) {
    return (
      <p className="py-10 text-center text-sm text-paper-muted">
        No friends yet — search for someone in the "Add friend" tab.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {friends.map(({ friendshipId, user }) => (
        <div key={friendshipId} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/5">
          <Avatar name={user.username} src={user.profile?.avatarUrl} size="sm" live={user.presenceStatus === 'ONLINE'} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-paper">{user.username}</p>
            <p className="text-xs text-paper-muted">
              {user.presenceStatus === 'ONLINE' ? 'Online' : 'Offline'}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function RequestsTab() {
  const { data: incoming, isLoading: incomingLoading } = useIncomingRequests();
  const { data: outgoing, isLoading: outgoingLoading } = useOutgoingRequests();
  const respond = useRespondToRequest();

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-paper-muted">
          Incoming
        </p>
        {incomingLoading && <div className="h-14 animate-pulse rounded-xl bg-stage-overlay" />}
        {!incomingLoading && incoming?.length === 0 && (
          <p className="px-1 text-sm text-paper-muted">No pending requests</p>
        )}
        <div className="space-y-1">
          {incoming?.map((req) => (
            <div key={req.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/5">
              <Avatar name={req.sender.username} src={req.sender.profile?.avatarUrl} size="sm" />
              <p className="min-w-0 flex-1 truncate text-sm font-medium text-paper">{req.sender.username}</p>
              <button
                onClick={() => respond.mutate({ requestId: req.id, accept: true })}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-ember-gradient text-white"
                aria-label="Accept"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => respond.mutate({ requestId: req.id, accept: false })}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-stage-overlay text-paper-muted hover:text-paper"
                aria-label="Decline"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-paper-muted">
          Sent
        </p>
        {outgoingLoading && <div className="h-14 animate-pulse rounded-xl bg-stage-overlay" />}
        {!outgoingLoading && outgoing?.length === 0 && (
          <p className="px-1 text-sm text-paper-muted">No outgoing requests</p>
        )}
        <div className="space-y-1">
          {outgoing?.map((req) => (
            <div key={req.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/5">
              <Avatar name={req.receiver.username} src={req.receiver.profile?.avatarUrl} size="sm" />
              <p className="min-w-0 flex-1 truncate text-sm font-medium text-paper">{req.receiver.username}</p>
              <span className="text-xs text-paper-muted">Pending</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AddFriendTab() {
  const [query, setQuery] = useState('');
  const { data: results, isLoading } = useUserSearch(query);
  const sendRequest = useSendFriendRequest();
  const [sentTo, setSentTo] = useState(new Set());

  const handleSend = (userId) => {
    sendRequest.mutate(userId, {
      onSuccess: () => setSentTo((prev) => new Set(prev).add(userId)),
    });
  };

  return (
    <div>
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-paper-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by username…"
          className="h-10 w-full rounded-full border border-border bg-stage-raised pl-9 pr-4 text-sm text-paper outline-none placeholder:text-paper-muted/60 focus:border-ember"
        />
      </div>

      {query.trim().length <= 1 && (
        <p className="px-1 text-sm text-paper-muted">Type at least 2 characters to search</p>
      )}

      {isLoading && (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-stage-overlay" />
          ))}
        </div>
      )}

      {!isLoading && query.trim().length > 1 && results?.length === 0 && (
        <p className="px-1 text-sm text-paper-muted">No users found</p>
      )}

      <div className="space-y-1">
        {results?.map((user) => {
          const sent = sentTo.has(user.id);
          return (
            <div key={user.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/5">
              <Avatar name={user.username} src={user.profile?.avatarUrl} size="sm" />
              <p className="min-w-0 flex-1 truncate text-sm font-medium text-paper">{user.username}</p>
              <Button
                variant={sent ? 'ghost' : 'secondary'}
                size="sm"
                disabled={sent}
                onClick={() => handleSend(user.id)}
              >
                <UserPlus className="h-3.5 w-3.5" /> {sent ? 'Sent' : 'Add'}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function FriendsPanel() {
  const [tab, setTab] = useState('friends');

  return (
    <div className="surface rounded-xl2 p-5">
      <div className="mb-5 flex gap-1 rounded-full bg-stage-raised p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-ember-gradient text-white' : 'text-paper-muted hover:text-paper'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'friends' && <FriendsTab />}
      {tab === 'requests' && <RequestsTab />}
      {tab === 'add' && <AddFriendTab />}
    </div>
  );
}