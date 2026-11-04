// apps/web/src/features/webrtc/components/VoiceBar.jsx
import { Mic, MicOff, PhoneOff, PhoneCall, Users } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useVoiceCall } from '../hooks/useVoiceCall';

export default function VoiceBar({ roomId, currentUserId }) {
  const { joined, muted, connecting, peerCount, joinCall, leaveCall, toggleMute } = useVoiceCall(
    roomId,
    currentUserId
  );

  return (
    <div className="surface flex items-center justify-between rounded-xl2 px-4 py-3">
      <div className="flex items-center gap-2 text-sm text-paper-muted">
        <Users className="h-4 w-4" />
        {joined ? `In voice · ${peerCount + 1} connected` : 'Voice chat'}
      </div>

      <div className="flex items-center gap-2">
        {joined && (
          <button
            onClick={toggleMute}
            className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
              muted ? 'bg-ember-dim text-white' : 'bg-stage-overlay text-paper hover:bg-white/10'
            }`}
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
        )}

        {joined ? (
          <Button variant="danger" size="sm" onClick={leaveCall}>
            <PhoneOff className="h-4 w-4" /> Leave
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={joinCall} isLoading={connecting}>
            <PhoneCall className="h-4 w-4" /> Join voice
          </Button>
        )}
      </div>
    </div>
  );
}