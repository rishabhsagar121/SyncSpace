import { useState } from 'react';
import { CalendarDays, Plus, Clock, Video } from 'lucide-react';
import Button from '@/components/ui/Button';

export default function Calendar() {
  const [activeTab, setActiveTab] = useState('upcoming');

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-stage p-6 md:p-8">
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-6 md:flex-row md:items-center">
        <div>
          <h1 className="font-display text-2xl font-bold text-paper">Watch Party Calendar</h1>
          <p className="mt-1 text-sm text-paper-muted">
            Plan and coordinate upcoming synchronized streaming sessions with friends.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm">
            <Plus className="h-4 w-4" /> Schedule session
          </Button>
        </div>
      </div>

      <div className="mt-6 flex gap-2 border-b border-border pb-3">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === 'upcoming'
              ? 'bg-ember/10 text-ember'
              : 'text-paper-muted hover:text-paper'
          }`}
        >
          Upcoming events
        </button>
        <button
          onClick={() => setActiveTab('past')}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === 'past'
              ? 'bg-ember/10 text-ember'
              : 'text-paper-muted hover:text-paper'
          }`}
        >
          Past parties
        </button>
      </div>

      <div className="mt-10 flex flex-1 flex-col items-center justify-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-stage-raised text-paper-muted">
          <CalendarDays className="h-8 w-8 text-ember" />
        </div>
        <h3 className="mt-4 font-display text-lg font-bold text-paper">No scheduled watch parties yet</h3>
        <p className="mt-1 max-w-sm text-sm text-paper-muted">
          Pick a date and invite your friends to synchronize an episode, movie night, or music listening party.
        </p>
        <div className="mt-6 flex gap-3">
          <Button variant="secondary" size="sm">
            <Clock className="h-4 w-4" /> Pick a time
          </Button>
          <Button size="sm">
            <Video className="h-4 w-4" /> Start instant room
          </Button>
        </div>
      </div>
    </div>
  );
}

