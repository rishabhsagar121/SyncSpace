import { prisma } from '../../config/prisma.js';
import { logger } from '../../config/logger.js';

const senderSelect = {
  id: true,
  username: true,
  profile: { select: { displayName: true, avatarUrl: true } },
};

// The message being replied to, shown as a small quote above the reply
const replySelect = {
  id: true,
  content: true,
  type: true,
  fileName: true,
  sender: { select: { username: true, profile: { select: { displayName: true } } } },
};

const shapeReply = (reply) =>
  reply
    ? {
        id: reply.id,
        content: reply.content,
        type: reply.type,
        fileName: reply.fileName,
        senderName: reply.sender?.profile?.displayName || reply.sender?.username || 'Someone',
      }
    : null;

const MAX_LENGTH = 1000;
const RATE_LIMIT = { count: 5, windowMs: 5000 };

const roomChannel = (roomId) => `room:${roomId}`;

export function registerChatHandlers(io, socket) {
  // Room joining/leaving is handled in room.handler.js (one owner, so rules stay consistent)
  const userId = () => socket.userId ?? socket.user?.id;
  const sentAt = []; // timestamps of this connection's recent messages

  const isRateLimited = () => {
    const now = Date.now();
    while (sentAt.length && now - sentAt[0] > RATE_LIMIT.windowMs) sentAt.shift();
    if (sentAt.length >= RATE_LIMIT.count) return true;
    sentAt.push(now);
    return false;
  };

  const inRoom = (roomId) => !!roomId && socket.rooms.has(roomChannel(roomId));

  socket.on('chat:send', async ({ roomId, content, replyToId } = {}, ack) => {
    try {
      const text = String(content || '').trim().slice(0, MAX_LENGTH);
      if (!text) return ack?.({ ok: false, message: 'Message is empty.' });
      if (!inRoom(roomId)) return ack?.({ ok: false, message: 'Join the room first.' });
      if (isRateLimited()) return ack?.({ ok: false, message: 'You are sending messages too fast.' });

      // Checked on every message: the user may have been kicked or muted since joining
      const membership = await prisma.roomMember.findUnique({
        where: { roomId_userId: { roomId, userId: userId() } },
      });
      if (!membership || membership.leftAt) {
        return ack?.({ ok: false, message: 'You are no longer in this room.' });
      }
      if (membership.isMuted) return ack?.({ ok: false, message: 'You are muted by the host.' });

      // A reply must point at a message from this same room
      let replyId = null;
      if (typeof replyToId === 'string' && replyToId) {
        const original = await prisma.message.findFirst({
          where: { id: replyToId, roomId, deletedAt: null },
          select: { id: true },
        });
        replyId = original?.id ?? null;
      }

      const message = await prisma.message.create({
        data: { roomId, senderId: userId(), content: text, ...(replyId ? { replyToId: replyId } : {}) },
        include: { sender: { select: senderSelect }, replyTo: { select: replySelect } },
      });

      io.to(roomChannel(roomId)).emit('chat:message', {
        ...message,
        reactions: [],
        replyTo: shapeReply(message.replyTo),
        sender: {
          id: message.sender.id,
          username: message.sender.username,
          displayName: message.sender.profile?.displayName || message.sender.username,
          avatarUrl: message.sender.profile?.avatarUrl || null,
        },
      });
      ack?.({ ok: true });
    } catch (err) {
      logger.error(`chat:send failed: ${err.message}`);
      ack?.({ ok: false, message: 'Could not send the message.' });
    }
  });

  // Click an emoji reaction once to add it, click it again to remove it
  socket.on('chat:reaction-added', async ({ roomId, messageId, emoji } = {}) => {
    try {
      const symbol = String(emoji || '').trim();
      if (!symbol || symbol.length > 8 || !messageId || !inRoom(roomId)) return;

      const membership = await prisma.roomMember.findUnique({
        where: { roomId_userId: { roomId, userId: userId() } },
      });
      if (!membership || membership.leftAt) return;

      const message = await prisma.message.findUnique({
        where: { id: messageId },
        select: { roomId: true },
      });
      if (!message || message.roomId !== roomId) return;

      const where = { messageId_userId_emoji: { messageId, userId: userId(), emoji: symbol } };
      const existing = await prisma.messageReaction.findUnique({ where });

      if (existing) {
        await prisma.messageReaction.delete({ where });
        io.to(roomChannel(roomId)).emit('chat:reaction-removed', {
          roomId,
          messageId,
          userId: userId(),
          emoji: symbol,
        });
      } else {
        await prisma.messageReaction.create({
          data: { messageId, userId: userId(), emoji: symbol },
        });
        io.to(roomChannel(roomId)).emit('chat:reaction-added', {
          roomId,
          messageId,
          userId: userId(),
          emoji: symbol,
        });
      }
    } catch (err) {
      logger.error(`chat:reaction failed: ${err.message}`);
    }
  });

  socket.on('chat:typing', ({ roomId, typing } = {}) => {
    if (!inRoom(roomId)) return;
    socket.to(roomChannel(roomId)).emit('chat:typing', { userId: userId(), typing: !!typing });
  });
}