import { SOCKET_EVENTS } from '../../../../../packages/shared/constants/socketEvents.js';
import { roomRepository } from '../../modules/rooms/room.repository.js';
import { logger } from '../../config/logger.js';

const MAX_CALL_PEERS = 6; // mesh P2P: everyone connects to everyone, so keep it small

const callChannel = (roomId) => `call:${roomId}`;
const userChannel = (userId) => `user:${userId}`;

export function registerWebrtcHandlers(io, socket) {
  socket.data.userId = socket.userId; // lets fetchSockets() tell us who is who

  const inCall = (roomId) => !!roomId && socket.rooms.has(callChannel(roomId));

  socket.on(SOCKET_EVENTS.WEBRTC_JOIN_CALL, async ({ roomId } = {}, ack) => {
    try {
      if (!roomId) return ack?.({ ok: false, message: 'roomId is required.' });

      const membership = await roomRepository.findMembership(roomId, socket.userId);
      if (!membership || membership.leftAt) {
        return ack?.({ ok: false, message: 'You are not a member of this room.' });
      }

      const sockets = await io.in(callChannel(roomId)).fetchSockets();
      const peerIds = [...new Set(sockets.map((s) => s.data?.userId).filter(Boolean))].filter(
        (id) => id !== socket.userId
      );

      if (!inCall(roomId) && peerIds.length + 1 > MAX_CALL_PEERS) {
        return ack?.({ ok: false, message: `Calls support up to ${MAX_CALL_PEERS} people.` });
      }

      socket.join(callChannel(roomId));
      socket.to(callChannel(roomId)).emit(SOCKET_EVENTS.WEBRTC_PEER_JOINED, {
        roomId,
        peerId: socket.userId,
      });
      ack?.({ ok: true, peers: peerIds }); // who is already in the call
    } catch (err) {
      logger.error(`WEBRTC_JOIN_CALL failed: ${err.message}`);
      ack?.({ ok: false, message: 'Could not join the call.' });
    }
  });

  const leaveCall = (roomId) => {
    if (!inCall(roomId)) return;
    socket.leave(callChannel(roomId));
    socket.to(callChannel(roomId)).emit(SOCKET_EVENTS.WEBRTC_PEER_LEFT, {
      roomId,
      peerId: socket.userId,
    });
  };

  socket.on(SOCKET_EVENTS.WEBRTC_LEAVE_CALL, ({ roomId } = {}) => leaveCall(roomId));

  // Signaling goes ONLY to the intended person, and only if both are in the call
  const relay = (event, field) => async ({ roomId, toUserId, [field]: data } = {}) => {
    try {
      if (!inCall(roomId) || !toUserId || toUserId === socket.userId || data == null) return;

      const targets = await io.in(userChannel(toUserId)).fetchSockets();
      targets
        .filter((s) => s.rooms.has(callChannel(roomId)))
        .forEach((s) => {
          io.to(s.id).emit(event, { roomId, fromUserId: socket.userId, toUserId, [field]: data });
        });
    } catch (err) {
      logger.error(`${event} relay failed: ${err.message}`);
    }
  };

  socket.on(SOCKET_EVENTS.WEBRTC_OFFER, relay(SOCKET_EVENTS.WEBRTC_OFFER, 'offer'));
  socket.on(SOCKET_EVENTS.WEBRTC_ANSWER, relay(SOCKET_EVENTS.WEBRTC_ANSWER, 'answer'));
  socket.on(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, relay(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, 'candidate'));

  // 'disconnecting' (not 'disconnect'): rooms are already emptied by the time 'disconnect' fires
  socket.on('disconnecting', () => {
    for (const room of socket.rooms) {
      if (room.startsWith('call:')) {
        socket.to(room).emit(SOCKET_EVENTS.WEBRTC_PEER_LEFT, {
          roomId: room.slice('call:'.length),
          peerId: socket.userId,
        });
      }
    }
  });
}