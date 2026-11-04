// apps/web/src/features/chat/hooks/useChat.js
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { getSocket } from '@/lib/socket';
import { messagesApi } from '../api/messagesApi';
import { selectCurrentUser } from '@/features/auth/authSlice';

const SOCKET_EVENTS = {
  CHAT_MESSAGE_NEW: 'chat:message-new',
  CHAT_MESSAGE_EDITED: 'chat:message-edited',
  CHAT_MESSAGE_DELETED: 'chat:message-deleted',
  CHAT_REACTION_ADDED: 'chat:reaction-added',
  CHAT_REACTION_REMOVED: 'chat:reaction-removed',
  CHAT_TYPING_START: 'chat:typing-start',
  CHAT_TYPING_STOP: 'chat:typing-stop',
  ROOM_ERROR: 'room:error',
};

export function useChat(roomId) {
  const socket = getSocket();
  const currentUser = useSelector(selectCurrentUser);

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState(new Map());
  const [error, setError] = useState(null);
  const typingTimeoutRef = useRef(null);
  const stopTypingTimersRef = useRef(new Map());

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    setLoading(true);
    messagesApi
      .list(roomId)
      .then((history) => {
        if (cancelled) return;
        setMessages([...history].reverse());
      })
      .catch(() => !cancelled && setError('Could not load message history'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;

    const onNewMessage = (message) => {
      if (message.roomId !== roomId) return;
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    };

    const onTypingStart = ({ roomId: rid, userId, username }) => {
      if (rid !== roomId || userId === currentUser?.id) return;
      setTypingUsers((prev) => {
        const next = new Map(prev);
        next.set(userId, username || 'Someone');
        return next;
      });
      clearTimeout(stopTypingTimersRef.current.get(userId));
      const timer = setTimeout(() => {
        setTypingUsers((prev) => {
          const next = new Map(prev);
          next.delete(userId);
          return next;
        });
      }, 4000);
      stopTypingTimersRef.current.set(userId, timer);
    };

    const onTypingStop = ({ roomId: rid, userId }) => {
      if (rid !== roomId) return;
      clearTimeout(stopTypingTimersRef.current.get(userId));
      setTypingUsers((prev) => {
        const next = new Map(prev);
        next.delete(userId);
        return next;
      });
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

    const onError = ({ message }) => setError(message);

    socket.on(SOCKET_EVENTS.CHAT_MESSAGE_NEW, onNewMessage);
    socket.on(SOCKET_EVENTS.CHAT_TYPING_START, onTypingStart);
    socket.on(SOCKET_EVENTS.CHAT_TYPING_STOP, onTypingStop);
    socket.on(SOCKET_EVENTS.CHAT_REACTION_ADDED, onReactionAdded);
    socket.on(SOCKET_EVENTS.ROOM_ERROR, onError);

    return () => {
      socket.off(SOCKET_EVENTS.CHAT_MESSAGE_NEW, onNewMessage);
      socket.off(SOCKET_EVENTS.CHAT_TYPING_START, onTypingStart);
      socket.off(SOCKET_EVENTS.CHAT_TYPING_STOP, onTypingStop);
      socket.off(SOCKET_EVENTS.CHAT_REACTION_ADDED, onReactionAdded);
      socket.off(SOCKET_EVENTS.ROOM_ERROR, onError);
      stopTypingTimersRef.current.forEach(clearTimeout);
      stopTypingTimersRef.current.clear();
    };
  }, [roomId, socket, currentUser?.id]);

  const sendMessage = useCallback(
    (content, replyToId) => {
      if (!content?.trim()) return;
      socket.emit(SOCKET_EVENTS.CHAT_MESSAGE_NEW, { roomId, content: content.trim(), replyToId });
    },
    [roomId, socket]
  );

  const notifyTyping = useCallback(() => {
    socket.emit(SOCKET_EVENTS.CHAT_TYPING_START, { roomId });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit(SOCKET_EVENTS.CHAT_TYPING_STOP, { roomId });
    }, 2500);
  }, [roomId, socket]);

  const react = useCallback(
    (messageId, emoji) => {
      socket.emit(SOCKET_EVENTS.CHAT_REACTION_ADDED, { roomId, messageId, emoji });
    },
    [roomId, socket]
  );

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