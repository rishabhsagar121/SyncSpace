import {prisma} from '../../config/prisma.js';

const senderSelect = {
  id: true,
  username: true,
  profile: { select: { displayName: true, avatarUrl: true } },
};

export function registerChatHandlers(io, socket) {
  const isMember = (roomId) =>
    prisma.roomMember.findUnique({ where: { roomId_userId: { roomId, userId: socket.user.id } } });

  socket.on('room:join', async ({ roomId } = {}, ack) => {
    try {
      if (!roomId || !(await isMember(roomId))) return ack?.({ ok: false, message: 'Not a member.' });
      socket.join(`room:${roomId}`);
      socket.to(`room:${roomId}`).emit('room:presence', { userId: socket.user.id, online: true });
      ack?.({ ok: true });
    } catch { ack?.({ ok: false, message: 'Could not join the room.' }); }
  });

  socket.on('room:leave', ({ roomId } = {}) => {
    if (!roomId) return;
    socket.leave(`room:${roomId}`);
    socket.to(`room:${roomId}`).emit('room:presence', { userId: socket.user.id, online: false });
  });

  socket.on('chat:send', async ({ roomId, content } = {}, ack) => {
    try {
      const text = String(content || '').trim().slice(0, 1000);
      if (!text) return ack?.({ ok: false, message: 'Message is empty.' });
      if (!socket.rooms.has(`room:${roomId}`)) return ack?.({ ok: false, message: 'Join the room first.' });
      const message = await prisma.message.create({
        data: { roomId, senderId: socket.user.id, content: text },
        include: { sender: { select: senderSelect } },
      });
      const formattedMessage = {
        ...message,
        sender: {
          id: message.sender.id,
          username: message.sender.username,
          displayName: message.sender.profile?.displayName || message.sender.username,
          avatarUrl: message.sender.profile?.avatarUrl || null,
        },
      };
      io.to(`room:${roomId}`).emit('chat:message', formattedMessage);
      ack?.({ ok: true });
    } catch { ack?.({ ok: false, message: 'Could not send the message.' }); }
  });

  socket.on('chat:typing', ({ roomId, typing } = {}) => {
    if (!roomId) return;
    socket.to(`room:${roomId}`).emit('chat:typing', { userId: socket.user.id, typing: !!typing });
  });
}