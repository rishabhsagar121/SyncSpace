// apps/web/src/features/sync/hooks/useStreamRoom.js
import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket } from '@/lib/socket';

// Same TURN settings as the call code: needed for people on different networks
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

const MAX_BITRATE = 3000000; // video, per viewer, in bits per second
const AUDIO_BITRATE = 128000; // movie sound: stereo, much clearer than the default voice setting
const JITTER_BUFFER_MS = 400; // a little extra buffer on the viewer side: fewer crackles
const STATE_EVERY_MS = 1000;
const CONNECT_TIMEOUT_MS = 20000;

// By default WebRTC audio is tuned for a phone call (mono, low bitrate). This asks for stereo, high quality.
function tuneOpus(sdp) {
  if (!sdp) return sdp;
  const rtpmap = /a=rtpmap:(\d+) opus\/48000\/2/i.exec(sdp);
  if (!rtpmap) return sdp;
  const pt = rtpmap[1];
  const wanted = {
    stereo: '1',
    'sprop-stereo': '1',
    maxaveragebitrate: String(AUDIO_BITRATE),
    useinbandfec: '1',
    usedtx: '0',
  };

  const fmtp = new RegExp(`a=fmtp:${pt} ([^\\r\\n]*)`).exec(sdp);
  if (fmtp) {
    const params = new Map(
      fmtp[1]
        .split(';')
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => {
          const [k, ...v] = p.split('=');
          return [k, v.join('=')];
        })
    );
    Object.entries(wanted).forEach(([k, v]) => params.set(k, v));
    const line = `a=fmtp:${pt} ${[...params].map(([k, v]) => (v === '' ? k : `${k}=${v}`)).join(';')}`;
    return sdp.replace(fmtp[0], line);
  }
  const line = `a=fmtp:${pt} ${Object.entries(wanted)
    .map(([k, v]) => `${k}=${v}`)
    .join(';')}`;
  return sdp.replace(rtpmap[0], `${rtpmap[0]}\r\n${line}`);
}

function sendJson(channel, obj) {
  if (channel?.readyState !== 'open') return;
  try {
    channel.send(JSON.stringify(obj));
  } catch {
    /* the channel is closing */
  }
}

function buildState(v) {
  if (!v || !Number.isFinite(v.duration)) return null;
  return {
    t: 'state',
    positionMs: Math.round((v.currentTime || 0) * 1000),
    durationMs: Math.round(v.duration * 1000),
    playing: !v.paused && !v.ended,
  };
}

export function useStreamRoom(roomId, currentUserId) {
  const socket = getSocket();

  const hostVideoRef = useRef(null);
  const roleRef = useRef('none');
  const peersRef = useRef(new Map()); // streamer side: viewerId -> { pc, channel }
  const pendingIceRef = useRef(new Map());
  const capturedRef = useRef(null);
  const urlRef = useRef(null);
  const stateTimerRef = useRef(null);
  const connectTimerRef = useRef(null);
  const titleRef = useRef('');
  const viewerPcRef = useRef(null);
  const viewerChannelRef = useRef(null);
  const viewerStreamRef = useRef(null);

  const [role, setRoleState] = useState('none'); // 'host' | 'viewer' | 'none'
  const [info, setInfo] = useState(null); // who is streaming right now
  const [hostUrl, setHostUrl] = useState(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [remoteStream, setRemoteStream] = useState(null);
  const [playback, setPlayback] = useState(null);
  const [connState, setConnState] = useState('idle'); // viewer: idle | connecting | connected | failed
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);

  const setRole = useCallback((r) => {
    roleRef.current = r;
    setRoleState(r);
  }, []);

  // ---------------- the person streaming ----------------
  const broadcastState = useCallback(() => {
    const state = buildState(hostVideoRef.current);
    if (!state) return;
    peersRef.current.forEach((peer) => sendJson(peer.channel, state));
  }, []);

  const closePeer = useCallback((viewerId) => {
    const peer = peersRef.current.get(viewerId);
    pendingIceRef.current.delete(viewerId);
    if (!peer) return;
    peer.pc.onconnectionstatechange = null;
    peer.pc.onicecandidate = null;
    try {
      peer.channel?.close();
    } catch {
      /* ignore */
    }
    try {
      peer.pc.close();
    } catch {
      /* ignore */
    }
    peersRef.current.delete(viewerId);
    setViewerCount(peersRef.current.size);
  }, []);

  const clearHostLocal = useCallback(() => {
    clearInterval(stateTimerRef.current);
    stateTimerRef.current = null;
    [...peersRef.current.keys()].forEach(closePeer);
    capturedRef.current = null;
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setHostUrl(null);
    setViewerCount(0);
  }, [closePeer]);

  const stopStreaming = useCallback(() => {
    if (roleRef.current !== 'host') return;
    socket.emit('stream:stop', { roomId });
    clearHostLocal();
    setRole('none');
  }, [socket, roomId, clearHostLocal, setRole]);

  // Commands from viewers: play, pause or seek the streamer's own player
  const handleCommand = useCallback((raw) => {
    const v = hostVideoRef.current;
    if (!v) return;
    let cmd;
    try {
      cmd = JSON.parse(raw);
    } catch {
      return;
    }
    if (cmd?.t === 'play') {
      Promise.resolve(v.play()).catch(() => {});
    } else if (cmd?.t === 'pause') {
      v.pause();
    } else if (cmd?.t === 'seek' && typeof cmd.positionMs === 'number' && Number.isFinite(cmd.positionMs)) {
      v.currentTime = Math.max(0, Math.min(cmd.positionMs / 1000, v.duration || Infinity));
    }
  }, []);

  // A paused video sends no new frames: a tiny seek gives a new viewer a first picture
  const nudge = useCallback(() => {
    setTimeout(() => {
      const v = hostVideoRef.current;
      if (v && v.paused && Number.isFinite(v.duration)) {
        v.currentTime = v.currentTime > 0.05 ? v.currentTime - 0.04 : v.currentTime + 0.04;
      }
    }, 400);
  }, []);

  const createHostPeer = useCallback(
    async (viewerId) => {
      const captured = capturedRef.current;
      if (!captured) return;
      closePeer(viewerId);

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const peer = { pc, channel: null };
      peersRef.current.set(viewerId, peer);
      setViewerCount(peersRef.current.size);

      captured.getTracks().forEach((track) => pc.addTrack(track, captured));

      peer.channel = pc.createDataChannel('ctl');
      peer.channel.onopen = () => broadcastState();
      peer.channel.onmessage = (e) => handleCommand(e.data);

      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit('stream:ice', { roomId, toUserId: viewerId, candidate: e.candidate });
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          broadcastState();
          nudge();
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          if (peersRef.current.get(viewerId) === peer) closePeer(viewerId);
        }
      };

      const created = await pc.createOffer();
      const offer = { type: created.type, sdp: tuneOpus(created.sdp) };
      await pc.setLocalDescription(offer);

      // allow a higher quality than the browser's default, for the picture and for the sound
      pc.getSenders().forEach((sender) => {
        const kind = sender.track?.kind;
        if (kind !== 'video' && kind !== 'audio') return;
        try {
          const params = sender.getParameters();
          if (!params.encodings || !params.encodings.length) params.encodings = [{}];
          params.encodings[0].maxBitrate = kind === 'video' ? MAX_BITRATE : AUDIO_BITRATE;
          sender.setParameters(params).catch(() => {});
        } catch {
          /* the browser keeps its default */
        }
      });

      socket.emit('stream:offer', { roomId, toUserId: viewerId, offer });
    },
    [socket, roomId, closePeer, broadcastState, handleCommand, nudge]
  );

  // ---------------- a viewer ----------------
  const dropViewerPc = useCallback(() => {
    const pc = viewerPcRef.current;
    if (pc) {
      pc.onconnectionstatechange = null;
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.ondatachannel = null;
      try {
        pc.close();
      } catch {
        /* ignore */
      }
    }
    viewerPcRef.current = null;
    viewerChannelRef.current = null;
    viewerStreamRef.current = null;
  }, []);

  const closeViewer = useCallback(() => {
    clearTimeout(connectTimerRef.current);
    dropViewerPc();
    pendingIceRef.current.clear();
    setRemoteStream(null);
    setPlayback(null);
    setConnState('idle');
  }, [dropViewerPc]);

  const joinStream = useCallback(() => {
    if (roleRef.current === 'host') return;
    setError(null);
    setNotice(null);
    closeViewer();
    setRole('viewer');
    setConnState('connecting');

    clearTimeout(connectTimerRef.current);
    connectTimerRef.current = setTimeout(() => setConnState((s) => (s === 'connecting' ? 'failed' : s)), CONNECT_TIMEOUT_MS);

    socket.emit('stream:join', { roomId }, (res) => {
      if (res?.ok) return;
      clearTimeout(connectTimerRef.current);
      setError(res?.message || 'Could not join the stream.');
      closeViewer();
      setRole('none');
    });
  }, [socket, roomId, closeViewer, setRole]);

  const leaveViewing = useCallback(() => {
    if (roleRef.current !== 'viewer') return;
    socket.emit('stream:leave-view', { roomId });
    closeViewer();
    setRole('none');
  }, [socket, roomId, closeViewer, setRole]);

  const sendCommand = useCallback((cmd) => sendJson(viewerChannelRef.current, cmd), []);

  // ---------------- choosing a movie to stream ----------------
  const startFile = useCallback(
    (file) => {
      if (!file) return;
      setError(null);
      setNotice(null);
      if (roleRef.current === 'host') {
        socket.emit('stream:stop', { roomId });
        clearHostLocal();
      }
      if (roleRef.current === 'viewer') {
        socket.emit('stream:leave-view', { roomId });
        closeViewer();
      }
      const url = URL.createObjectURL(file);
      urlRef.current = url;
      titleRef.current = file.name;
      setHostUrl(url);
      setRole('host');
    },
    [socket, roomId, clearHostLocal, closeViewer, setRole]
  );

  // The movie is ready: capture its picture and sound, and tell the room
  const onHostLoaded = useCallback(() => {
    const v = hostVideoRef.current;
    if (!v || roleRef.current !== 'host') return;

    let captured = null;
    try {
      captured = (v.captureStream || v.mozCaptureStream)?.call(v) ?? null;
    } catch {
      captured = null;
    }
    if (!captured || captured.getTracks().length === 0) {
      setError('This browser cannot stream a video file. Use Chrome, Edge or Firefox on a computer.');
      clearHostLocal();
      setRole('none');
      return;
    }
    captured.getVideoTracks().forEach((t) => {
      try {
        t.contentHint = 'motion';
      } catch {
        /* optional */
      }
    });
    // tells the encoder this is music and film sound, not a voice call
    captured.getAudioTracks().forEach((t) => {
      try {
        t.contentHint = 'music';
      } catch {
        /* optional */
      }
    });
    capturedRef.current = captured;

    socket.emit('stream:start', { roomId, title: titleRef.current, kind: 'file' }, (res) => {
      if (!res?.ok) {
        setError(res?.message || 'Could not start the stream.');
        clearHostLocal();
        setRole('none');
        return;
      }
      clearInterval(stateTimerRef.current);
      stateTimerRef.current = setInterval(broadcastState, STATE_EVERY_MS);
    });
  }, [socket, roomId, clearHostLocal, setRole, broadcastState]);

  const onHostError = useCallback(() => {
    setError('This browser cannot play that file. MP4 (H.264) or WebM files work best.');
    stopStreaming();
  }, [stopStreaming]);

  // ---------------- messages from the server ----------------
  useEffect(() => {
    if (!roomId) return undefined;

    const flushIce = async (id, pc) => {
      const queued = pendingIceRef.current.get(id) || [];
      pendingIceRef.current.delete(id);
      for (const c of queued) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(c));
        } catch {
          /* a stale candidate is harmless */
        }
      }
    };

    const onStatus = ({ roomId: rid, stream } = {}) => {
      if (rid !== roomId) return;
      setInfo(stream || null);
      if (!stream && roleRef.current === 'viewer') {
        closeViewer();
        setRole('none');
        setNotice('The stream ended.');
      }
    };

    const onViewerJoined = ({ viewerId } = {}) => {
      if (roleRef.current !== 'host' || !viewerId) return;
      createHostPeer(viewerId).catch(() => closePeer(viewerId));
    };
    const onViewerLeft = ({ viewerId } = {}) => closePeer(viewerId);

    const onOffer = async ({ fromUserId, offer } = {}) => {
      if (roleRef.current !== 'viewer' || !offer || !fromUserId) return;
      try {
        dropViewerPc();
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        viewerPcRef.current = pc;

        pc.ontrack = (e) => {
          // a little extra buffering: smoother sound on a shaky connection
          try {
            if ('jitterBufferTarget' in e.receiver) e.receiver.jitterBufferTarget = JITTER_BUFFER_MS;
          } catch {
            /* optional */
          }
          if (e.streams && e.streams[0]) {
            viewerStreamRef.current = e.streams[0];
          } else {
            if (!viewerStreamRef.current) viewerStreamRef.current = new MediaStream();
            viewerStreamRef.current.addTrack(e.track);
          }
          setRemoteStream(viewerStreamRef.current);
        };
        pc.ondatachannel = (e) => {
          viewerChannelRef.current = e.channel;
          e.channel.onmessage = (m) => {
            try {
              const s = JSON.parse(m.data);
              if (s?.t === 'state') {
                setPlayback({
                  positionMs: Number(s.positionMs) || 0,
                  durationMs: Number(s.durationMs) || 0,
                  playing: !!s.playing,
                  receivedAt: Date.now(),
                });
              }
            } catch {
              /* ignore */
            }
          };
        };
        pc.onicecandidate = (e) => {
          if (e.candidate) socket.emit('stream:ice', { roomId, toUserId: fromUserId, candidate: e.candidate });
        };
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'connected') {
            clearTimeout(connectTimerRef.current);
            setConnState('connected');
          } else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
            setConnState('failed');
          }
        };

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await flushIce(fromUserId, pc);
        const created = await pc.createAnswer();
        // the answer says what we want to receive: stereo, high quality
        const answer = { type: created.type, sdp: tuneOpus(created.sdp) };
        await pc.setLocalDescription(answer);
        socket.emit('stream:answer', { roomId, toUserId: fromUserId, answer });
      } catch {
        setConnState('failed');
      }
    };

    const onAnswer = async ({ fromUserId, answer } = {}) => {
      const peer = peersRef.current.get(fromUserId);
      if (roleRef.current !== 'host' || !peer || !answer) return;
      try {
        await peer.pc.setRemoteDescription(new RTCSessionDescription(answer));
        await flushIce(fromUserId, peer.pc);
      } catch {
        closePeer(fromUserId);
      }
    };

    const onIce = async ({ fromUserId, candidate } = {}) => {
      if (!candidate || !fromUserId) return;
      const pc = roleRef.current === 'host' ? peersRef.current.get(fromUserId)?.pc : viewerPcRef.current;
      if (pc?.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch {
          /* a stale candidate is harmless */
        }
      } else {
        const queue = pendingIceRef.current.get(fromUserId) || [];
        queue.push(candidate);
        pendingIceRef.current.set(fromUserId, queue);
      }
    };

    // Ask who is streaming: on join, and again after every reconnect
    const watch = () => {
      socket.emit('stream:watch', { roomId }, (res) => {
        if (!res?.ok) return;
        setInfo(res.stream || null);
        if (roleRef.current === 'host') {
          // after a reconnect the server forgot the stream: start it again
          if (!res.stream || res.stream.hostId !== currentUserId) {
            socket.emit('stream:start', { roomId, title: titleRef.current, kind: 'file' }, () => {});
          }
        } else if (roleRef.current === 'viewer') {
          if (res.stream) joinStream();
          else {
            closeViewer();
            setRole('none');
          }
        }
      });
    };

    socket.on('stream:status', onStatus);
    socket.on('stream:viewer-joined', onViewerJoined);
    socket.on('stream:viewer-left', onViewerLeft);
    socket.on('stream:offer', onOffer);
    socket.on('stream:answer', onAnswer);
    socket.on('stream:ice', onIce);
    if (socket.connected) watch();
    socket.on('connect', watch);

    return () => {
      socket.off('stream:status', onStatus);
      socket.off('stream:viewer-joined', onViewerJoined);
      socket.off('stream:viewer-left', onViewerLeft);
      socket.off('stream:offer', onOffer);
      socket.off('stream:answer', onAnswer);
      socket.off('stream:ice', onIce);
      socket.off('connect', watch);
    };
  }, [roomId, currentUserId, socket, createHostPeer, closePeer, closeViewer, dropViewerPc, joinStream, setRole]);

  // Leaving the page ends the stream (or the viewing)
  useEffect(
    () => () => {
      if (roleRef.current === 'host') socket.emit('stream:stop', { roomId });
      if (roleRef.current === 'viewer') socket.emit('stream:leave-view', { roomId });
      socket.emit('stream:unwatch', { roomId });
      clearInterval(stateTimerRef.current);
      clearTimeout(connectTimerRef.current);
      peersRef.current.forEach((peer) => {
        try {
          peer.pc.close();
        } catch {
          /* ignore */
        }
      });
      peersRef.current.clear();
      try {
        viewerPcRef.current?.close();
      } catch {
        /* ignore */
      }
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [socket, roomId]
  );

  return {
    role,
    info,
    notice,
    error,
    hostUrl,
    hostVideoRef,
    viewerCount,
    remoteStream,
    playback,
    connState,
    startFile,
    stopStreaming,
    onHostLoaded,
    onHostError,
    onHostStateChange: broadcastState,
    joinStream,
    leaveViewing,
    sendCommand,
  };
}