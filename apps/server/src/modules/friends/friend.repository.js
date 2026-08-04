import { prisma } from '../../config/prisma.js';

// Enforce userA < userB ordering for the symmetric Friendship table
function orderedPair(a, b) {
  return a < b ? [a, b] : [b, a];
}

export const friendRepository = {
  findPendingRequest: (senderId, receiverId) =>
    prisma.friendRequest.findFirst({
      where: { senderId, receiverId, status: 'PENDING' },
    }),

  findRequestById: (id) => prisma.friendRequest.findUnique({ where: { id } }),

  createRequest: (senderId, receiverId) =>
    prisma.friendRequest.create({ data: { senderId, receiverId } }),

  updateRequestStatus: (id, status) =>
    prisma.friendRequest.update({ where: { id }, data: { status } }),

  listIncoming: (userId) =>
    prisma.friendRequest.findMany({
      where: { receiverId: userId, status: 'PENDING' },
      include: { sender: { select: { id: true, username: true, profile: true } } },
      orderBy: { createdAt: 'desc' },
    }),

  listOutgoing: (userId) =>
    prisma.friendRequest.findMany({
      where: { senderId: userId, status: 'PENDING' },
      include: { receiver: { select: { id: true, username: true, profile: true } } },
      orderBy: { createdAt: 'desc' },
    }),

  areFriends: async (userIdA, userIdB) => {
    const [userAId, userBId] = orderedPair(userIdA, userIdB);
    const friendship = await prisma.friendship.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
    });
    return !!friendship;
  },

  createFriendship: (userIdA, userIdB) => {
    const [userAId, userBId] = orderedPair(userIdA, userIdB);
    return prisma.friendship.create({ data: { userAId, userBId } });
  },

  removeFriendship: (userIdA, userIdB) => {
    const [userAId, userBId] = orderedPair(userIdA, userIdB);
    return prisma.friendship.deleteMany({ where: { userAId, userBId } });
  },

  listFriends: (userId) =>
    prisma.friendship.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      include: {
        userA: { select: { id: true, username: true, profile: true, presenceStatus: true, lastSeenAt: true } },
        userB: { select: { id: true, username: true, profile: true, presenceStatus: true, lastSeenAt: true } },
      },
    }),

  blockUser: (blockerId, blockedId) =>
    prisma.blockedUser.create({ data: { blockerId, blockedId } }),

  unblockUser: (blockerId, blockedId) =>
    prisma.blockedUser.deleteMany({ where: { blockerId, blockedId } }),

  isBlocked: async (userIdA, userIdB) => {
    const block = await prisma.blockedUser.findFirst({
      where: {
        OR: [
          { blockerId: userIdA, blockedId: userIdB },
          { blockerId: userIdB, blockedId: userIdA },
        ],
      },
    });
    return !!block;
  },

  listBlocked: (userId) =>
    prisma.blockedUser.findMany({
      where: { blockerId: userId },
      include: { blocked: { select: { id: true, username: true, profile: true } } },
    }),
};