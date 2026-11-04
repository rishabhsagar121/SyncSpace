import { prisma } from '../../config/prisma.js';
import { SOCKET_EVENTS } from '../../../../../packages/shared/constants/socketEvents.js';

// Tracks how many sockets a user currently has open, so presence only
// flips to OFFLINE once their last tab/device disconnects.
const activeConnections = new Map();

export function registerPresenceHandlers(io, socket) {
  const { userId } = socket;

  const count = (activeConnections.get(userId) || 0) + 1;
  activeConnections.set(userId, count);

  if (count === 1) {
    prisma.user
      .update({ where: { id: userId }, data: { presenceStatus: 'ONLINE' } })
      .then(() => {
        io.emit(SOCKET_EVENTS.PRESENCE_UPDATE, { userId, status: 'ONLINE' });
      })
      .catch(() => {});
  }

  socket.on('disconnect', () => {
    const remaining = (activeConnections.get(userId) || 1) - 1;

    if (remaining <= 0) {
      activeConnections.delete(userId);
      prisma.user
        .update({
          where: { id: userId },
          data: { presenceStatus: 'OFFLINE', lastSeenAt: new Date() },
        })
        .then(() => {
          io.emit(SOCKET_EVENTS.PRESENCE_UPDATE, { userId, status: 'OFFLINE' });
        })
        .catch(() => {});
    } else {
      activeConnections.set(userId, remaining);
    }
  });
}