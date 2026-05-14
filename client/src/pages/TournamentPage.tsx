import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { useTournamentStore } from '../store/tournamentStore';
import { useGameStore } from '../store/gameStore';
import { socketTournament } from '../services/socket';
import { on } from '../services/socket';
import { Layout } from '../components/layout/Layout';
import { walletApi, tournamentsApi } from '../services/api';

const TIERS = [
  {
    fee: 10, prize: 15, totalReturn: 25,
    color: '#00ff88', glow: 'rgba(0,255,136,0.2)', border: 'rgba(0,255,136,0.4)',
    label: 'Starter', icon: '🥉',
  },
  {
    fee: 20, prize: 25, totalReturn: 45,
    color: '#ffd700', glow: 'rgba(255,215,0,0.2)', border: 'rgba(255,215,0,0.4)',
    label: 'Champion', icon: '🏆',
  },
];

const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  won:    { label: 'Won',    color: '#00ff88', icon: '🏆' },
  lost:   { label: 'Lost',   color: '#ff6b6b', icon: '😔' },
  draw:   { label: 'Draw',   color: '#fbbf24', icon: '🤝' },
  active: { label: 'Active', color: '#60a5fa', icon: '⚔️' },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function HistoryTab() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tournamentsApi.history()
      .then(r => setHistory(r.data.tournaments))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-neon-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-12 space-y-2">
        <p className="text-4xl">🎮</p>
        <p className="text-dark-muted text-sm">No tournament history yet.</p>
        <p className="text-dark-muted text-xs">Play your first tournament to see results here!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((t: any) => {
        const meta = STATUS_META[t.status] ?? STATUS_META.active;
        const prizeLine = t.status === 'won'
          ? `+₹${t.prizeAmount} prize`
          : t.status === 'draw'
          ? `₹${t.entryFee} refunded`
          : t.status === 'lost'
          ? `−₹${t.entryFee}`
          : 'In progress';

        return (
          <motion.div
            key={String(t.id)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-4"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{meta.icon}</span>
                <span className="text-sm font-bold" style={{ color: meta.color }}>{meta.label}</span>
                <span className="text-xs text-dark-muted">· ₹{t.entryFee} entry</span>
              </div>
              <span className="text-xs text-dark-muted">{formatDate(t.createdAt)}</span>
            </div>

            {/* Series score */}
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center gap-1.5">
                {Array.from({ length: 3 }, (_, i) => {
                  const gr = t.gameResults?.[i];
                  const bg = !gr
                    ? 'rgba(255,255,255,0.06)'
                    : gr.isDraw
                    ? 'rgba(251,191,36,0.2)'
                    : gr.playerWon
                    ? 'rgba(0,255,136,0.2)'
                    : 'rgba(255,107,107,0.2)';
                  const border = !gr
                    ? 'rgba(255,255,255,0.1)'
                    : gr.isDraw
                    ? 'rgba(251,191,36,0.5)'
                    : gr.playerWon
                    ? 'rgba(0,255,136,0.5)'
                    : 'rgba(255,107,107,0.5)';
                  const label = !gr ? String(i + 1) : gr.isDraw ? '=' : gr.playerWon ? '✓' : '✗';
                  return (
                    <div
                      key={i}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: bg, border: `1px solid ${border}` }}
                    >
                      {label}
                    </div>
                  );
                })}
              </div>
              <span className="text-xs text-dark-muted">
                {t.playerWins}W – {t.botWins}L
                {(t.draws ?? 0) > 0 ? ` – ${t.draws}D` : ''}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-xs text-dark-muted">{t.gamesPlayed} game{t.gamesPlayed !== 1 ? 's' : ''} played</span>
              <span
                className="text-xs font-bold"
                style={{ color: t.status === 'won' ? '#00ff88' : t.status === 'draw' ? '#fbbf24' : t.status === 'lost' ? '#ff6b6b' : '#60a5fa' }}
              >
                {prizeLine}
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

interface ActiveTournamentStatus {
  tournamentId: string;
  gameNumber: number;
  playerWins: number;
  botWins: number;
  entryFee: number;
  prizeAmount: number;
  currentRoomCode: string | null;
}

export function TournamentPage() {
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();
  const { subscribe, active, tournamentId } = useTournamentStore();
  const { subscribeToEvents } = useGameStore();
  const [balance, setBalance] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [selectedFee, setSelectedFee] = useState<number | null>(null);
  const [tab, setTab] = useState<'play' | 'history'>('play');
  const [activeTournament, setActiveTournament] = useState<ActiveTournamentStatus | null>(null);
  const [statusChecked, setStatusChecked] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/'); return; }
    const unsub1 = subscribe();
    const unsub2 = subscribeToEvents();
    const unsub3 = on('game:state', () => navigate('/game'));

    // Check if user has an active tournament they can resume
    const unsub4 = on('tournament:status_result', (result) => {
      setStatusChecked(true);
      setActiveTournament(result);
    });
    const unsub5 = on('tournament:cancelled', ({ refunded, amount }) => {
      setCancelling(false);
      setConfirmCancel(false);
      setActiveTournament(null);
      if (refunded) {
        setBalance(prev => prev !== null ? prev + amount : prev);
      }
    });
    socketTournament.status();

    walletApi.get().then(r => setBalance(r.data.balance)).catch(() => {});
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); };
  }, [isAuthenticated, navigate, subscribe, subscribeToEvents]);

  const handleStart = (fee: number) => {
    if (starting) return;
    setStarting(true);
    setSelectedFee(fee);
    socketTournament.start(fee);
    const unsub = on('tournament:error', () => { setStarting(false); setSelectedFee(null); unsub(); });
  };

  const handleResume = () => {
    if (!activeTournament || starting) return;
    setStarting(true);
    setSelectedFee(activeTournament.entryFee);
    socketTournament.start(activeTournament.entryFee);
    const unsub = on('tournament:error', () => { setStarting(false); setSelectedFee(null); unsub(); });
  };

  const handleCancel = () => {
    if (cancelling) return;
    setCancelling(true);
    socketTournament.cancel();
    const unsub = on('tournament:error', () => { setCancelling(false); unsub(); });
  };

  if (!isAuthenticated) return null;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-2">
          <div className="text-6xl mb-4">⚔️</div>
          <h1 className="text-3xl font-black text-white">Bot Tournament</h1>
          <p className="text-dark-muted text-sm max-w-md mx-auto">
            Play up to 3 games against bots. First to win 2 games takes the prize. Tie = entry refunded.
          </p>
        </motion.div>

        {/* Active tournament resume banner */}
        <AnimatePresence>
          {statusChecked && activeTournament && !active && (
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="rounded-2xl p-5"
              style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.35)' }}
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">🔄</span>
                <div>
                  <p className="text-sm font-bold text-blue-400">Tournament In Progress</p>
                  <p className="text-xs text-dark-muted">You have an unfinished tournament — pick up where you left off</p>
                </div>
              </div>

              {/* Series score */}
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: 3 }, (_, i) => {
                    const filled = i < activeTournament.gameNumber - 1;
                    return (
                      <div
                        key={i}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{
                          background: filled ? 'rgba(96,165,250,0.2)' : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${filled ? 'rgba(96,165,250,0.5)' : 'rgba(255,255,255,0.1)'}`,
                          color: filled ? '#60a5fa' : '#4b5563',
                        }}
                      >
                        {filled ? '✓' : String(i + 1)}
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-3 text-sm">
                  <span>
                    <span className="text-dark-muted">You </span>
                    <span className="font-bold text-neon-green">{activeTournament.playerWins}</span>
                  </span>
                  <span className="text-dark-muted">–</span>
                  <span>
                    <span className="text-dark-muted">Bot </span>
                    <span className="font-bold text-red-400">{activeTournament.botWins}</span>
                  </span>
                  <span className="text-xs text-dark-muted self-center">· Game {activeTournament.gameNumber}</span>
                </div>
              </div>

              {/* Confirm cancel dialog */}
              {confirmCancel ? (
                <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.3)' }}>
                  <p className="text-sm font-bold text-red-400">Cancel this tournament?</p>
                  {activeTournament.gameNumber === 1 ? (
                    <p className="text-xs text-dark-muted">
                      You haven't played any games yet.{' '}
                      <span className="text-neon-green font-semibold">₹{activeTournament.entryFee} will be fully refunded</span> to your wallet.
                    </p>
                  ) : (
                    <p className="text-xs text-dark-muted">
                      You've already played {activeTournament.gameNumber - 1} game{activeTournament.gameNumber - 1 > 1 ? 's' : ''}.{' '}
                      <span className="text-red-400 font-semibold">No refund</span> — entry fee is forfeited once a game has been played.
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmCancel(false)}
                      disabled={cancelling}
                      className="flex-1 py-2 rounded-lg text-xs font-semibold text-dark-muted hover:text-white transition-colors"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      Keep Playing
                    </button>
                    <button
                      onClick={handleCancel}
                      disabled={cancelling}
                      className="flex-1 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
                      style={{ background: 'rgba(255,107,107,0.2)', border: '1px solid rgba(255,107,107,0.4)', color: '#ff6b6b' }}
                    >
                      {cancelling ? '⏳ Cancelling…' : activeTournament.gameNumber === 1 ? 'Yes, Cancel & Refund' : 'Yes, Forfeit'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleResume}
                    disabled={starting}
                    className="flex-1 py-3 rounded-xl font-bold text-sm disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff' }}
                  >
                    {starting && selectedFee === activeTournament.entryFee
                      ? '⏳ Resuming…'
                      : `▶ Resume Game ${activeTournament.gameNumber}`}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setConfirmCancel(true)}
                    disabled={starting}
                    className="py-3 px-4 rounded-xl font-bold text-sm disabled:opacity-50"
                    style={{ background: 'rgba(255,107,107,0.12)', border: '1px solid rgba(255,107,107,0.3)', color: '#ff6b6b' }}
                  >
                    ✕ Cancel
                  </motion.button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabs */}
        <div className="flex rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          {(['play', 'history'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-2.5 text-sm font-semibold transition-all"
              style={tab === t
                ? { background: 'rgba(0,255,136,0.15)', color: '#00ff88' }
                : { color: '#8b949e' }}
            >
              {t === 'play' ? '⚔️ Play' : '📋 History'}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {tab === 'play' ? (
            <motion.div key="play" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">

              {/* Format card */}
              <div className="rounded-2xl p-5 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-xs text-dark-muted uppercase tracking-widest font-semibold text-center">Tournament Format</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[
                    { icon: '🎮', label: 'Up to 3 Games', sub: 'Best of 3' },
                    { icon: '🔄', label: '2 Rounds/Game', sub: 'Per game' },
                    { icon: '🏅', label: 'First to 2 Wins', sub: 'Takes prize' },
                  ].map(item => (
                    <div key={item.label} className="rounded-xl py-3 px-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="text-2xl mb-1">{item.icon}</div>
                      <p className="text-xs font-bold text-white">{item.label}</p>
                      <p className="text-[10px] text-dark-muted">{item.sub}</p>
                    </div>
                  ))}
                </div>
                {/* Tie rule notice */}
                <div className="rounded-xl py-2 px-3 text-center text-xs text-yellow-400/80" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
                  🤝 If series ends tied (equal wins), entry fee is fully refunded
                </div>
              </div>

              {/* Tier cards */}
              <div className="grid sm:grid-cols-2 gap-4">
                {TIERS.map((tier, idx) => (
                  <motion.div
                    key={tier.fee}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.08 }}
                    className="rounded-2xl p-5 space-y-4 flex flex-col"
                    style={{ background: `radial-gradient(ellipse at top, ${tier.glow} 0%, rgba(13,17,23,0.95) 70%)`, border: `1px solid ${tier.border}` }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-widest" style={{ color: tier.color }}>
                        {tier.icon} {tier.label}
                      </span>
                      {balance !== null && balance < tier.fee && (
                        <span className="text-[10px] text-red-400 font-semibold">Low balance</span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-dark-muted">Entry Fee</span>
                        <span className="text-white font-semibold">₹{tier.fee}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-dark-muted">Prize Winnings</span>
                        <span className="font-semibold" style={{ color: tier.color }}>+₹{tier.prize}</span>
                      </div>
                      <div className="h-px" style={{ background: tier.border }} />
                      <div className="flex justify-between text-sm font-bold">
                        <span className="text-white">You Get Back</span>
                        <span style={{ color: tier.color }}>₹{tier.totalReturn}</span>
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleStart(tier.fee)}
                      disabled={starting || (balance !== null && balance < tier.fee) || user?.isGuest || !!activeTournament}
                      className="w-full py-3 rounded-xl font-bold text-sm transition-all mt-auto disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: tier.color, color: '#0d1117' }}
                    >
                      {starting && selectedFee === tier.fee
                        ? '⏳ Starting…'
                        : activeTournament
                        ? 'Resume Active Tournament'
                        : user?.isGuest
                        ? 'Sign in to Play'
                        : `Enter for ₹${tier.fee}`}
                    </motion.button>
                  </motion.div>
                ))}
              </div>

              {balance !== null && !user?.isGuest && (
                <p className="text-center text-xs text-dark-muted">
                  Wallet balance: <span className="text-neon-green font-bold">₹{balance}</span>
                </p>
              )}

              {/* Rules */}
              <div className="rounded-2xl p-4 space-y-2" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider">How it works</p>
                <ul className="space-y-1.5 text-xs text-dark-muted">
                  <li>• Pay entry fee → play Game 1 (2 rounds) vs a bot</li>
                  <li>• After each game the player with the <strong className="text-dark-text">lower score</strong> wins that game</li>
                  <li>• Equal scores in a game = <strong className="text-dark-text">draw</strong> (neither side wins that game)</li>
                  <li>• First to win <strong className="text-dark-text">2 games</strong> wins the tournament</li>
                  <li>• Win → entry fee + prize instantly added to wallet</li>
                  <li>• Lose → entry fee forfeited (max 3 games played)</li>
                  <li>• <strong className="text-yellow-400">Tie after 3 games</strong> → entry fee fully refunded, no winner</li>
                  <li>• 🔄 If you close or go back, <strong className="text-blue-400">resume your tournament</strong> anytime from this page</li>
                </ul>
              </div>
            </motion.div>
          ) : (
            <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <HistoryTab />
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => navigate('/lobby')}
          className="w-full py-2.5 rounded-xl text-sm text-dark-muted hover:text-dark-text transition-colors"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          ← Back to Lobby
        </button>
      </div>
    </Layout>
  );
}
