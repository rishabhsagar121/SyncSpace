// apps/web/src/pages/Room/Room.jsx
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ArrowLeft, ChevronDown, ChevronUp, Copy, LogOut, Music, Radio } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import Button from '@/components/ui/Button';
import ResizeHandle from '@/components/ui/ResizeHandle';
import ToastStack from '@/components/ui/ToastStack';
import { useRoom } from '@/features/rooms/hooks/useRooms';
import { roomsApi } from '@/features/rooms/api/roomsApi';
import { selectCurrentUser } from '@/features/auth/authSlice';
import { getSocket } from '@/lib/socket';
import YouTubePlayer from '@/features/sync/components/YouTubePlayer';
import SourceBar from '@/features/sync/components/SourceBar';
import StreamRoomPlayer from '@/features/sync/components/StreamRoomPlayer';
import { useRoomSync } from '@/features/sync/hooks/useRoomSync';
import { useVoiceCall } from '@/features/webrtc/hooks/useVoiceCall';
import RoomsList from '@/features/rooms/components/RoomsList';
import RoomPanel from '@/features/rooms/components/RoomPanel';
import MusicPanel from '@/features/music/components/MusicPanel';
import { useMusic } from '@/features/music/MusicProvider';

const SIDE_KEY = 'syncspace:room:sideWidth';
const CHAT_HEIGHT_KEY = 'syncspace:room:chatHeight';
const HIDE_MUSIC_KEY = 'syncspace:room:hideMusic';
const DEFAULT_SIDE = 340;
const MIN_SIDE = 300;
const MIN_PANEL_HEIGHT = 480;
const TOAST_MS = 5000;

const maxSide = () => Math.max(420, Math.min(760, Math.round(window.innerWidth * 0.55)));
const maxPanelHeight = () => Math.max(560, Math.round(window.innerHeight * 0.95));

function readNumber(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

function writeValue(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* storage unavailable */
  }
}

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useSelector(selectCurrentUser);
  const music = useMusic();
  const { data: room, isLoading, refetch } = useRoom(roomId);
  const [copied, setCopied] = useState(false);

  const [sideWidth, setSideWidth] = useState(() => readNumber(SIDE_KEY, DEFAULT_SIDE));
  const [panelHeight, setPanelHeight] = useState(() => readNumber(CHAT_HEIGHT_KEY, 0)); // 0 = default height
  const [musicHidden, setMusicHidden] = useState(() => readNumber(HIDE_MUSIC_KEY, 0) === 1);
  const panelRef = useRef(null);

  const [onlineIds, setOnlineIds] = useState(() => new Set()); // who has this room open right now
  const [toasts, setToasts] = useState([]);
  const prevMembersRef = useRef(null);
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  // The voice / video call lives here, so the toolbar and the tiles share one call
  const call = useVoiceCall(roomId, currentUser?.id);

  // Everyone in the room can control playback
  const { source, changeSource, canControl, registerPlayer, emitPlay, emitPause, emitSeek } =
    useRoomSync(roomId, { isHost: true, allowGuestControl: true });

  const dismissToast = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (text, kind) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((list) => [...list.slice(-3), { id, text, kind }]);
      setTimeout(() => dismissToast(id), TOAST_MS);
    },
    [dismissToast]
  );

  // Join the live room channel (and rejoin if the socket reconnects). Also keeps the member list live.
  useEffect(() => {
    if (!roomId) return undefined;
    const socket = getSocket();
    setOnlineIds(new Set());

    const refreshRoom = () => {
      if (typeof refetchRef.current === 'function') refetchRef.current();
      else queryClient.invalidateQueries();
      queryClient.invalidateQueries({ queryKey: ['rooms', 'mine'] });
    };

    const join = () =>
      socket.emit('room:join', { roomId }, (res) => {
        if (res?.ok && Array.isArray(res.onlineMemberIds)) setOnlineIds(new Set(res.onlineMemberIds));
      });

    const onJoined = ({ roomId: rid, userId } = {}) => {
      if (rid !== roomId || !userId) return;
      setOnlineIds((prev) => new Set(prev).add(userId));
      refreshRoom();
    };

    const onLeft = ({ roomId: rid, userId } = {}) => {
      if (rid !== roomId || !userId) return;
      setOnlineIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
      refreshRoom();
    };

    if (socket.connected) join();
    socket.on('connect', join);
    socket.on('room:member-joined', onJoined);
    socket.on('room:member-left', onLeft);

    return () => {
      socket.off('connect', join);
      socket.off('room:member-joined', onJoined);
      socket.off('room:member-left', onLeft);
      socket.emit('room:leave', { roomId });
    };
  }, [roomId, queryClient]);

  // A different room starts with a clean slate (so nothing is announced by mistake)
  useEffect(() => {
    prevMembersRef.current = null;
  }, [roomId]);

  // Popup when someone joins or leaves the group: we compare the member list before and after
  const members = room?.members;
  useEffect(() => {
    if (!members) return;
    const current = new Map(
      members.map((m) => [m.userId, m.user?.profile?.displayName || m.user?.username || 'Someone'])
    );
    const previous = prevMembersRef.current;
    prevMembersRef.current = current;
    if (!previous) return; // the first load: nothing to announce

    current.forEach((name, id) => {
      if (!previous.has(id) && id !== currentUser?.id) pushToast(`${name} joined the room`, 'join');
    });
    previous.forEach((name, id) => {
      if (!current.has(id) && id !== currentUser?.id) pushToast(`${name} left the room`, 'leave');
    });
  }, [members, currentUser?.id, pushToast]);

  const changeSide = (value) => {
    setSideWidth(value);
    writeValue(SIDE_KEY, value);
  };

  const changePanelHeight = (value) => {
    setPanelHeight(value);
    writeValue(CHAT_HEIGHT_KEY, value);
  };

  const toggleMusic = () => {
    const next = !musicHidden;
    setMusicHidden(next);
    writeValue(HIDE_MUSIC_KEY, next ? 1 : 0);
  };

  const copyCode = () => {
    if (!room) return;
    navigator.clipboard?.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const leave = async () => {
    if (music.room?.id === roomId) music.leaveMusic();
    await roomsApi.leave(roomId);
    queryClient.invalidateQueries({ queryKey: ['rooms', 'mine'] });
    navigate('/app');
  };

  if (isLoading) {
    return (
      <div className="flex h-full">
        <RoomsList compact />
        <div className="flex-1 animate-pulse bg-stage-raised" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex h-full">
        <RoomsList compact />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
          <p className="font-display font-bold text-paper">Room not found</p>
          <p className="text-sm text-paper-muted">It may have ended, or you may not have access.</p>
          <Button onClick={() => navigate('/app')}>Back to your rooms</Button>
        </div>
      </div>
    );
  }

  const isMusicRoom = room.mode === 'MUSIC';
  const showLeft = !(isMusicRoom && musicHidden); // the music panel stays mounted when hidden, so nothing is lost
  const effectiveSide = Math.min(Math.max(sideWidth, MIN_SIDE), maxSide());
  const panelHeightCss = panelHeight > 0 ? `${Math.min(panelHeight, maxPanelHeight())}px` : '75vh';
  const nowPlaying = music.room?.id === roomId ? music.state.queue[music.state.index] : null;

  return (
    <div className="flex h-full">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <RoomsList compact />

      {/* Phones and tablets: the whole page scrolls. Computers: panels fit the screen. */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => navigate('/app')}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-paper-muted hover:bg-stage-overlay hover:text-paper lg:hidden"
              aria-label="Back to rooms"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate font-display text-lg font-bold text-paper">{room.name}</h1>
              <p className="truncate text-xs text-paper-muted">
                Hosted by {room.host?.username} &middot; {room.mode.replace('_', ' ').toLowerCase()}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={copyCode}
              className="surface flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-xs text-paper hover:bg-stage-overlay"
            >
              <span className="hidden sm:inline">{room.code}</span>
              <span className="sm:hidden">Code</span>
              <Copy className="h-3 w-3" />
              {copied && <span className="text-ember">copied</span>}
            </button>
            <Button variant="ghost" size="sm" onClick={leave}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Leave</span>
            </Button>
          </div>
        </div>

        {/* Music: show or hide the song section. Hiding it never stops the music. */}
        {isMusicRoom && (
          <div className="px-2 pt-2 sm:px-4 sm:pt-4">
            <div className="surface flex items-center gap-3 rounded-xl2 px-3 py-2">
              <Music className="h-4 w-4 shrink-0 text-ember" />
              <p className="min-w-0 flex-1 truncate text-sm text-paper">
                {nowPlaying
                  ? `${music.state.playing ? 'Playing' : 'Paused'}: ${nowPlaying.title}`
                  : 'Music · nothing playing yet'}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleMusic}
                title={musicHidden ? 'Show the song section' : 'Hide the song section (music keeps playing)'}
              >
                {musicHidden ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                {musicHidden ? 'Show music' : 'Hide music'}
              </Button>
            </div>
          </div>
        )}

        <div
          style={{ '--side-w': `${effectiveSide}px`, '--chat-h': panelHeightCss }}
          className={`grid gap-3 p-2 sm:p-4 lg:flex-1 lg:grid-rows-[minmax(0,1fr)] lg:gap-0 lg:overflow-hidden ${
            showLeft ? 'lg:grid-cols-[minmax(0,1fr)_16px_var(--side-w)]' : 'lg:grid-cols-[minmax(0,1fr)]'
          }`}
        >
          <div className={`min-w-0 flex-col gap-3 lg:overflow-y-auto ${showLeft ? 'flex' : 'hidden'}`}>
            {isMusicRoom ? (
              <MusicPanel room={room} />
            ) : room.mode === 'LOCAL_VIDEO' ? (
              <StreamRoomPlayer roomId={roomId} currentUserId={currentUser?.id} members={room.members} />
            ) : (
              <>
                <div
                  className={`surface relative aspect-video w-full overflow-hidden rounded-lg sm:rounded-xl2 ${
                    source && room.mode === 'YOUTUBE'
                      ? 'bg-black'
                      : 'flex flex-col items-center justify-center gap-3'
                  }`}
                >
                  {room.mode !== 'YOUTUBE' ? (
                    <>
                      <Radio className="h-8 w-8 text-ember" />
                      <p className="font-display font-bold text-paper">
                        {room.mode.replace('_', ' ').toLowerCase()} sync coming soon
                      </p>
                      <p className="max-w-xs px-2 text-center text-sm text-paper-muted">
                        YouTube, Music and Local video rooms are fully synced right now — chat still works great here.
                      </p>
                    </>
                  ) : source ? (
                    <YouTubePlayer
                      videoId={source.videoId}
                      onRegister={registerPlayer}
                      onPlay={emitPlay}
                      onPause={emitPause}
                      onSeek={emitSeek}
                    />
                  ) : (
                    <>
                      <Radio className="h-8 w-8 text-ember" />
                      <p className="px-2 text-center font-display font-bold text-paper">
                        Paste a YouTube link to get started
                      </p>
                    </>
                  )}
                </div>

                {room.mode === 'YOUTUBE' && canControl && <SourceBar onSetSource={changeSource} />}
              </>
            )}
          </div>

          {/* Computers: drag this bar to make the side panel wider or narrower */}
          {showLeft && (
            <ResizeHandle
              direction="horizontal"
              className="hidden lg:flex"
              label="Resize the side panel"
              getValue={() => effectiveSide}
              onChange={changeSide}
              min={MIN_SIDE}
              max={maxSide}
              invert
              onReset={() => changeSide(DEFAULT_SIDE)}
            />
          )}

          <div
            className={`flex min-w-0 flex-col gap-3 lg:overflow-hidden ${
              showLeft ? '' : 'lg:mx-auto lg:w-full lg:max-w-4xl'
            }`}
          >
            {/* Phones and tablets: drag this bar up or down to make the panel taller or shorter */}
            <ResizeHandle
              direction="vertical"
              className="flex lg:hidden"
              label="Resize the panel height"
              getValue={() => panelRef.current?.offsetHeight ?? 600}
              onChange={changePanelHeight}
              min={MIN_PANEL_HEIGHT}
              max={maxPanelHeight}
              invert
              onReset={() => changePanelHeight(0)}
            />

            <div
              ref={panelRef}
              className="h-[var(--chat-h)] min-h-[480px] lg:h-auto lg:min-h-0 lg:flex-1"
            >
              <RoomPanel
                room={room}
                currentUserId={currentUser?.id}
                onlineIds={onlineIds}
                call={call}
                onLeaveRoom={leave}
                onCopyCode={copyCode}
                copied={copied}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}