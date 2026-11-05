import { prisma } from '../../config/prisma.js';
import { logger } from '../../config/logger.js';
import { SOCKET_EVENTS } from '../../../../../packages/shared/constants/socketEvents.js';

// Tracks how many sockets a user has open, so presence only flips to OFFLINE
// once their last tab/device disconnects. (In-memory: fine for one server instance.)
const activeConnections = new Map();
const offlineTimers = new Map();
const OFFLINE_GRACE_MS = 5000; // a page refresh shouldn't flash "offline"

const userChannel = (userId) => `user:${userId}`;

async function friendIdsOf(userId) {
  const friendships = await prisma.friendship.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    select: { userAId: true, userBId: true },
  });
  return friendships.map((f) => (f.userAId === userId ? f.userBId : f.userAId));
}

async function setPresence(io, userId, status) {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: status === 'OFFLINE' ? { presenceStatus: status, lastSeenAt: new Date() } : { presenceStatus: status },
    });

    // Presence is private: only this user's friends are told
    const friendIds = await friendIdsOf(userId);
    friendIds.forEach((friendId) => {
      io.to(userChannel(friendId)).emit(SOCKET_EVENTS.PRESENCE_UPDATE, { userId, status });
    });
  } catch (err) {
    logger.error(`Presence update failed for ${userId}: ${err.message}`);
  }
}

export function registerPresenceHandlers(io, socket) {
  const { userId } = socket;

  activeConnections.set(userId, (activeConnections.get(userId) || 0) + 1);

  const pendingOffline = offlineTimers.get(userId);
  if (pendingOffline) {
    // Reconnected during the grace period (e.g. a refresh): they never went offline
    clearTimeout(pendingOffline);
    offlineTimers.delete(userId);
  } else if (activeConnections.get(userId) === 1) {
    setPresence(io, userId, 'ONLINE');
  }

  socket.on('disconnect', () => {
    const remaining = (activeConnections.get(userId) || 1) - 1;
    if (remaining > 0) {
      activeConnections.set(userId, remaining);
      return;
    }

    activeConnections.delete(userId);
    const timer = setTimeout(() => {
      offlineTimers.delete(userId);
      if (!activeConnections.has(userId)) setPresence(io, userId, 'OFFLINE');
    }, OFFLINE_GRACE_MS);
    offlineTimers.set(userId, timer);
  });
}