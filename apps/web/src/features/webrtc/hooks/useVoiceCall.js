// apps/web/src/features/webrtc/hooks/useVoiceCall.js
import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket } from '@/lib/socket';

const EVENTS = {
  WEBRTC_JOIN_CALL: 'webrtc:join-call',
  WEBRTC_LEAVE_CALL: 'webrtc:leave-call',
  WEBRTC_PEER_JOINED: 'webrtc:peer-joined',
  WEBRTC_PEER_LEFT: 'webrtc:peer-left',
  WEBRTC_OFFER: 'webrtc:offer',
  WEBRTC_ANSWER: 'webrtc:answer',
  WEBRTC_ICE_CANDIDATE: 'webrtc:ice-candidate',
};

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  // Add a TURN server here for reliability behind restrictive NATs, e.g.:
  // { urls: 'turn:your-turn-host:3478', username: '...', credential: '...' },
];

export function useVoiceCall(roomId, currentUserId) {
  const socket = getSocket();
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [peerIds, setPeerIds] = useState([]); // who's currently in the call (besides me)

  const localStreamRef = useRef(null);
  const peersRef = useRef(new Map()); // peerId -> RTCPeerConnection
  const audioElsRef = useRef(new Map()); // peerId -> HTMLAudioElement

  const cleanupPeer = useCallback((peerId) => {
    peersRef.current.get(peerId)?.close();
    peersRef.current.delete(peerId);
    const el = audioElsRef.current.get(peerId);
    if (el) {
      el.srcObject = null;
      el.remove();
      audioElsRef.current.delete(peerId);
    }
    setPeerIds((prev) => prev.filter((id) => id !== peerId));
  }, []);

  const playRemoteStream = useCallback((peerId, stream) => {
    let el = audioElsRef.current.get(peerId);
    if (!el) {
      el = document.createElement('audio');
      el.autoplay = true;
      el.dataset.peerId = peerId;
      document.body.appendChild(el);
      audioElsRef.current.set(peerId, el);
    }
    el.srcObject = stream;
  }, []);

  const createPeerConnection = useCallback(
    (peerId) => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      localStreamRef.current?.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });

      pc.ontrack = (e) => {
        playRemoteStream(peerId, e.streams[0]);
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit(EVENTS.WEBRTC_ICE_CANDIDATE, {
            roomId,
            toUserId: peerId,
            candidate: e.candidate,
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
          cleanupPeer(peerId);
        }
      };

      peersRef.current.set(peerId, pc);
      setPeerIds((prev) => (prev.includes(peerId) ? prev : [...prev, peerId]));
      return pc;
    },
    [roomId, socket, playRemoteStream, cleanupPeer]
  );

  // Existing member -> initiates offer to a newcomer
  const initiateOfferTo = useCallback(
    async (peerId) => {
      const pc = createPeerConnection(peerId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit(EVENTS.WEBRTC_OFFER, { roomId, toUserId: peerId, offer });
    },
    [roomId, socket, createPeerConnection]
  );

  useEffect(() => {
    if (!roomId || !currentUserId) return;

    const onPeerJoined = ({ peerId }) => {
      if (peerId === currentUserId || !joined) return;
      // I was already in the call; the newcomer will receive my offer.
      initiateOfferTo(peerId);
    };

    const onPeerLeft = ({ peerId }) => {
      cleanupPeer(peerId);
    };

    const onOffer = async ({ fromUserId, toUserId, offer }) => {
      if (toUserId !== currentUserId || !joined) return;
      const pc = createPeerConnection(fromUserId);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit(EVENTS.WEBRTC_ANSWER, { roomId, toUserId: fromUserId, answer });
    };

    const onAnswer = async ({ fromUserId, toUserId, answer }) => {
      if (toUserId !== currentUserId) return;
      const pc = peersRef.current.get(fromUserId);
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    };

    const onIceCandidate = async ({ fromUserId, toUserId, candidate }) => {
      if (toUserId !== currentUserId) return;
      const pc = peersRef.current.get(fromUserId);
      if (!pc) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // benign if it arrives before remote description is set
      }
    };

    socket.on(EVENTS.WEBRTC_PEER_JOINED, onPeerJoined);
    socket.on(EVENTS.WEBRTC_PEER_LEFT, onPeerLeft);
    socket.on(EVENTS.WEBRTC_OFFER, onOffer);
    socket.on(EVENTS.WEBRTC_ANSWER, onAnswer);
    socket.on(EVENTS.WEBRTC_ICE_CANDIDATE, onIceCandidate);

    return () => {
      socket.off(EVENTS.WEBRTC_PEER_JOINED, onPeerJoined);
      socket.off(EVENTS.WEBRTC_PEER_LEFT, onPeerLeft);
      socket.off(EVENTS.WEBRTC_OFFER, onOffer);
      socket.off(EVENTS.WEBRTC_ANSWER, onAnswer);
      socket.off(EVENTS.WEBRTC_ICE_CANDIDATE, onIceCandidate);
    };
  }, [roomId, currentUserId, socket, joined, initiateOfferTo, createPeerConnection, cleanupPeer]);

  const leaveCall = useCallback(() => {
    socket.emit(EVENTS.WEBRTC_LEAVE_CALL, { roomId });
    peersRef.current.forEach((_, peerId) => cleanupPeer(peerId));
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setJoined(false);
    setMuted(false);
  }, [roomId, socket, cleanupPeer]);

  const joinCall = useCallback(async () => {
    if (joined || connecting) return;
    setConnecting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      socket.emit(EVENTS.WEBRTC_JOIN_CALL, { roomId });
      setJoined(true);
    } catch {
      // mic permission denied or unavailable — surface via `connecting` reset
    } finally {
      setConnecting(false);
    }
  }, [roomId, socket, joined, connecting]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextMuted = !muted;
    stream.getAudioTracks().forEach((t) => (t.enabled = !nextMuted));
    setMuted(nextMuted);
  }, [muted]);

  // Leave cleanly if the component unmounts (e.g. navigating away from the room)
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        socket.emit(EVENTS.WEBRTC_LEAVE_CALL, { roomId });
        peersRef.current.forEach((pc) => pc.close());
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        audioElsRef.current.forEach((el) => el.remove());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { joined, muted, connecting, peerCount: peerIds.length, joinCall, leaveCall, toggleMute };
}