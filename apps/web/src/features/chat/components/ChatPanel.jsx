// apps/web/src/features/chat/components/ChatPanel.jsx
import { useEffect, useRef, useState } from 'react';
import { Send, Smile, Paperclip, X, Mic, Square, Reply } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import { useProfileCard } from '@/features/profile/ProfileCardProvider';
import { useChat } from '../hooks/useChat';
import { messagesApi } from '../api/messagesApi';

const QUICK_REACTIONS = ['❤️', '😂', '🔥', '😮', '👍'];

const EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉',
  '😊', '😇', '🥰', '😍', '🤩', '😘', '😋', '😛', '😜', '🤪',
  '🤗', '🤔', '🤨', '😐', '😶', '🙄', '😏', '😴', '😌', '😎',
  '🤓', '🥳', '😢', '😭', '😤', '😡', '🥺', '😱', '😨', '🤯',
  '👍', '👎', '👏', '🙌', '🙏', '🤝', '💪', '👋', '🤞', '✌️',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💔', '💯', '🔥',
  '✨', '🎉', '🎊', '🎵', '🎶', '🎬', '🍿', '📺', '🎧', '🎮',
  '😈', '👀', '💀', '🤡', '👻', '🙈', '🌹', '🌟', '⚡', '☕',
];

const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_RECORD_SECONDS = 120;
const AUDIO_NAME = /^voice-note\.(webm|ogg|m4a|mp4|wav|mp3)$/i;

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatSeconds(total) {
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

// A short description of a message, used in reply quotes
function snippetOf(m) {
  if (m?.content) return m.content;
  if (m?.type === 'IMAGE') return 'Photo';
  if (AUDIO_NAME.test(m?.fileName || '')) return 'Voice note';
  return m?.fileName || 'Attachment';
}

// embedded: used inside the room panel (no own border or title). active: false while its tab is hidden.
export default function ChatPanel({ roomId, currentUserId, embedded = false, active = true }) {
  const { messages, loading, error, typingUsers, sendMessage, notifyTyping, react } = useChat(roomId);
  const { openProfile } = useProfileCard();
  const [draft, setDraft] = useState('');
  const [openReactionsFor, setOpenReactionsFor] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [replyingTo, setReplyingTo] = useState(null); // { id, name, snippet }
  const [flashId, setFlashId] = useState(null);

  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const textInputRef = useRef(null);
  const pickerWrapRef = useRef(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const cancelledRef = useRef(false);
  const flashTimerRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  // Coming back to this tab: jump to the newest message
  useEffect(() => {
    if (active) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [active]);

  // Close the emoji picker when clicking anywhere else
  useEffect(() => {
    if (!showPicker) return;
    const onDown = (e) => {
      if (pickerWrapRef.current && !pickerWrapRef.current.contains(e.target)) setShowPicker(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [showPicker]);

  // A reply belongs to one room
  useEffect(() => {
    setReplyingTo(null);
  }, [roomId]);

  useEffect(() => () => clearTimeout(flashTimerRef.current), []);

  const startReply = (m) => {
    setReplyingTo({
      id: m.id,
      name: m.sender?.displayName || m.sender?.username || 'Someone',
      snippet: snippetOf(m),
    });
    setOpenReactionsFor(null);
    textInputRef.current?.focus();
  };

  // Scroll to the message that was replied to, and highlight it for a moment
  const jumpTo = (messageId) => {
    const el = scrollRef.current?.querySelector(`[data-mid="${messageId}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlashId(messageId);
    clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlashId(null), 1500);
  };

  const insertEmoji = (emoji) => {
    const input = textInputRef.current;
    const start = input?.selectionStart ?? draft.length;
    const end = input?.selectionEnd ?? draft.length;
    const next = draft.slice(0, start) + emoji + draft.slice(end);
    setDraft(next);
    notifyTyping();
    requestAnimationFrame(() => {
      if (!input) return;
      input.focus();
      const pos = start + emoji.length;
      input.setSelectionRange(pos, pos);
    });
  };

  const showUploadError = (text) => {
    setUploadError(text);
    setTimeout(() => setUploadError(null), 4000);
  };

  const uploadFile = async (file) => {
    if (file.size > MAX_FILE_BYTES) {
      showUploadError('File is too large (25MB max)');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      await messagesApi.sendFile(roomId, file);
    } catch (err) {
      showUploadError(err.response?.data?.message || 'Upload failed — try again');
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    sendMessage(draft, replyingTo?.id);
    setDraft('');
    setReplyingTo(null);
    setShowPicker(false);
  };

  const onPickFile = () => fileInputRef.current?.click();

  const onFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) await uploadFile(file);
  };

  const stopTimerAndStream = () => {
    clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startRecording = async () => {
    if (recording || uploading) return;

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      showUploadError('Voice notes need a secure page (https or localhost) and a supported browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
      const mimeType = candidates.find((t) => MediaRecorder.isTypeSupported?.(t));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      chunksRef.current = [];
      cancelledRef.current = false;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        stopTimerAndStream();
        setRecording(false);
        setSeconds(0);
        if (cancelledRef.current) return;

        const type = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        if (blob.size < 1000) {
          showUploadError('Recording was too short.');
          return;
        }
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
        await uploadFile(new File([blob], `voice-note.${ext}`, { type }));
      };

      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setSeconds(0);

      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_RECORD_SECONDS) {
            recorderRef.current?.state === 'recording' && recorderRef.current.stop();
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      stopTimerAndStream();
      showUploadError('Microphone blocked. Allow microphone access in the browser and try again.');
    }
  };

  const stopAndSend = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  };

  const cancelRecording = () => {
    cancelledRef.current = true;
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    else {
      stopTimerAndStream();
      setRecording(false);
      setSeconds(0);
    }
  };

  // Stop the microphone if the chat panel closes mid-recording
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const hoverButton =
    'absolute -top-3 rounded-full bg-stage-raised p-1 text-paper-muted opacity-100 transition-opacity hover:text-paper md:opacity-0 md:group-hover:opacity-100';

  return (
    <div className={embedded ? 'flex h-full flex-col' : 'surface flex h-full flex-col rounded-xl2'}>
      {!embedded && (
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-paper-muted">Chat</p>
        </div>
      )}

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
          const senderName = m.sender?.displayName || m.sender?.username;
          const senderAvatar = m.sender?.avatarUrl || m.sender?.profile?.avatarUrl;
          const senderId = m.sender?.id ?? m.senderId;
          const isVoiceNote = m.type === 'FILE' && m.fileUrl && AUDIO_NAME.test(m.fileName || '');
          const reactionCounts = (m.reactions || []).reduce((acc, r) => {
            acc[r.emoji] = (acc[r.emoji] || 0) + 1;
            return acc;
          }, {});

          return (
            <div
              key={m.id}
              data-mid={m.id}
              className={`group flex gap-2.5 rounded-xl transition-colors duration-500 ${
                mine ? 'flex-row-reverse' : ''
              } ${flashId === m.id ? 'bg-ember/10' : ''}`}
            >
              {/* Tap the picture to see their profile and send a friend request */}
              <button
                type="button"
                onClick={() =>
                  openProfile(senderId, {
                    username: m.sender?.username,
                    displayName: m.sender?.displayName,
                    avatarUrl: senderAvatar,
                  })
                }
                className="shrink-0 self-start rounded-full"
                aria-label={`View ${senderName}'s profile`}
                title={`View ${senderName}'s profile`}
              >
                <Avatar name={m.sender?.username} src={senderAvatar} size="sm" />
              </button>
              <div className={`flex min-w-0 max-w-[75%] flex-col gap-1 ${mine ? 'items-end' : 'items-start'}`}>
                <div className="flex items-baseline gap-2">
                  {!mine && (
                    <span className="text-xs font-semibold text-paper-muted">{senderName}</span>
                  )}
                  <span className="text-[11px] text-paper-muted/60">{formatTime(m.createdAt)}</span>
                </div>

                <div className="relative min-w-0 max-w-full">
                  <div
                    className={`rounded-2xl px-3.5 py-2 text-sm ${
                      mine ? 'bg-ember-gradient text-white' : 'bg-stage-overlay text-paper'
                    }`}
                  >
                    {m.replyTo && (
                      <button
                        type="button"
                        onClick={() => jumpTo(m.replyTo.id)}
                        className={`mb-1.5 block w-full rounded-lg border-l-2 px-2 py-1 text-left text-xs ${
                          mine
                            ? 'border-white/70 bg-black/15 text-white/90'
                            : 'border-ember bg-black/20 text-paper-muted'
                        }`}
                        title="Go to the original message"
                      >
                        <span className="block truncate font-semibold">{m.replyTo.senderName}</span>
                        <span className="block truncate">{snippetOf(m.replyTo)}</span>
                      </button>
                    )}
                    {m.type === 'IMAGE' && m.fileUrl && (
                      <a href={m.fileUrl} target="_blank" rel="noreferrer">
                        <img
                          src={m.fileUrl}
                          alt={m.fileName || 'shared image'}
                          className="mb-1 max-h-60 max-w-full rounded-lg"
                        />
                      </a>
                    )}
                    {isVoiceNote && (
                      <audio controls preload="metadata" src={m.fileUrl} className="h-10 w-[220px] max-w-full" />
                    )}
                    {m.type === 'FILE' && m.fileUrl && !isVoiceNote && (
                      <a
                        href={m.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        download={m.fileName || undefined}
                        className="flex items-center gap-2 underline"
                      >
                        <Paperclip className="h-3.5 w-3.5 shrink-0" />
                        {m.fileName || 'Download file'}
                      </a>
                    )}
                    {m.content && (
                      <p
                        className="whitespace-pre-wrap break-words"
                        style={{ fontFamily: `Inter, ${EMOJI_FONT}` }}
                      >
                        {m.content}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => startReply(m)}
                    className={`${hoverButton} right-8`}
                    aria-label="Reply"
                    title="Reply"
                  >
                    <Reply className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setOpenReactionsFor(openReactionsFor === m.id ? null : m.id)}
                    className={`${hoverButton} right-0`}
                    aria-label="Add reaction"
                    title="React"
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
                          style={{ fontFamily: EMOJI_FONT }}
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
                        <span style={{ fontFamily: EMOJI_FONT }}>{emoji}</span>
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

      {error && (
        <div className="mx-3 mb-2 rounded-lg bg-ember-dim/20 px-3 py-1.5 text-xs text-ember-hot">
          {error}
        </div>
      )}

      {uploadError && (
        <div className="mx-3 mb-2 flex items-center justify-between rounded-lg bg-ember-dim/20 px-3 py-1.5 text-xs text-ember-hot">
          {uploadError}
          <button onClick={() => setUploadError(null)} aria-label="Dismiss">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Who you are replying to */}
      {replyingTo && !recording && (
        <div className="mx-3 mt-2 flex items-center gap-2 rounded-lg border-l-2 border-ember bg-stage-overlay px-3 py-1.5 text-xs">
          <Reply className="h-3.5 w-3.5 shrink-0 text-ember" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-paper">Replying to {replyingTo.name}</p>
            <p className="truncate text-paper-muted">{replyingTo.snippet}</p>
          </div>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            aria-label="Cancel reply"
            className="shrink-0 text-paper-muted hover:text-paper"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {recording ? (
        <div className="flex items-center gap-3 border-t border-border p-3">
          <button
            type="button"
            onClick={cancelRecording}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-paper-muted hover:bg-stage-overlay hover:text-paper"
            aria-label="Cancel recording"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex flex-1 items-center gap-2 text-sm text-paper">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-ember" />
            Recording {formatSeconds(seconds)}
          </div>
          <button
            type="button"
            onClick={stopAndSend}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ember-gradient text-white"
            aria-label="Stop and send voice note"
          >
            <Square className="h-4 w-4 fill-current" />
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="relative flex items-center gap-2 border-t border-border p-3">
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

          <div ref={pickerWrapRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowPicker((v) => !v)}
              className={`flex h-10 w-10 items-center justify-center rounded-full hover:bg-stage-overlay hover:text-paper ${
                showPicker ? 'text-ember' : 'text-paper-muted'
              }`}
              aria-label="Add emoji"
            >
              <Smile className="h-4 w-4" />
            </button>

            {showPicker && (
              <div className="surface absolute bottom-12 left-0 z-20 w-64 rounded-xl2 p-2 shadow-card">
                <div
                  className="grid max-h-48 grid-cols-8 gap-0.5 overflow-y-auto"
                  style={{ fontFamily: EMOJI_FONT }}
                >
                  {EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => insertEmoji(emoji)}
                      className="flex h-7 w-7 items-center justify-center rounded text-lg hover:bg-stage-overlay"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <input
            ref={textInputRef}
            onFocus={() => window.dispatchEvent(new CustomEvent('syncspace:chat-focus', { detail: true }))}
            onBlur={() => window.dispatchEvent(new CustomEvent('syncspace:chat-focus', { detail: false }))}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              notifyTyping();
            }}
            placeholder={uploading ? 'Uploading...' : replyingTo ? 'Write your reply' : 'Send a message'}
            style={{ fontFamily: `Inter, ${EMOJI_FONT}` }}
            className="h-10 min-w-0 flex-1 rounded-full border border-border bg-stage-raised px-4 text-sm text-paper outline-none placeholder:text-paper-muted/60 focus:border-ember"
          />

          {draft.trim() ? (
            <button
              type="submit"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ember-gradient text-white"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              disabled={uploading}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ember-gradient text-white disabled:opacity-40"
              aria-label="Record voice note"
            >
              <Mic className="h-4 w-4" />
            </button>
          )}
        </form>
      )}
    </div>
  );
}