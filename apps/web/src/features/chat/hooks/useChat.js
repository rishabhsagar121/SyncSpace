// apps/web/src/features/chat/hooks/useChat.js
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { getSocket } from '@/lib/socket';
import { messagesApi } from '../api/messagesApi';
import { selectCurrentUser } from '@/features/auth/authSlice';

const EVENTS = {
  SEND: 'chat:send',
  MESSAGE: 'chat:message',
  MESSAGE_NEW: 'chat:message-new', // used when a file message is broadcast after an upload
  TYPING: 'chat:typing',
  REACTION_ADDED: 'chat:reaction-added',
  REACTION_REMOVED: 'chat:reaction-removed',
  ROOM_ERROR: 'room:error',
};

export function useChat(roomId) {
  const socket = getSocket();
  const currentUser = useSelector(selectCurrentUser);

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState(new Map());
  const [error, setError] = useState(null);

  const messagesRef = useRef([]);
  const typingTimeoutRef = useRef(null);
  const typingTimersRef = useRef(new Map());

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Load history
  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    setLoading(true);
    setMessages([]);
    messagesApi
      .list(roomId)
      .then((history) => {
        if (cancelled) return;
        const sorted = [...history].sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        );
        setMessages(sorted);
      })
      .catch(() => !cancelled && setError('Could not load message history'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  // Live events
  useEffect(() => {
    if (!roomId) return;

    const onNewMessage = (message) => {
      if (!message || message.roomId !== roomId) return;
      setError(null);
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    };

    const onTyping = ({ userId, typing } = {}) => {
      if (!userId || userId === currentUser?.id) return;
      clearTimeout(typingTimersRef.current.get(userId));

      if (!typing) {
        setTypingUsers((prev) => {
          const next = new Map(prev);
          next.delete(userId);
          return next;
        });
        return;
      }

      const known = messagesRef.current.find((m) => m.sender?.id === userId)?.sender;
      const name = known?.displayName || known?.username || 'Someone';

      setTypingUsers((prev) => {
        const next = new Map(prev);
        next.set(userId, name);
        return next;
      });

      const timer = setTimeout(() => {
        setTypingUsers((prev) => {
          const next = new Map(prev);
          next.delete(userId);
          return next;
        });
      }, 4000);
      typingTimersRef.current.set(userId, timer);
    };

    const onReactionAdded = ({ messageId, userId, emoji }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const reactions = m.reactions || [];
          if (reactions.some((r) => r.userId === userId && r.emoji === emoji)) return m;
          return { ...m, reactions: [...reactions, { userId, emoji, messageId }] };
        })
      );
    };

    const onReactionRemoved = ({ messageId, userId, emoji }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          return {
            ...m,
            reactions: (m.reactions || []).filter((r) => !(r.userId === userId && r.emoji === emoji)),
          };
        })
      );
    };

    const onRoomError = ({ message }) => setError(message);

    socket.on(EVENTS.MESSAGE, onNewMessage);
    socket.on(EVENTS.MESSAGE_NEW, onNewMessage);
    socket.on(EVENTS.TYPING, onTyping);
    socket.on(EVENTS.REACTION_ADDED, onReactionAdded);
    socket.on(EVENTS.REACTION_REMOVED, onReactionRemoved);
    socket.on(EVENTS.ROOM_ERROR, onRoomError);

    return () => {
      socket.off(EVENTS.MESSAGE, onNewMessage);
      socket.off(EVENTS.MESSAGE_NEW, onNewMessage);
      socket.off(EVENTS.TYPING, onTyping);
      socket.off(EVENTS.REACTION_ADDED, onReactionAdded);
      socket.off(EVENTS.REACTION_REMOVED, onReactionRemoved);
      socket.off(EVENTS.ROOM_ERROR, onRoomError);
      typingTimersRef.current.forEach(clearTimeout);
      typingTimersRef.current.clear();
    };
  }, [roomId, socket, currentUser?.id]);

  const sendMessage = useCallback(
    (content) => {
      const text = content?.trim();
      if (!text) return;
      socket.emit(EVENTS.SEND, { roomId, content: text }, (res) => {
        if (res && res.ok === false) setError(res.message || 'Could not send the message.');
        else setError(null);
      });
      clearTimeout(typingTimeoutRef.current);
      socket.emit(EVENTS.TYPING, { roomId, typing: false });
    },
    [roomId, socket]
  );

  const notifyTyping = useCallback(() => {
    socket.emit(EVENTS.TYPING, { roomId, typing: true });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit(EVENTS.TYPING, { roomId, typing: false });
    }, 2500);
  }, [roomId, socket]);

  const react = useCallback(
    (messageId, emoji) => {
      socket.emit(EVENTS.REACTION_ADDED, { roomId, messageId, emoji });
    },
    [roomId, socket]
  );

  useEffect(() => () => clearTimeout(typingTimeoutRef.current), []);

  return {
    messages,
    loading,
    error,
    typingUsers: Array.from(typingUsers.values()),
    sendMessage,
    notifyTyping,
    react,
  };
}