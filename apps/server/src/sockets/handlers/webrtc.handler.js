import { SOCKET_EVENTS } from '../../../../../packages/shared/constants/socketEvents.js';

function callChannel(roomId) {
  return `call:${roomId}`;
}

export function registerWebrtcHandlers(io, socket) {
  socket.on(SOCKET_EVENTS.WEBRTC_JOIN_CALL, ({ roomId }) => {
    socket.join(callChannel(roomId));
    socket.to(callChannel(roomId)).emit(SOCKET_EVENTS.WEBRTC_PEER_JOINED, {
      roomId,
      peerId: socket.userId,
    });
  });

  socket.on(SOCKET_EVENTS.WEBRTC_LEAVE_CALL, ({ roomId }) => {
    socket.leave(callChannel(roomId));
    socket.to(callChannel(roomId)).emit(SOCKET_EVENTS.WEBRTC_PEER_LEFT, {
      roomId,
      peerId: socket.userId,
    });
  });

  socket.on(SOCKET_EVENTS.WEBRTC_OFFER, ({ roomId, toUserId, offer }) => {
    io.to(callChannel(roomId)).emit(SOCKET_EVENTS.WEBRTC_OFFER, {
      fromUserId: socket.userId,
      toUserId,
      offer,
    });
  });

  socket.on(SOCKET_EVENTS.WEBRTC_ANSWER, ({ roomId, toUserId, answer }) => {
    io.to(callChannel(roomId)).emit(SOCKET_EVENTS.WEBRTC_ANSWER, {
      fromUserId: socket.userId,
      toUserId,
      answer,
    });
  });

  socket.on(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, ({ roomId, toUserId, candidate }) => {
    io.to(callChannel(roomId)).emit(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, {
      fromUserId: socket.userId,
      toUserId,
      candidate,
    });
  });

  socket.on('disconnect', () => {
    socket.rooms.forEach((room) => {
      if (room.startsWith('call:')) {
        socket.to(room).emit(SOCKET_EVENTS.WEBRTC_PEER_LEFT, { peerId: socket.userId });
      }
    });
  });
}