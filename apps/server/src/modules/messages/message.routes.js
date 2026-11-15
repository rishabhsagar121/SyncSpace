import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { uploadAnyFile } from '../../utils/upload.js';
import { messageController } from './message.controller.js';

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const router = Router();
router.use(authMiddleware);

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

router.get('/room/:roomId', wrap(async (req, res) => {
  const member = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId: req.params.roomId, userId: req.user.id } },
  });
  if (!member) return res.status(403).json({ message: 'Join the room to see its chat.' });
  const take = 40;
  const rows = await prisma.message.findMany({
    where: { roomId: req.params.roomId },
    orderBy: { createdAt: 'desc' },
    take,
    ...(req.query.cursor ? { skip: 1, cursor: { id: String(req.query.cursor) } } : {}),
    include: {
      reactions: true,
      replyTo: { select: replySelect },
      sender: {
        select: {
          id: true,
          username: true,
          profile: { select: { displayName: true, avatarUrl: true } },
        },
      },
    },
  });
  const formatted = rows.map((r) => ({
    ...r,
    replyTo: shapeReply(r.replyTo),
    sender: {
      id: r.sender.id,
      username: r.sender.username,
      displayName: r.sender.profile?.displayName || r.sender.username,
      avatarUrl: r.sender.profile?.avatarUrl || null,
    },
  }));
  res.json({ messages: formatted.reverse(), hasMore: rows.length === take });
}));

// Upload a file or voice note into a room's chat
router.post('/room/:roomId/file', uploadAnyFile.single('file'), messageController.sendFile);

export default router;