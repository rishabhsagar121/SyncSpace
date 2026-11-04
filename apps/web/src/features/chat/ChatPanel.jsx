import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { messagesApi } from '../../lib/api';
import Avatar from '../../components/ui/Avatar';

export default function ChatPanel({ roomId, socket }) {
  const me = useSelector((s) => s.auth?.user);
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const typingTimer = useRef(null);
  const stick = useRef(true);

  useEffect(() => {
    let alive = true;
    messagesApi.history(roomId)
      .then((d) => { if (alive) { setMessages(d.messages || []); setHasMore(!!d.hasMore); } })
      .catch(() => alive && setError('Could not load chat history.'));
    return () => { alive = false; };
  }, [roomId]);

  useEffect(() => {
    if (!socket) return undefined;
    const join = () =>
      socket.emit('room:join', { roomId }, (res) => { if (res && !res.ok) setError(res.message); });
    const onMsg = (m) => {
      if (m.roomId !== roomId) return;
      setMessages((p) => (p.some((x) => x.id === m.id) ? p : [...p, m]));
    };
    const onTyping = ({ userId, typing: t }) => { if (userId !== me?.id) setTyping(!!t); };
    join();
    socket.on('connect', join);
    socket.on('chat:message', onMsg);
    socket.on('chat:typing', onTyping);
    return () => {
      socket.emit('room:leave', { roomId });
      socket.off('connect', join);
      socket.off('chat:message', onMsg);
      socket.off('chat:typing', onTyping);
    };
  }, [socket, roomId, me?.id]);

  useEffect(() => {
    if (stick.current) bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const loadOlder = async () => {
    stick.current = false;
    try {
      const d = await messagesApi.history(roomId, messages[0]?.id);
      setMessages((p) => [...(d.messages || []), ...p]);
      setHasMore(!!d.hasMore);
    } catch { setError('Could not load older messages.'); }
  };

  const onChange = (e) => {
    setText(e.target.value);
    socket?.emit('chat:typing', { roomId, typing: true });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => socket?.emit('chat:typing', { roomId, typing: false }), 1500);
  };

  const send = (e) => {
    e.preventDefault();
    const content = text.trim();
    if (!content || !socket) return;
    stick.current = true;
    setError('');
    socket.emit('chat:send', { roomId, content }, (res) => { if (res && !res.ok) setError(res.message); });
    setText('');
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 overflow-y-auto space-y-3 p-4" aria-live="polite">
        {hasMore && (
          <button onClick={loadOlder} className="mx-auto block text-xs opacity-70 hover:opacity-100">
            Load older messages
          </button>
        )}
        {messages.length === 0 && <p className="py-8 text-center text-sm opacity-60">No messages yet. Say hi.</p>}
        {messages.map((m) => {
          const mine = (m.senderId || m.sender?.id) === me?.id;
          return (
            <div key={m.id} className={`flex gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
              <Avatar user={m.sender} size={28} />
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${mine ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
                {!mine && (
                  <p className="mb-0.5 text-xs font-medium opacity-70">
                    {m.sender?.displayName || m.sender?.username}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div className="h-5 px-4 text-xs opacity-60">{typing ? 'Someone is typing…' : ''}</div>
      {error && <p className="px-4 pb-1 text-xs text-red-500">{error}</p>}
      <form onSubmit={send} className="flex gap-2 border-t border-slate-200 dark:border-slate-800 p-3">
        <input
          value={text}
          onChange={onChange}
          maxLength={1000}
          placeholder="Write a message"
          aria-label="Message"
          className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2"
        />
        <button
          disabled={!text.trim() || !socket}
          className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}