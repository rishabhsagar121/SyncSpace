import { useState } from 'react';
import { Youtube, Music, MonitorPlay, FileVideo } from 'lucide-react';
import clsx from 'clsx';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useCreateRoom } from '../hooks/useRooms';

const MODES = [
  { value: 'YOUTUBE', label: 'YouTube', icon: Youtube },
  { value: 'STREAMING_EXTENSION', label: 'Streaming tab', icon: MonitorPlay },
  { value: 'LOCAL_VIDEO', label: 'Local video', icon: FileVideo },
  { value: 'MUSIC', label: 'Music', icon: Music },
];

const VISIBILITY = [
  { value: 'PRIVATE', label: 'Private — invite only' },
  { value: 'PUBLIC', label: 'Public — anyone with the link' },
  { value: 'PASSWORD_PROTECTED', label: 'Password protected' },
];

export default function CreateRoomModal({ open, onClose }) {
  const [name, setName] = useState('');
  const [mode, setMode] = useState('YOUTUBE');
  const [visibility, setVisibility] = useState('PRIVATE');
  const [password, setPassword] = useState('');
  const createRoom = useCreateRoom();

  const onSubmit = (e) => {
    e.preventDefault();
    createRoom.mutate(
      { name, mode, visibility, password: visibility === 'PASSWORD_PROTECTED' ? password : undefined },
      { onSuccess: onClose }
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Start a room">
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <Input
          label="Room name"
          placeholder="Friday movie night"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <div>
          <p className="mb-2 text-sm font-medium text-paper-muted">What are you sharing?</p>
          <div className="grid grid-cols-2 gap-2">
            {MODES.map(({ value, label, icon: Icon }) => (
              <button
                type="button"
                key={value}
                onClick={() => setMode(value)}
                className={clsx(
                  'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors',
                  mode === value
                    ? 'border-ember bg-ember/10 text-paper'
                    : 'border-border text-paper-muted hover:border-border-strong'
                )}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-paper-muted">Who can join</label>
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-stage-raised px-4 text-sm text-paper outline-none focus:border-ember"
          >
            {VISIBILITY.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </div>

        {visibility === 'PASSWORD_PROTECTED' && (
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        )}

        {createRoom.isError && (
          <p className="text-sm text-ember-hot">
            {createRoom.error?.response?.data?.message || 'Could not create the room. Try again.'}
          </p>
        )}

        <Button type="submit" size="lg" isLoading={createRoom.isPending} disabled={!name.trim()}>
          Create room
        </Button>
      </form>
    </Modal>
  );
}