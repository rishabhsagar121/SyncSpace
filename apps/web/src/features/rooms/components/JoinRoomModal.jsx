import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useJoinRoom } from '../hooks/useRooms';

export default function JoinRoomModal({ open, onClose }) {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const joinRoom = useJoinRoom();

  const onSubmit = (e) => {
    e.preventDefault();
    joinRoom.mutate({ code, password: password || undefined }, { onSuccess: onClose });
  };

  return (
    <Modal open={open} onClose={onClose} title="Join a room">
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <Input
          label="Room code"
          placeholder="e.g. c1a9x7"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="font-mono tracking-wider"
          required
        />
        <Input
          label="Password (if it has one)"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {joinRoom.isError && (
          <p className="text-sm text-ember-hot">
            {joinRoom.error?.response?.data?.message || "That code didn't work. Double check it and try again."}
          </p>
        )}

        <Button type="submit" size="lg" isLoading={joinRoom.isPending} disabled={!code.trim()}>
          Join room
        </Button>
      </form>
    </Modal>
  );
}