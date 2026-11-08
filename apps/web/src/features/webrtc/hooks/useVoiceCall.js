// apps/web/src/features/webrtc/hooks/useVoiceCall.js
import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket } from '@/lib/socket';

const EVENTS = {
  WEBRTC_JOIN_CALL: 'webrtc:join-call',
  WEBRTC_LEAVE_CALL: 'webrtc:leave-call',
  WEBRTC_PEER_LEFT: 'webrtc:peer-left',
  WEBRTC_OFFER: 'webrtc:offer',
  WEBRTC_ANSWER: 'webrtc:answer',
  WEBRTC_ICE_CANDIDATE: 'webrtc:ice-candidate',
  ROOM_MEMBER_MUTED: 'room:member-muted',
};

// STUN works on friendly networks. Different networks / mobile data usually need TURN:
// set VITE_TURN_URL, VITE_TURN_USERNAME, VITE_TURN_CREDENTIAL (then redeploy the frontend).
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  ...(import.meta.env.VITE_TURN_URL
    ? [
        {
          urls: import.meta.env.VITE_TURN_URL,
          username: import.meta.env.VITE_TURN_USERNAME,
          credential: import.meta.env.VITE_TURN_CREDENTIAL,
        },
      ]
    : []),
];

const AUDIO_CONSTRAINTS = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
const DISCONNECT_GRACE_MS = 6000; // "disconnected" is often temporary; give it time to recover

export function useVoiceCall(roomId, currentUserId) {
  const socket = getSocket();
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [peerIds, setPeerIds] = useState([]); // who's in the call besides me

  // Refs, so socket listeners can stay subscribed and never see stale values
  const joinedRef = useRef(false);
  const mutedRef = useRef(false);
  const localStreamRef = useRef(null);
  const peersRef = useRef(new Map()); // peerId -> RTCPeerConnection
  const audioElsRef = useRef(new Map()); // peerId -> <audio>
  const pendingIceRef = useRef(new Map()); // peerId -> candidates that arrived too early
  const graceTimersRef = useRef(new Map());

  const cleanupPeer = useCallback((peerId) => {
    clearTimeout(graceTimersRef.current.get(peerId));
    graceTimersRef.current.delete(peerId);
    pendingIceRef.current.delete(peerId);

    const pc = peersRef.current.get(peerId);
    if (pc) {
      pc.onconnectionstatechange = null;
      pc.close();
      peersRef.current.delete(peerId);
    }
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
    el.play?.().catch(() => {}); // autoplay can be blocked until the user interacts
  }, []);

  const createPeerConnection = useCallback(
    (peerId) => {
      if (peersRef.current.has(peerId)) cleanupPeer(peerId); // never leave a stale connection behind

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      localStreamRef.current?.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current));

      pc.ontrack = (e) => playRemoteStream(peerId, e.streams[0]);

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket?.emit(EVENTS.WEBRTC_ICE_CANDIDATE, { roomId, toUserId: peerId, candidate: e.candidate });
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === 'connected') {
          clearTimeout(graceTimersRef.current.get(peerId));
        } else if (state === 'disconnected') {
          graceTimersRef.current.set(
            peerId,
            setTimeout(() => {
              if (peersRef.current.get(peerId) === pc && pc.connectionState !== 'connected') cleanupPeer(peerId);
            }, DISCONNECT_GRACE_MS)
          );
        } else if (state === 'failed' || state === 'closed') {
          if (peersRef.current.get(peerId) === pc) cleanupPeer(peerId);
        }
      };

      peersRef.current.set(peerId, pc);
      setPeerIds((prev) => (prev.includes(peerId) ? prev : [...prev, peerId]));
      return pc;
    },
    [roomId, socket, playRemoteStream, cleanupPeer]
  );

  const flushPendingIce = useCallback(async (peerId, pc) => {
    const queued = pendingIceRef.current.get(peerId) || [];
    pendingIceRef.current.delete(peerId);
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        /* a stale candidate is harmless */
      }
    }
  }, []);

  // The person who JOINS makes the offers (to everyone already in the call).
  // Only one side ever offers, so two people can't send offers at each other at once.
  const offerTo = useCallback(
    async (peerId) => {
      const pc = createPeerConnection(peerId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket?.emit(EVENTS.WEBRTC_OFFER, { roomId, toUserId: peerId, offer });
    },
    [roomId, socket, createPeerConnection]
  );

  const joinServerCall = useCallback(
    () =>
      new Promise((resolve) => {
        if (!socket) return resolve({ ok: false, message: 'Not connected to the server.' });
        socket.timeout(5000).emit(EVENTS.WEBRTC_JOIN_CALL, { roomId }, (err, ack) => {
          resolve(err ? { ok: false, message: 'The server did not respond.' } : ack);
        });
      }),
    [socket, roomId]
  );

  const stopLocalAudio = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
  }, []);

  const leaveCall = useCallback(() => {
    if (joinedRef.current) socket?.emit(EVENTS.WEBRTC_LEAVE_CALL, { roomId });
    [...peersRef.current.keys()].forEach(cleanupPeer);
    stopLocalAudio();
    joinedRef.current = false;
    mutedRef.current = false;
    setJoined(false);
    setMuted(false);
  }, [roomId, socket, cleanupPeer, stopLocalAudio]);

  const joinCall = useCallback(async () => {
    if (joinedRef.current || connecting || !socket) return;
    setConnecting(true);
    setError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Voice needs a secure (https) page and a supported browser.');
      setConnecting(false);
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });
    } catch (err) {
      setError(
        err.name === 'NotAllowedError'
          ? 'Microphone permission was denied. Allow it in the browser address bar and try again.'
          : 'Could not access a microphone.'
      );
      setConnecting(false);
      return;
    }

    localStreamRef.current = stream;
    const ack = await joinServerCall();
    if (!ack?.ok) {
      stopLocalAudio();
      setError(ack?.message || 'Could not join the call.');
      setConnecting(false);
      return;
    }

    joinedRef.current = true;
    mutedRef.current = false;
    setJoined(true);
    setMuted(false);
    setConnecting(false);

    (ack.peers || []).forEach((peerId) => {
      offerTo(peerId).catch(() => setError('Could not connect to someone in the call.'));
    });
  }, [socket, connecting, joinServerCall, stopLocalAudio, offerTo]);

  const setMicMuted = useCallback((next) => {
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    mutedRef.current = next;
    setMuted(next);
  }, []);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) setMicMuted(!mutedRef.current);
  }, [setMicMuted]);

  useEffect(() => {
    if (!roomId || !currentUserId || !socket) return;

    const onPeerLeft = ({ peerId }) => cleanupPeer(peerId);

    const onOffer = async ({ fromUserId, toUserId, offer }) => {
      if (toUserId !== currentUserId || !joinedRef.current) return;
      try {
        const pc = createPeerConnection(fromUserId);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await flushPendingIce(fromUserId, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit(EVENTS.WEBRTC_ANSWER, { roomId, toUserId: fromUserId, answer });
      } catch {
        cleanupPeer(fromUserId);
      }
    };

    const onAnswer = async ({ fromUserId, toUserId, answer }) => {
      if (toUserId !== currentUserId) return;
      const pc = peersRef.current.get(fromUserId);
      if (!pc || pc.signalingState !== 'have-local-offer') return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await flushPendingIce(fromUserId, pc);
      } catch {
        cleanupPeer(fromUserId);
      }
    };

    const onIceCandidate = async ({ fromUserId, toUserId, candidate }) => {
      if (toUserId !== currentUserId || !candidate) return;
      const pc = peersRef.current.get(fromUserId);
      if (pc?.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch {
          /* a stale candidate is harmless */
        }
      } else {
        // The offer or answer hasn't been processed yet: keep the candidate for later
        const queue = pendingIceRef.current.get(fromUserId) || [];
        queue.push(new RTCIceCandidate(candidate));
        pendingIceRef.current.set(fromUserId, queue);
      }
    };

    // The host muted me
    const onMemberMuted = ({ roomId: mutedRoomId, userId, isMuted }) => {
      if (mutedRoomId === roomId && userId === currentUserId && isMuted) setMicMuted(true);
    };

    // After a network drop the server forgets this socket was in the call: join again
    const onReconnect = async () => {
      if (!joinedRef.current) return;
      [...peersRef.current.keys()].forEach(cleanupPeer);
      const ack = await joinServerCall();
      if (ack?.ok) {
        (ack.peers || []).forEach((peerId) => offerTo(peerId).catch(() => {}));
      } else {
        leaveCall();
        setError('Lost connection to the call. Please join again.');
      }
    };

    socket.on(EVENTS.WEBRTC_PEER_LEFT, onPeerLeft);
    socket.on(EVENTS.WEBRTC_OFFER, onOffer);
    socket.on(EVENTS.WEBRTC_ANSWER, onAnswer);
    socket.on(EVENTS.WEBRTC_ICE_CANDIDATE, onIceCandidate);
    socket.on(EVENTS.ROOM_MEMBER_MUTED, onMemberMuted);
    socket.on('connect', onReconnect);

    return () => {
      socket.off(EVENTS.WEBRTC_PEER_LEFT, onPeerLeft);
      socket.off(EVENTS.WEBRTC_OFFER, onOffer);
      socket.off(EVENTS.WEBRTC_ANSWER, onAnswer);
      socket.off(EVENTS.WEBRTC_ICE_CANDIDATE, onIceCandidate);
      socket.off(EVENTS.ROOM_MEMBER_MUTED, onMemberMuted);
      socket.off('connect', onReconnect);
    };
  }, [
    roomId, currentUserId, socket, cleanupPeer, createPeerConnection, flushPendingIce,
    joinServerCall, offerTo, leaveCall, setMicMuted,
  ]);

  // Leave cleanly if the component unmounts (e.g. navigating away from the room)
  useEffect(() => {
    const peers = peersRef.current;
    const audioEls = audioElsRef.current;
    return () => {
      if (joinedRef.current) socket?.emit(EVENTS.WEBRTC_LEAVE_CALL, { roomId });
      peers.forEach((pc) => {
        pc.onconnectionstatechange = null;
        pc.close();
      });
      peers.clear();
      audioEls.forEach((el) => el.remove());
      audioEls.clear();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      joinedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { joined, muted, connecting, error, peerCount: peerIds.length, joinCall, leaveCall, toggleMute };
}