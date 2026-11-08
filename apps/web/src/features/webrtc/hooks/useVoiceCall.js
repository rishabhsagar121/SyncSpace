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

// STUN alone fails between many home/mobile/office networks. For calls to work outside
// your own Wi-Fi you need a TURN relay. Set these in Vercel (and apps/web/.env), then redeploy:
//   VITE_TURN_URL        one or more urls, comma separated
//   VITE_TURN_USERNAME
//   VITE_TURN_CREDENTIAL
const TURN_URLS = (import.meta.env.VITE_TURN_URL || '')
  .split(',')
  .map((u) => u.trim())
  .filter(Boolean);

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  ...(TURN_URLS.length
    ? [
        {
          urls: TURN_URLS,
          username: import.meta.env.VITE_TURN_USERNAME,
          credential: import.meta.env.VITE_TURN_CREDENTIAL,
        },
      ]
    : []),
];

const AUDIO_CONSTRAINTS = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
const VIDEO_CONSTRAINTS = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 } };
const DISCONNECT_GRACE_MS = 6000; // "disconnected" is often temporary; give it time to recover

export function useVoiceCall(roomId, currentUserId) {
  const socket = getSocket();
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [localStream, setLocalStream] = useState(null); // what my own tile shows (video only)
  // peerId -> { stream, video, sharing, muted }
  const [remotes, setRemotes] = useState({});

  // Refs, so socket listeners can stay subscribed and never see stale values
  const joinedRef = useRef(false);
  const mutedRef = useRef(false);
  const audioTrackRef = useRef(null);
  const cameraTrackRef = useRef(null);
  const screenTrackRef = useRef(null);
  const peersRef = useRef(new Map()); // peerId -> { pc, senders, channel, stream }
  const pendingIceRef = useRef(new Map()); // candidates that arrived before the offer/answer was applied
  const graceTimersRef = useRef(new Map());

  // ---------- local media helpers ----------
  const outgoingVideoTrack = useCallback(() => screenTrackRef.current || cameraTrackRef.current || null, []);

  const refreshPreview = useCallback(() => {
    const track = screenTrackRef.current || cameraTrackRef.current;
    setLocalStream(track ? new MediaStream([track]) : null);
  }, []);

  const myMediaState = useCallback(
    () => ({
      video: !!(screenTrackRef.current || cameraTrackRef.current),
      sharing: !!screenTrackRef.current,
      muted: mutedRef.current,
    }),
    []
  );

  // Camera / screen / mute state travels directly peer-to-peer over a data channel,
  // so the other side always knows whether to show a video or an avatar.
  const sendStateTo = useCallback(
    (peer) => {
      if (peer.channel?.readyState === 'open') peer.channel.send(JSON.stringify(myMediaState()));
    },
    [myMediaState]
  );

  const broadcastState = useCallback(() => {
    peersRef.current.forEach(sendStateTo);
  }, [sendStateTo]);

  const patchRemote = useCallback((peerId, patch) => {
    setRemotes((prev) => (prev[peerId] ? { ...prev, [peerId]: { ...prev[peerId], ...patch } } : prev));
  }, []);

  const replaceVideoOnAll = useCallback((track) => {
    peersRef.current.forEach((peer) => peer.senders.video?.replaceTrack(track).catch(() => {}));
  }, []);

  // ---------- peer lifecycle ----------
  const cleanupPeer = useCallback((peerId) => {
    clearTimeout(graceTimersRef.current.get(peerId));
    graceTimersRef.current.delete(peerId);
    pendingIceRef.current.delete(peerId);

    const peer = peersRef.current.get(peerId);
    if (peer) {
      peer.pc.onconnectionstatechange = null;
      peer.pc.close();
      peersRef.current.delete(peerId);
    }
    setRemotes((prev) => {
      if (!prev[peerId]) return prev;
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
  }, []);

  const setupChannel = useCallback(
    (peerId, peer, channel) => {
      peer.channel = channel;
      channel.onopen = () => sendStateTo(peer);
      channel.onmessage = (e) => {
        try {
          const s = JSON.parse(e.data);
          patchRemote(peerId, { video: !!s.video, sharing: !!s.sharing, muted: !!s.muted });
        } catch {
          /* ignore malformed state */
        }
      };
      if (channel.readyState === 'open') sendStateTo(peer);
    },
    [sendStateTo, patchRemote]
  );

  // Every connection has one audio and one video slot. Turning the camera or screen share
  // on/off swaps the track inside the slot, so no renegotiation is ever needed.
  const wireSenders = useCallback(
    (peer) => {
      peer.pc.getTransceivers().forEach((tx) => {
        const kind = tx.receiver?.track?.kind;
        if (kind !== 'audio' && kind !== 'video') return;
        tx.direction = 'sendrecv';
        peer.senders[kind] = tx.sender;
        const track = kind === 'audio' ? audioTrackRef.current : outgoingVideoTrack();
        if (track) tx.sender.replaceTrack(track).catch(() => {});
      });
    },
    [outgoingVideoTrack]
  );

  const createPeerConnection = useCallback(
    (peerId, { offerer }) => {
      if (peersRef.current.has(peerId)) cleanupPeer(peerId); // never leave a stale connection behind

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const peer = { pc, senders: {}, channel: null, stream: new MediaStream() };
      peersRef.current.set(peerId, peer);

      pc.ontrack = (e) => {
        if (!peer.stream.getTracks().includes(e.track)) peer.stream.addTrack(e.track);
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket?.emit(EVENTS.WEBRTC_ICE_CANDIDATE, { roomId, toUserId: peerId, candidate: e.candidate });
        }
      };

      pc.ondatachannel = (e) => setupChannel(peerId, peer, e.channel);

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === 'connected') {
          clearTimeout(graceTimersRef.current.get(peerId));
        } else if (state === 'disconnected') {
          graceTimersRef.current.set(
            peerId,
            setTimeout(() => {
              if (peersRef.current.get(peerId) === peer && pc.connectionState !== 'connected') cleanupPeer(peerId);
            }, DISCONNECT_GRACE_MS)
          );
        } else if (state === 'failed' || state === 'closed') {
          if (peersRef.current.get(peerId) === peer) cleanupPeer(peerId);
        }
      };

      if (offerer) {
        pc.addTransceiver('audio', { direction: 'sendrecv' });
        pc.addTransceiver('video', { direction: 'sendrecv' });
        wireSenders(peer);
        setupChannel(peerId, peer, pc.createDataChannel('state'));
      }
      // (the answering side wires its senders after the offer is applied)

      setRemotes((prev) => ({
        ...prev,
        [peerId]: prev[peerId] ?? { stream: peer.stream, video: false, sharing: false, muted: false },
      }));
      return peer;
    },
    [roomId, socket, cleanupPeer, setupChannel, wireSenders]
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
      const { pc } = createPeerConnection(peerId, { offerer: true });
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

  const stopAllLocalTracks = useCallback(() => {
    [audioTrackRef, cameraTrackRef, screenTrackRef].forEach((ref) => {
      if (ref.current) {
        ref.current.onended = null;
        ref.current.stop();
        ref.current = null;
      }
    });
    setLocalStream(null);
  }, []);

  const leaveCall = useCallback(() => {
    if (joinedRef.current) socket?.emit(EVENTS.WEBRTC_LEAVE_CALL, { roomId });
    [...peersRef.current.keys()].forEach(cleanupPeer);
    stopAllLocalTracks();
    joinedRef.current = false;
    mutedRef.current = false;
    setJoined(false);
    setMuted(false);
    setCameraOn(false);
    setSharing(false);
  }, [roomId, socket, cleanupPeer, stopAllLocalTracks]);

  // ---------- camera ----------
  const disableCamera = useCallback(() => {
    if (cameraTrackRef.current) {
      cameraTrackRef.current.onended = null;
      cameraTrackRef.current.stop();
      cameraTrackRef.current = null;
    }
    setCameraOn(false);
    if (!screenTrackRef.current) replaceVideoOnAll(null);
    refreshPreview();
    broadcastState();
  }, [replaceVideoOnAll, refreshPreview, broadcastState]);

  const enableCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: VIDEO_CONSTRAINTS });
      const track = stream.getVideoTracks()[0];
      track.onended = disableCamera; // e.g. the camera was unplugged
      cameraTrackRef.current = track;
      setCameraOn(true);
      if (!screenTrackRef.current) replaceVideoOnAll(track);
      refreshPreview();
      broadcastState();
    } catch {
      setError('Could not access the camera. Check the browser permission.');
    }
  }, [disableCamera, replaceVideoOnAll, refreshPreview, broadcastState]);

  const toggleCamera = useCallback(() => {
    if (!joinedRef.current) return;
    setError(null);
    return cameraTrackRef.current ? disableCamera() : enableCamera();
  }, [disableCamera, enableCamera]);

  // ---------- screen share ----------
  const stopShare = useCallback(() => {
    if (screenTrackRef.current) {
      screenTrackRef.current.onended = null;
      screenTrackRef.current.stop();
      screenTrackRef.current = null;
    }
    setSharing(false);
    replaceVideoOnAll(cameraTrackRef.current || null);
    refreshPreview();
    broadcastState();
  }, [replaceVideoOnAll, refreshPreview, broadcastState]);

  const toggleShare = useCallback(async () => {
    if (!joinedRef.current) return;
    if (screenTrackRef.current) return stopShare();
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError('Screen sharing is not supported on this device.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const track = stream.getVideoTracks()[0];
      track.onended = stopShare; // the browser's own "Stop sharing" button
      screenTrackRef.current = track;
      setSharing(true);
      replaceVideoOnAll(track);
      refreshPreview();
      broadcastState();
    } catch {
      /* the person closed the picker */
    }
  }, [stopShare, replaceVideoOnAll, refreshPreview, broadcastState]);

  // ---------- join ----------
  const joinCall = useCallback(
    async ({ video = false } = {}) => {
      if (joinedRef.current || connecting || !socket) return;
      setConnecting(true);
      setError(null);

      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Calls need a secure (https) page and a supported browser.');
        setConnecting(false);
        return;
      }

      let stream;
      let notice = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: AUDIO_CONSTRAINTS,
          video: video ? VIDEO_CONSTRAINTS : false,
        });
      } catch (err) {
        if (video) {
          // camera missing or blocked: fall back to voice only
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });
            notice = 'Camera unavailable, so you joined with voice only.';
          } catch (err2) {
            err = err2;
          }
        }
        if (!stream) {
          setError(
            err.name === 'NotAllowedError'
              ? 'Microphone permission was denied. Allow it in the browser address bar and try again.'
              : 'Could not access a microphone.'
          );
          setConnecting(false);
          return;
        }
      }

      audioTrackRef.current = stream.getAudioTracks()[0] ?? null;
      cameraTrackRef.current = stream.getVideoTracks()[0] ?? null;
      if (cameraTrackRef.current) cameraTrackRef.current.onended = disableCamera;

      const ack = await joinServerCall();
      if (!ack?.ok) {
        stopAllLocalTracks();
        setError(ack?.message || 'Could not join the call.');
        setConnecting(false);
        return;
      }

      joinedRef.current = true;
      mutedRef.current = false;
      setJoined(true);
      setMuted(false);
      setCameraOn(!!cameraTrackRef.current);
      refreshPreview();
      setConnecting(false);
      if (notice) setError(notice);

      // I'm the newcomer: I offer to everyone already in the call
      (ack.peers || []).forEach((peerId) => {
        offerTo(peerId).catch(() => setError('Could not connect to someone in the call.'));
      });
    },
    [socket, connecting, joinServerCall, stopAllLocalTracks, offerTo, disableCamera, refreshPreview]
  );

  // ---------- mute ----------
  const setMicMuted = useCallback(
    (next) => {
      if (audioTrackRef.current) audioTrackRef.current.enabled = !next;
      mutedRef.current = next;
      setMuted(next);
      broadcastState();
    },
    [broadcastState]
  );

  const toggleMute = useCallback(() => {
    if (audioTrackRef.current) setMicMuted(!mutedRef.current);
  }, [setMicMuted]);

  // ---------- signaling listeners ----------
  useEffect(() => {
    if (!roomId || !currentUserId || !socket) return;

    const onPeerLeft = ({ peerId }) => cleanupPeer(peerId);

    const onOffer = async ({ fromUserId, toUserId, offer }) => {
      if (toUserId !== currentUserId || !joinedRef.current) return;
      try {
        const peer = createPeerConnection(fromUserId, { offerer: false });
        await peer.pc.setRemoteDescription(new RTCSessionDescription(offer));
        wireSenders(peer);
        await flushPendingIce(fromUserId, peer.pc);
        const answer = await peer.pc.createAnswer();
        await peer.pc.setLocalDescription(answer);
        socket.emit(EVENTS.WEBRTC_ANSWER, { roomId, toUserId: fromUserId, answer });
      } catch {
        cleanupPeer(fromUserId);
      }
    };

    const onAnswer = async ({ fromUserId, toUserId, answer }) => {
      if (toUserId !== currentUserId) return;
      const peer = peersRef.current.get(fromUserId);
      if (!peer || peer.pc.signalingState !== 'have-local-offer') return;
      try {
        await peer.pc.setRemoteDescription(new RTCSessionDescription(answer));
        await flushPendingIce(fromUserId, peer.pc);
      } catch {
        cleanupPeer(fromUserId);
      }
    };

    const onIceCandidate = async ({ fromUserId, toUserId, candidate }) => {
      if (toUserId !== currentUserId || !candidate) return;
      const peer = peersRef.current.get(fromUserId);
      if (peer?.pc.remoteDescription) {
        try {
          await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch {
          /* a stale candidate is harmless */
        }
      } else {
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
    roomId, currentUserId, socket, cleanupPeer, createPeerConnection, wireSenders, flushPendingIce,
    joinServerCall, offerTo, leaveCall, setMicMuted,
  ]);

  // Leave cleanly if the component unmounts (e.g. navigating away from the room)
  useEffect(() => {
    const peers = peersRef.current;
    return () => {
      if (joinedRef.current) socket?.emit(EVENTS.WEBRTC_LEAVE_CALL, { roomId });
      peers.forEach((peer) => {
        peer.pc.onconnectionstatechange = null;
        peer.pc.close();
      });
      peers.clear();
      [audioTrackRef, cameraTrackRef, screenTrackRef].forEach((ref) => {
        ref.current?.stop();
        ref.current = null;
      });
      joinedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    joined, muted, cameraOn, sharing, connecting, error, localStream, remotes,
    peerCount: Object.keys(remotes).length,
    joinCall, leaveCall, toggleMute, toggleCamera, toggleShare,
  };
}