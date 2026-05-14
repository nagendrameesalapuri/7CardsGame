import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useGameStore } from '../../store/gameStore';
import { useAuthStore } from '../../store/authStore';
import { walletApi } from '../../services/api';
import { PublicAdminConfig } from '../../types';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminConfig?: PublicAdminConfig | null;
}


export function CreateRoomModal({ isOpen, onClose, adminConfig }: CreateRoomModalProps) {
  const { createRoom } = useGameStore();
  const { user } = useAuthStore();

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
    entryFee: 0,
  });
  const [entryFeeText, setEntryFeeText] = useState('');
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  const isCashGame      = form.entryFee > 0;
  const prizePool       = form.entryFee * form.maxPlayers;
  const isGuest         = user?.isGuest ?? true;
  const hasEnoughFunds  = isGuest || !isCashGame || (walletBalance !== null && walletBalance >= form.entryFee);
  const canCreate       = !!form.name.trim() && hasEnoughFunds;

  // Load wallet balance when modal opens (non-guest only)
  useEffect(() => {
    if (!isOpen || isGuest) return;
    walletApi.get().then(r => setWalletBalance(r.data.balance)).catch(() => {});
  }, [isOpen, isGuest]);

  const handleCreate = () => {
    if (!canCreate) return;
    createRoom({ ...form, name: form.name.trim(), entryFee: isGuest ? 0 : form.entryFee });
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
              Rounds: <span className="text-dark-text font-bold">{form.roundCount}</span>
            </label>
            <input
              type="range" min={minRounds} max={maxRounds} step={1}
              value={Math.max(minRounds, Math.min(maxRounds, form.roundCount))}
              onChange={e => setForm(f => ({ ...f, roundCount: +e.target.value }))}
              className="w-full accent-neon-blue"
            />
            <div className="flex justify-between text-xs text-dark-muted mt-0.5">
              <span>{minRounds}</span>
              <span>{Math.round((minRounds + maxRounds) / 2)}</span>
              <span>{maxRounds}</span>
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

        {/* ── Entry Fee & Prize Pool ──────────────────────────────────── */}
        <div className={`rounded-xl p-3 space-y-3 transition-all ${isCashGame && !isGuest ? 'border border-yellow-500/30 bg-yellow-500/5' : 'border border-dark-border bg-dark-surface/40'}`}>
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-dark-text flex items-center gap-2">
              💰 Entry Fee
              {isCashGame && !isGuest && (
                <span className="text-[10px] bg-yellow-500/25 text-yellow-300 px-1.5 py-0.5 rounded-full font-medium">
                  Cash Game
                </span>
              )}
            </label>
            {isGuest && (
              <span className="text-[10px] text-dark-muted italic">Sign in to enable</span>
            )}
          </div>

          {/* Free / Bet Match toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setForm(f => ({ ...f, entryFee: 0 })); setEntryFeeText(''); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                form.entryFee === 0
                  ? 'bg-neon-green text-dark-bg shadow-md shadow-green-400/20'
                  : 'bg-dark-bg border border-dark-border text-dark-muted hover:border-neon-green/50'
              }`}
            >
              🎮 Free
            </button>
            <button
              type="button"
              disabled={isGuest}
              onClick={() => {
                const fee = form.entryFee > 0 ? form.entryFee : 10;
                setForm(f => ({ ...f, entryFee: fee }));
                setEntryFeeText(String(fee));
              }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                form.entryFee > 0 && !isGuest
                  ? 'bg-yellow-400 text-dark-bg shadow-md shadow-yellow-400/20'
                  : 'bg-dark-bg border border-dark-border text-dark-muted hover:border-yellow-400/50'
              }`}
            >
              🎰 Bet Match
            </button>
          </div>

          {/* Bet amount input — shown only when Bet Match is active */}
          {isCashGame && !isGuest && (
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted text-sm font-medium">₹</span>
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                value={entryFeeText}
                onChange={e => {
                  const raw = e.target.value.replace(/[^0-9]/g, '');
                  setEntryFeeText(raw);
                  const val = parseInt(raw, 10);
                  if (!isNaN(val) && val >= 1) setForm(f => ({ ...f, entryFee: val }));
                }}
                onBlur={() => {
                  const val = parseInt(entryFeeText, 10);
                  const clamped = isNaN(val) || val < 1 ? 1 : val;
                  setForm(f => ({ ...f, entryFee: clamped }));
                  setEntryFeeText(String(clamped));
                }}
                placeholder="Enter bet amount per player"
                className="w-full bg-dark-bg border border-yellow-400/40 rounded-lg pl-7 pr-3 py-2 text-sm text-dark-text placeholder-dark-muted focus:outline-none focus:border-yellow-400 transition-colors"
              />
            </div>
          )}

          {/* Wallet balance indicator */}
          {!isGuest && walletBalance !== null && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-dark-muted">Your wallet balance</span>
              <span className={isCashGame && walletBalance < form.entryFee ? 'text-red-400 font-bold' : 'text-neon-green font-bold'}>
                ₹{walletBalance}
              </span>
            </div>
          )}

          {/* Insufficient funds warning */}
          {isCashGame && !isGuest && walletBalance !== null && walletBalance < form.entryFee && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
              ⚠️ Insufficient balance. Add ₹{form.entryFee - walletBalance} more to create this room.
            </div>
          )}

          {/* Prize pool calculator */}
          {isCashGame && !isGuest ? (
            <div className="rounded-lg p-3 bg-dark-bg border border-yellow-500/20 space-y-2">
              <p className="text-xs text-dark-muted uppercase tracking-wider font-semibold">Prize Pool Breakdown</p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-dark-muted">Entry Fee × Max Players</span>
                <span className="text-dark-text font-mono">₹{form.entryFee} × {form.maxPlayers}</span>
              </div>
              <div className="h-px bg-dark-border" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-yellow-300">🏆 Winner Gets</span>
                <span className="text-2xl font-bold text-yellow-400">₹{prizePool}</span>
              </div>
              <p className="text-[10px] text-dark-muted">
                ₹{form.entryFee} deducted from each player's wallet on join. Winner takes entire pot.
              </p>
            </div>
          ) : form.entryFee === 0 && !isGuest ? (
            <p className="text-xs text-dark-muted">Free game — no entry fee, no prize money.</p>
          ) : null}
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="ghost" onClick={onClose} fullWidth>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleCreate}
            disabled={!canCreate}
            fullWidth
          >
            {!form.name.trim()
              ? 'Enter Room Name'
              : !hasEnoughFunds
              ? `Need ₹${form.entryFee - (walletBalance ?? 0)} more`
              : isCashGame && !isGuest
              ? `Create · ₹${prizePool} Prize Pool`
              : 'Create Room'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
