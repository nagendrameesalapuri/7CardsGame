import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { useGameStore } from '../../store/gameStore';
import { useAuthStore } from '../../store/authStore';
import { walletApi, usersApi } from '../../services/api';
import { PublicAdminConfig } from '../../types';

// Use shared Avatar component for consistent avatar rendering

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

  // Invite players state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteResults, setInviteResults] = useState<Array<{ id: string; username: string; avatar: string }>>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [invitedUsers, setInvitedUsers] = useState<Array<{ id: string; username: string; avatar: string }>>([]);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Reset invite state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setInviteOpen(false);
      setInviteSearch('');
      setInviteResults([]);
      setInvitedUsers([]);
    }
  }, [isOpen]);

  // Debounced user search
  useEffect(() => {
    if (!inviteOpen) return;
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    setInviteLoading(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const r = await usersApi.search(inviteSearch);
        // Filter out already-invited users
        setInviteResults(r.data.users.filter(u => !invitedUsers.some(i => i.id === u.id)));
      } catch { /* silent */ }
      finally { setInviteLoading(false); }
    }, 300);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [inviteSearch, inviteOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleInvite = (u: { id: string; username: string; avatar: string }) => {
    setInvitedUsers(prev => {
      if (prev.some(x => x.id === u.id)) return prev.filter(x => x.id !== u.id);
      return [...prev, u];
    });
    setInviteResults(prev => prev.filter(x => x.id !== u.id));
  };

  const handleCreate = () => {
    if (!canCreate) return;
    createRoom({
      ...form,
      name: form.name.trim(),
      entryFee: isGuest ? 0 : form.entryFee,
      invitedUserIds: invitedUsers.map(u => u.id),
    });
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

        {/* ── Game Mode ──────────────────────────────────────────────── */}
        <div className={`rounded-xl p-3 space-y-3 transition-all ${isCashGame && !isGuest ? 'border border-yellow-500/30 bg-yellow-500/5' : 'border border-dark-border bg-dark-surface/40'}`}>
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-dark-text flex items-center gap-2">
              🎮 Game Mode
              {isCashGame && !isGuest && (
                <span className="text-[10px] bg-yellow-500/25 text-yellow-300 px-1.5 py-0.5 rounded-full font-medium">
                  Competitive
                </span>
              )}
            </label>
            {isGuest && (
              <span className="text-[10px] text-dark-muted italic">Sign in to enable</span>
            )}
          </div>

          {/* Free / Wager toggle */}
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
              🎮 Free Play
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
              ⚔️ Wager Game
            </button>
          </div>

          {/* Wager amount input */}
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
                placeholder="Enter wager amount per player"
                className="w-full bg-dark-bg border border-yellow-400/40 rounded-lg pl-7 pr-3 py-2 text-sm text-dark-text placeholder-dark-muted focus:outline-none focus:border-yellow-400 transition-colors"
              />
            </div>
          )}

          {/* Wallet balance */}
          {!isGuest && walletBalance !== null && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-dark-muted">Wallet Balance</span>
              <span className={isCashGame && walletBalance < form.entryFee ? 'text-red-400 font-bold' : 'text-neon-green font-bold'}>
                ₹{Number(walletBalance).toFixed(2)}
              </span>
            </div>
          )}

          {/* Insufficient funds warning */}
          {isCashGame && !isGuest && walletBalance !== null && walletBalance < form.entryFee && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
              ⚠️ Insufficient balance. Add ₹{(form.entryFee - walletBalance).toFixed(2)} more to create this room.
            </div>
          )}

          {/* Wager breakdown */}
          {isCashGame && !isGuest ? (
            <div className="rounded-lg p-3 bg-dark-bg border border-yellow-500/20 space-y-2">
              <p className="text-xs text-dark-muted uppercase tracking-wider font-semibold">Wager Breakdown</p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-dark-muted">Wager × Max Players</span>
                <span className="text-dark-text font-mono">₹{form.entryFee} × {form.maxPlayers}</span>
              </div>
              <div className="h-px bg-dark-border" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-yellow-300">🏆 Winner Earns</span>
                <span className="text-2xl font-bold text-yellow-400">₹{prizePool}</span>
              </div>
              <p className="text-[10px] text-dark-muted">
                ₹{form.entryFee} deducted from each player's wallet on join. Winner takes the pot.
              </p>
            </div>
          ) : form.entryFee === 0 && !isGuest ? (
            <p className="text-xs text-dark-muted">Free Play — casual game, no wager required.</p>
          ) : null}
        </div>

        {/* ── Invite Players ──────────────────────────────────────────────── */}
        {!isGuest && (
          <div className="rounded-xl border border-dark-border overflow-hidden">
            <button
              type="button"
              onClick={() => setInviteOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm text-dark-text hover:bg-white/5 transition-colors"
            >
              <span className="flex items-center gap-2 font-semibold">
                👥 Invite Players
                {invitedUsers.length > 0 && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-bold"
                    style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc' }}>
                    {invitedUsers.length} selected
                  </span>
                )}
              </span>
              <span className="text-dark-muted text-xs">{inviteOpen ? '▲' : '▼'}</span>
            </button>

            {inviteOpen && (
              <div className="border-t border-dark-border bg-dark-bg/60 p-3 space-y-3">
                {/* Selected users */}
                {invitedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {invitedUsers.map(u => (
                      <span key={u.id} className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold"
                        style={{ background: 'rgba(99,102,241,0.18)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.35)' }}>
                        <Avatar avatar={u.avatar} username={u.username} size="xs" />
                        {u.username}
                        <button onClick={() => toggleInvite(u)} className="text-dark-muted hover:text-red-400 transition-colors ml-0.5">✕</button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Search input */}
                <input
                  value={inviteSearch}
                  onChange={e => setInviteSearch(e.target.value)}
                  placeholder="Search players by username…"
                  className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-dark-text placeholder-dark-muted focus:outline-none focus:border-neon-blue transition-colors"
                />

                {/* Search results */}
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {inviteLoading ? (
                    <p className="text-xs text-dark-muted text-center py-3 animate-pulse">Searching…</p>
                  ) : inviteResults.length === 0 ? (
                    <p className="text-xs text-dark-muted text-center py-3">
                      {inviteSearch ? 'No players found' : 'Start typing to search'}
                    </p>
                  ) : (
                    inviteResults.map(u => (
                      <button key={u.id} type="button" onClick={() => toggleInvite(u)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-white/5 transition-colors">
                        <Avatar avatar={u.avatar} username={u.username} size="sm" />
                        <span className="text-sm text-dark-text font-medium flex-1">{u.username}</span>
                        <span className="text-xs text-neon-blue font-semibold">+ Invite</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

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
              ? `Need ₹${(form.entryFee - (walletBalance ?? 0)).toFixed(2)} more`
              : isCashGame && !isGuest
              ? `Create · ₹${prizePool} Pot`
              : 'Create Room'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
