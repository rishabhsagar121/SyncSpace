import { Router } from 'express';
import {prisma} from '../../config/prisma.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const router = Router();
router.use(authMiddleware);

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
    sender: {
      id: r.sender.id,
      username: r.sender.username,
      displayName: r.sender.profile?.displayName || r.sender.username,
      avatarUrl: r.sender.profile?.avatarUrl || null,
    },
  }));
  res.json({ messages: formatted.reverse(), hasMore: rows.length === take });
}));

export default router;