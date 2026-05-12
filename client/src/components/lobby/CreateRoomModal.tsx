import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useGameStore } from '../../store/gameStore';
import { PublicAdminConfig } from '../../types';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminConfig?: PublicAdminConfig | null;
}

export function CreateRoomModal({ isOpen, onClose, adminConfig }: CreateRoomModalProps) {
  const { createRoom } = useGameStore();

  const minPlayers = adminConfig?.gameConfig.minPlayers ?? 2;
  const maxPlayers = adminConfig?.gameConfig.maxPlayers ?? 6;
  const minRounds  = adminConfig?.gameConfig.minRounds  ?? 1;
  const maxRounds  = adminConfig?.gameConfig.maxRounds  ?? 20;

  const [form, setForm] = useState({
    name: '',
    maxPlayers: Math.min(4, maxPlayers),
    roundCount: 5,
    isPrivate: false,
    turnTimeLimit: 30,
  });

  const handleCreate = () => {
    if (!form.name.trim()) return;
    createRoom({ ...form, name: form.name.trim() });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Room" size="md">
      <div className="space-y-4">
        {/* Room name */}
        <div>
          <label className="block text-sm text-dark-muted mb-1">Room Name *</label>
          <input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="My Game Room"
            maxLength={30}
            className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text focus:outline-none focus:border-neon-blue transition-colors"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Max players */}
          <div>
            <label className="block text-sm text-dark-muted mb-1">Max Players</label>
            <select
              value={form.maxPlayers}
              onChange={e => setForm(f => ({ ...f, maxPlayers: +e.target.value }))}
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text focus:outline-none"
            >
              {Array.from({ length: maxPlayers - minPlayers + 1 }, (_, i) => minPlayers + i)
                .map(n => <option key={n} value={n}>{n} Players</option>)}
            </select>
          </div>

          {/* Rounds */}
          <div>
            <label className="block text-sm text-dark-muted mb-1">
              Rounds to Play: <span className="text-dark-text font-bold">{form.roundCount}</span>
            </label>
            <input
              type="range" min={minRounds} max={maxRounds} step={1}
              value={Math.max(minRounds, Math.min(maxRounds, form.roundCount))}
              onChange={e => setForm(f => ({ ...f, roundCount: +e.target.value }))}
              className="w-full accent-neon-blue"
            />
            <div className="flex justify-between text-xs text-dark-muted mt-0.5">
              <span>{minRounds} (quick)</span>
              <span>{Math.round((minRounds + maxRounds) / 2)}</span>
              <span>{maxRounds} (long)</span>
            </div>
          </div>
        </div>

        {/* Turn timer */}
        <div>
          <label className="block text-sm text-dark-muted mb-1">Turn Timer: {form.turnTimeLimit}s</label>
          <input
            type="range" min={15} max={60} step={5}
            value={form.turnTimeLimit}
            onChange={e => setForm(f => ({ ...f, turnTimeLimit: +e.target.value }))}
            className="w-full accent-neon-green"
          />
        </div>

        {/* Private toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => setForm(f => ({ ...f, isPrivate: !f.isPrivate }))}
            className={`relative w-12 h-6 rounded-full transition-colors ${form.isPrivate ? 'bg-neon-green' : 'bg-dark-border'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${form.isPrivate ? 'left-7' : 'left-1'}`} />
          </div>
          <span className="text-dark-text text-sm">Private Room (invite-only)</span>
        </label>

        <div className="flex gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} fullWidth>Cancel</Button>
          <Button variant="primary" onClick={handleCreate} disabled={!form.name.trim()} fullWidth>
            Create Room
          </Button>
        </div>
      </div>
    </Modal>
  );
}
