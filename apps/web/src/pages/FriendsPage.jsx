import { useCallback, useEffect, useState } from 'react';
import { friendsApi, errMsg } from '../lib/api';
import Avatar from '../components/ui/Avatar';
import EmptyState from '../components/ui/EmptyState';

export default function FriendsPage() {
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [f, r] = await Promise.all([friendsApi.list(), friendsApi.requests()]);
      setFriends(f.friends || []);
      setIncoming(r.incoming || []);
      setOutgoing(r.outgoing || []);
    } catch (e) {
      setStatus({ type: 'error', text: errMsg(e) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (fn, okText) => {
    try {
      await fn();
      if (okText) setStatus({ type: 'ok', text: okText });
      await load();
    } catch (e) {
      setStatus({ type: 'error', text: errMsg(e) });
    }
  };

  const submit = (e) => {
    e.preventDefault();
    act(async () => { await friendsApi.send(username); setUsername(''); }, 'Friend request sent.');
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Friends</h1>
        <p className="text-sm opacity-70">Add people by username so you can invite them to rooms.</p>
      </header>

      <form onSubmit={submit} className="flex gap-2">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          aria-label="Username"
          className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2"
        />
        <button
          disabled={!username.trim()}
          className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          Send request
        </button>
      </form>
      {status && (
        <p role="status" className={status.type === 'error' ? 'text-red-500 text-sm' : 'text-emerald-500 text-sm'}>
          {status.text}
        </p>
      )}

      {incoming.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Requests for you</h2>
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {incoming.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-3">
                <Avatar user={r.sender} />
                <span className="flex-1">{r.sender?.displayName || r.sender?.username}</span>
                <button
                  onClick={() => act(() => friendsApi.accept(r.id), 'Friend added.')}
                  className="rounded-md bg-indigo-600 px-3 py-1 text-sm text-white"
                >
                  Accept
                </button>
                <button
                  onClick={() => act(() => friendsApi.decline(r.id))}
                  className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1 text-sm"
                >
                  Decline
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-semibold">Your friends ({friends.length})</h2>
        {loading ? (
          <p className="opacity-60 text-sm">Loading…</p>
        ) : friends.length === 0 ? (
          <EmptyState title="No friends yet" hint="Send a request using a username above." />
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {friends.map((f) => (
              <li key={f.id} className="flex items-center gap-3 py-3">
                <Avatar user={f} />
                <div className="flex-1 min-w-0">
                  <p className="truncate">{f.displayName || f.username}</p>
                  <p className="truncate text-xs opacity-60">@{f.username}</p>
                </div>
                <button
                  onClick={() => window.confirm(`Remove ${f.username}?`) && act(() => friendsApi.remove(f.id))}
                  className="text-sm opacity-60 hover:opacity-100 hover:text-red-500"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {outgoing.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Waiting for a reply</h2>
          <ul className="text-sm opacity-80 space-y-1">
            {outgoing.map((r) => <li key={r.id}>@{r.receiver?.username}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}