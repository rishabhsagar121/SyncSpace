// apps/web/src/pages/Friends/Friends.jsx
import FriendsPanel from '@/features/friends/components/FriendsPanel';

export default function Friends() {
  return (
    <div className="animate-rise-in mx-auto max-w-lg">
      <h1 className="mb-6 font-display text-2xl font-bold text-paper">Friends</h1>
      <FriendsPanel />
    </div>
  );
}