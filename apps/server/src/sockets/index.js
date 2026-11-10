// apps/server/src/sockets/index.js
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { socketAuth } from './middleware/socketAuth.js';
import { domainEvents } from '../utils/domainEvents.js';
import { SOCKET_EVENTS } from '../../../../packages/shared/constants/socketEvents.js';

import { registerPresenceHandlers } from './handlers/presence.handler.js';
import { registerRoomHandlers, bridgeRoomDomainEvents } from './handlers/room.handler.js';
import { registerChatHandlers } from './handlers/chat.handler.js';
import { registerSyncHandlers } from './handlers/sync.handler.js';
import { registerWebrtcHandlers } from './handlers/webrtc.handler.js';
import { registerMusicHandlers } from './handlers/music.handler.js';

function userChannel(userId) {
  return `user:${userId}`;
}

function roomChannel(roomId) {
  return `room:${roomId}`;
}

export function initSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.CLIENT_URL, credentials: true },
  });

  io.use(socketAuth);

  io.on('connection', (socket) => {
    socket.join(userChannel(socket.userId));

    registerPresenceHandlers(io, socket);
    registerRoomHandlers(io, socket);
    registerChatHandlers(io, socket);
    registerSyncHandlers(io, socket);
    registerWebrtcHandlers(io, socket);
    registerMusicHandlers(io, socket);
  });

  bridgeRoomDomainEvents(io, domainEvents);

  // Someone who leaves or is kicked stops receiving the room's music
  const removeFromMusic = ({ roomId, userId }) => {
    io.in(userChannel(userId)).socketsLeave(`music:${roomId}`);
  };
  domainEvents.on('room:member-left', removeFromMusic);
  domainEvents.on('room:member-kicked', removeFromMusic);

  domainEvents.on('notification:created', ({ userId, notification }) => {
    io.to(userChannel(userId)).emit(SOCKET_EVENTS.NOTIFICATION_NEW, notification);
  });

  domainEvents.on('message:created', ({ roomId, message }) => {
    io.to(roomChannel(roomId)).emit(SOCKET_EVENTS.CHAT_MESSAGE_NEW, message);
  });

  return io;
}