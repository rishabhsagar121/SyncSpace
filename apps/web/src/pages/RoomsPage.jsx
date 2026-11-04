import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { roomsApi, errMsg } from '../lib/api';
import useSocket from '../hooks/useSocket';
import ChatPanel from '../features/chat/ChatPanel';
import Avatar from '../components/ui/Avatar';

export default function RoomPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const me = useSelector((s) => s.auth?.user);
  const socket = useSocket();
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setRoom(null);
    setError('');
    roomsApi.get(id).then((d) => setRoom(d.room)).catch((e) => setError(errMsg(e)));
  }, [id]);

  if (error) {
    return (
      <div className="py-16 text-center">
        <p>{error}</p>
        <Link to="/app/rooms" className="mt-3 inline-block text-indigo-500">Back to rooms</Link>
      </div>
    );
  }
  if (!room) return <p className="text-sm opacity-60">Loading…</p>;

  const isHost = room.hostId === me?.id;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked */ }
  };

  const del = async () => {
    if (!window.confirm('Delete this room for everyone?')) return;
    try {
      await roomsApi.remove(room.id);
      nav('/app/rooms');
    } catch (e) { setError(errMsg(e)); }
  };

  return (
    <div className="grid h-[calc(100vh-7rem)] gap-4 lg:grid-cols-[1fr_340px]">
      <section className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold">{room.name}</h1>
            <p className="text-sm opacity-70">{room.type === 'LISTEN' ? 'Listen together' : 'Watch together'}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={copy} className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1 text-sm">
              {copied ? 'Copied' : `Code ${room.code}`}
            </button>
            {isHost && (
              <button onClick={del} className="text-sm opacity-60 hover:text-red-500">Delete</button>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-1 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800/60 text-sm opacity-70">
          Player and sync controls arrive in the next module.
        </div>

        <div className="mt-4">
          <h2 className="mb-2 text-sm font-medium">In this room</h2>
          <ul className="flex flex-wrap gap-2">
            {(room.members || []).map((m) => (
              <li key={m.id} className="flex items-center gap-2 rounded-full bg-slate-100 dark:bg-slate-800 py-1 pl-1 pr-3 text-sm">
                <Avatar user={m} size={24} />
                {m.displayName || m.username}
                {m.id === room.hostId && ' (host)'}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <aside className="min-h-0 rounded-xl border border-slate-200 dark:border-slate-800">
        <ChatPanel roomId={room.id} socket={socket} />
      </aside>
    </div>
  );
}