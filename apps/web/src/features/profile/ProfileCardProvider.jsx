import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useQuery } from '@tanstack/react-query';
import { Check, UserPlus, X } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import { selectCurrentUser } from '@/features/auth/authSlice';
import {
  useFriendsList,
  useIncomingRequests,
  useOutgoingRequests,
  useRespondToRequest,
  useSendFriendRequest,
} from '@/features/friends/hooks/useFriends';
import { profileApi } from './api/profileApi';

// Followers are planned for later: switch this on when they exist
const SHOW_FOLLOWERS = false;

const ProfileCardContext = createContext(null);

function ProfileCard({ userId, preview, onClose }) {
  const navigate = useNavigate();
  const me = useSelector(selectCurrentUser);

  const { data: user, isLoading, isError } = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => profileApi.get(userId),
    staleTime: 30000,
    retry: 1,
  });

  const { data: friends } = useFriendsList();
  const { data: incoming } = useIncomingRequests();
  const { data: outgoing } = useOutgoingRequests();
  const send = useSendFriendRequest();
  const respond = useRespondToRequest();

  const [sentNow, setSentNow] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isMe = userId === me?.id;
  const isFriend = !!friends?.some((f) => f.user?.id === userId);
  const incomingReq = incoming?.find((r) => r.sender?.id === userId);
  const requested = sentNow || !!outgoing?.some((r) => r.receiver?.id === userId);

  const displayName =
    user?.profile?.displayName || preview?.displayName || user?.username || preview?.username || 'Member';
  const username = user?.username || preview?.username;
  const avatarUrl = user?.profile?.avatarUrl ?? preview?.avatarUrl ?? null;
  const online = user?.presenceStatus === 'ONLINE';
  const bio = user?.profile?.bio;

  const addFriend = () => {
    setActionError('');
    send.mutate(userId, {
      onSuccess: () => setSentNow(true),
      onError: (err) => setActionError(err?.response?.data?.message || 'Could not send the request. Try again.'),
    });
  };

  const accept = () => {
    setActionError('');
    respond.mutate(
      { requestId: incomingReq.id, accept: true },
      { onError: (err) => setActionError(err?.response?.data?.message || 'Could not accept the request.') }
    );
  };

  const decline = () => {
    setActionError('');
    respond.mutate(
      { requestId: incomingReq.id, accept: false },
      { onSuccess: onClose, onError: () => setActionError('Could not decline the request.') }
    );
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${displayName}'s profile`}
        onMouseDown={(e) => e.stopPropagation()}
        className="surface relative w-full max-w-sm overflow-hidden rounded-2xl shadow-card"
      >
        <div className="h-24 bg-gradient-to-br from-fuchsia-500 via-purple-500 to-indigo-500" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-5 pb-5">
          <div className="-mt-12 flex items-end justify-between">
            <div className="rounded-full ring-4 ring-stage-raised">
              <Avatar name={username} src={avatarUrl} size={88} live={online} />
            </div>
          </div>

          <h2 className="mt-3 break-words font-display text-xl font-bold text-paper">{displayName}</h2>
          <p className="flex items-center gap-2 text-sm text-paper-muted">
            {username && <span>@{username}</span>}
            {user && (
              <span className="inline-flex items-center gap-1 text-xs">
                <span className={`h-2 w-2 rounded-full ${online ? 'bg-green-500' : 'bg-paper-muted'}`} />
                {online ? 'Online' : 'Offline'}
              </span>
            )}
          </p>

          {isLoading && <div className="mt-4 h-10 animate-pulse rounded-lg bg-stage-overlay" />}
          {isError && <p className="mt-4 text-sm text-red-400">Could not load the full profile.</p>}
          {!isLoading && !isError && (
            <p className="mt-4 whitespace-pre-wrap break-words text-sm text-paper">
              {bio || <span className="text-paper-muted">No bio yet.</span>}
            </p>
          )}

          {user?.createdAt && (
            <p className="mt-3 text-xs text-paper-muted">
              Joined {new Date(user.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
            </p>
          )}

          {SHOW_FOLLOWERS && (
            <div className="mt-4 flex gap-6 text-sm">
              <span>
                <strong className="text-paper">0</strong> <span className="text-paper-muted">Followers</span>
              </span>
              <span>
                <strong className="text-paper">0</strong> <span className="text-paper-muted">Following</span>
              </span>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            {isMe ? (
              <Button
                variant="secondary"
                onClick={() => {
                  onClose();
                  navigate('/app/settings');
                }}
              >
                Edit profile
              </Button>
            ) : isFriend ? (
              <Button variant="secondary" disabled>
                <Check className="h-4 w-4" /> Friends
              </Button>
            ) : incomingReq ? (
              <>
                <Button onClick={accept} isLoading={respond.isPending}>
                  <Check className="h-4 w-4" /> Accept request
                </Button>
                <Button variant="ghost" onClick={decline} disabled={respond.isPending}>
                  Decline
                </Button>
              </>
            ) : requested ? (
              <Button variant="secondary" disabled>
                <Check className="h-4 w-4" /> Request sent
              </Button>
            ) : (
              <Button onClick={addFriend} isLoading={send.isPending}>
                <UserPlus className="h-4 w-4" /> Add friend
              </Button>
            )}
          </div>

          {actionError && <p className="mt-3 text-sm text-red-400">{actionError}</p>}
        </div>
      </div>
    </div>
  );
}

export function ProfileCardProvider({ children }) {
  const [target, setTarget] = useState(null); // { userId, preview }

  const openProfile = useCallback((userId, preview = {}) => {
    if (userId) setTarget({ userId, preview });
  }, []);
  const close = useCallback(() => setTarget(null), []);

  const value = useMemo(() => ({ openProfile }), [openProfile]);

  return (
    <ProfileCardContext.Provider value={value}>
      {children}
      {target && <ProfileCard key={target.userId} userId={target.userId} preview={target.preview} onClose={close} />}
    </ProfileCardContext.Provider>
  );
}

// Safe to call anywhere: without the provider it simply does nothing
export function useProfileCard() {
  return useContext(ProfileCardContext) ?? { openProfile: () => {} };
}