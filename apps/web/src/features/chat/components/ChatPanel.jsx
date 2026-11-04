// apps/web/src/features/chat/components/ChatPanel.jsx
import { useEffect, useRef, useState } from 'react';
import { Send, Smile, Paperclip, X } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import { useChat } from '../hooks/useChat';
import { messagesApi } from '../api/messagesApi';

const QUICK_REACTIONS = ['\u2764\ufe0f', '\ud83d\ude02', '\ud83d\udd25', '\ud83d\ude2e', '\ud83d\udc4d'];
const MAX_FILE_BYTES = 25 * 1024 * 1024;

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatPanel({ roomId, currentUserId }) {
  const { messages, loading, typingUsers, sendMessage, notifyTyping, react } = useChat(roomId);
  const [draft, setDraft] = useState('');
  const [openReactionsFor, setOpenReactionsFor] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const onSubmit = (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    sendMessage(draft);
    setDraft('');
  };

  const onPickFile = () => fileInputRef.current?.click();

  const onFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > MAX_FILE_BYTES) {
      setUploadError('File is too large (25MB max)');
      setTimeout(() => setUploadError(null), 3000);
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      await messagesApi.sendFile(roomId, file);
    } catch {
      setUploadError('Upload failed \u2014 try again');
      setTimeout(() => setUploadError(null), 3000);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="surface flex h-full flex-col rounded-xl2">
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-semibold text-paper-muted">Chat</p>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {loading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-stage-overlay" />
            ))}
          </div>
        )}

        {!loading && messages.length === 0 && (
          <p className="mt-8 text-center text-sm text-paper-muted">No messages yet. Say hi</p>
        )}

        {messages.map((m) => {
          const mine = m.senderId === currentUserId;
          const reactionCounts = (m.reactions || []).reduce((acc, r) => {
            acc[r.emoji] = (acc[r.emoji] || 0) + 1;
            return acc;
          }, {});

          return (
            <div key={m.id} className={`group flex gap-2.5 ${mine ? 'flex-row-reverse' : ''}`}>
              <Avatar name={m.sender?.username} src={m.sender?.profile?.avatarUrl} size="sm" />
              <div className={`flex max-w-[75%] flex-col gap-1 ${mine ? 'items-end' : 'items-start'}`}>
                <div className="flex items-baseline gap-2">
                  {!mine && (
                    <span className="text-xs font-semibold text-paper-muted">{m.sender?.username}</span>
                  )}
                  <span className="text-[11px] text-paper-muted/60">{formatTime(m.createdAt)}</span>
                </div>

                <div className="relative">
                  <div
                    className={`rounded-2xl px-3.5 py-2 text-sm ${
                      mine ? 'bg-ember-gradient text-white' : 'bg-stage-overlay text-paper'
                    }`}
                  >
                    {m.type === 'IMAGE' && m.fileUrl && (
                      <a href={m.fileUrl} target="_blank" rel="noreferrer">
                        <img
                          src={m.fileUrl}
                          alt={m.fileName || 'shared image'}
                          className="mb-1 max-w-[220px] rounded-lg"
                        />
                      </a>
                    )}
                    {m.type === 'FILE' && m.fileUrl && (
                      
                        <a
                      
                        href={m.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 underline"
                      >
                        <Paperclip className="h-3.5 w-3.5 shrink-0" />
                        {m.fileName || 'Download file'}
                      </a>
                    )}
                    {m.content && <p className="whitespace-pre-wrap break-words">{m.content}</p>}
                  </div>

                  <button
                    onClick={() => setOpenReactionsFor(openReactionsFor === m.id ? null : m.id)}
                    className="absolute -top-3 right-0 hidden rounded-full bg-stage-raised p-1 text-paper-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-paper md:block"
                    aria-label="Add reaction"
                  >
                    <Smile className="h-3.5 w-3.5" />
                  </button>

                  {openReactionsFor === m.id && (
                    <div className="surface absolute -top-10 right-0 z-10 flex gap-1 rounded-full px-2 py-1 shadow-card">
                      {QUICK_REACTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => {
                            react(m.id, emoji);
                            setOpenReactionsFor(null);
                          }}
                          className="text-base transition-transform hover:scale-125"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {Object.keys(reactionCounts).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(reactionCounts).map(([emoji, count]) => (
                      <button
                        key={emoji}
                        onClick={() => react(m.id, emoji)}
                        className="surface flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-paper hover:bg-stage-overlay"
                      >
                        <span>{emoji}</span>
                        <span className="text-paper-muted">{count}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {typingUsers.length > 0 && (
          <p className="px-1 text-xs italic text-paper-muted">
            {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
          </p>
        )}
      </div>

      {uploadError && (
        <div className="mx-3 mb-2 flex items-center justify-between rounded-lg bg-ember-dim/20 px-3 py-1.5 text-xs text-ember-hot">
          {uploadError}
          <button onClick={() => setUploadError(null)} aria-label="Dismiss">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-border p-3">
        <input
          ref={fileInputRef}
          type="file"
          onChange={onFileSelected}
          className="hidden"
          accept="image/*,.pdf,.zip,.txt,.doc,.docx"
        />
        <button
          type="button"
          onClick={onPickFile}
          disabled={uploading}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-paper-muted hover:bg-stage-overlay hover:text-paper disabled:opacity-40"
          aria-label="Attach file"
        >
          <Paperclip className="h-4 w-4" />
        </button>

        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            notifyTyping();
          }}
          placeholder={uploading ? 'Uploading...' : 'Send a message'}
          className="h-10 flex-1 rounded-full border border-border bg-stage-raised px-4 text-sm text-paper outline-none placeholder:text-paper-muted/60 focus:border-ember"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ember-gradient text-white disabled:opacity-40"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
