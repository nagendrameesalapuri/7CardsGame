import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useGameStore } from '../../store/gameStore';

interface JoinRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function JoinRoomModal({ isOpen, onClose }: JoinRoomModalProps) {
  const { joinRoom, roomError } = useGameStore();
  const [code, setCode] = useState('');

  const handleJoin = () => {
    if (code.trim().length !== 6) return;
    joinRoom(code.trim().toUpperCase());
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Join Room" size="sm">
      <div className="space-y-4">
        <p className="text-dark-muted text-sm">Enter the 6-character room code shared by the host.</p>

        <input
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          onKeyDown={e => e.key === 'Enter' && handleJoin()}
          placeholder="XXXXXX"
          maxLength={6}
          className="w-full text-center text-3xl font-mono font-bold tracking-[0.5em] bg-dark-bg border-2 border-dark-border rounded-xl py-4 text-dark-text focus:outline-none focus:border-neon-green transition-colors uppercase"
          autoFocus
        />

        {roomError && (
          <p className="text-neon-red text-sm text-center">{roomError}</p>
        )}

        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose} fullWidth>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleJoin}
            disabled={code.length !== 6}
            fullWidth
          >
            Join
          </Button>
        </div>
      </div>
    </Modal>
  );
}
