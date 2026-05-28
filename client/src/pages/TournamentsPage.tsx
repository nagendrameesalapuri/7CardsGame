import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { tournamentsApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { notify } from '../services/notify';
import { getSocket } from '../services/socket';

// ── Color palette per banner ───────────────────────────────────────────────────
const ACCENT: Record<string, { text: string; border: string; glow: string; btn: string }> = {
  purple: { text: '#a5b4fc', border: 'rgba(99,102,241,0.5)',  glow: 'rgba(99,102,241,0.15)',  btn: 'linear-gradient(135deg,#6366f1,#818cf8)' },
  blue:   { text: '#93c5fd', border: 'rgba(59,130,246,0.5)',  glow: 'rgba(59,130,246,0.15)',  btn: 'linear-gradient(135deg,#3b82f6,#60a5fa)' },
  green:  { text: '#86efac', border: 'rgba(34,197,94,0.5)',   glow: 'rgba(34,197,94,0.15)',   btn: 'linear-gradient(135deg,#22c55e,#4ade80)' },
  orange: { text: '#fed7aa', border: 'rgba(249,115,22,0.5)',  glow: 'rgba(249,115,22,0.15)',  btn: 'linear-gradient(135deg,#f97316,#fb923c)' },
  red:    { text: '#fca5a5', border: 'rgba(239,68,68,0.5)',   glow: 'rgba(239,68,68,0.15)',   btn: 'linear-gradient(135deg,#ef4444,#f87171)' },
};

function calcTimeLeft(targetDate: string | Date): string {
  const diff = new Date(targetDate).getTime() - Date.now();
  if (diff <= 0) return 'GO!';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (h > 24) { const d = Math.floor(h / 24); return `${d}d ${h % 24}h ${m}m`; }
  if (h > 0)  return `${h}h ${m}m ${s}s`;
  if (m > 0)  return `${m}m ${s}s`;
  return `${s}s`;
}

function useCountdown(targetDate: string | Date) {
  const [timeLeft, setTimeLeft] = useState(() => calcTimeLeft(targetDate));
  useEffect(() => {
    const tick = () => setTimeLeft(calcTimeLeft(targetDate));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);
  return timeLeft;
}

// ── Rules Drawer (timed mode) ─────────────────────────────────────────────────
function TimedRulesDrawer({ t, color }: { t: any; color: string }) {
  const tc = ACCENT[color]?.text ?? '#a5b4fc';
  const durationMs = new Date(t.endTime).getTime() - new Date(t.startTime).getTime();
  const durationH = Math.floor(durationMs / 3600000);
  const durationM = Math.floor((durationMs % 3600000) / 60000);
  const durationStr = durationH > 0 ? `${durationH}h${durationM > 0 ? ` ${durationM}m` : ''}` : `${durationM}m`;

  return (
    <div className="border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
      <div className="px-5 py-4 space-y-3">
        <p className="text-xs font-bold text-white">
          Play in <span style={{ color: tc }}>{durationStr}</span> — every point you win adds to your score. Highest total wins.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: '⚔️', title: 'Survival wins', desc: 'Stage clear coins = score' },
            { icon: '🏆', title: 'Match wins', desc: 'Prize pool payout = score' },
            { icon: '💀', title: 'Losing = 0 pts', desc: 'Only wins count' },
            { icon: '⏰', title: '10 min grace', desc: 'Games started before end count' },
          ].map(r => (
            <div key={r.title} className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-xs font-bold text-white mb-0.5">{r.icon} {r.title}</p>
              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{r.desc}</p>
            </div>
          ))}
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: tc }}>Prize Breakdown</p>
          <div className="space-y-1.5">
            {(t.prizeBreakdown ?? []).map((p: any) => (
              <div key={p.rank} className="flex items-center justify-between px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <span className="text-xs text-white">{p.label ?? `Rank #${p.rank}`}</span>
                <span className="text-xs font-black" style={{ color: tc }}>
                  {Math.floor(t.prizePool * p.percentage / 100).toLocaleString()} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Rules Drawer (elimination mode) ──────────────────────────────────────────
function ElimRulesDrawer({ t, color }: { t: any; color: string }) {
  const tc = ACCENT[color]?.text ?? '#a5b4fc';
  return (
    <div className="border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
      <div className="px-5 py-4 space-y-3">
        <div className="rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <p className="text-xs font-black text-white mb-1">💀 How Elimination Works</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Your card points from each game accumulate. Reach <span style={{ color: '#f87171', fontWeight: 700 }}>{t.eliminationTarget} pts</span> and you're eliminated. The last <span style={{ color: '#4ade80', fontWeight: 700 }}>{t.winnersCount === 1 ? 'player' : `${t.winnersCount} players`}</span> standing win.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: '🎮', title: 'All card pts count', desc: 'Win or lose — hand points add up' },
            { icon: '💀', title: `${t.eliminationTarget}+ pts = out`, desc: 'Keep your score low to survive' },
            { icon: '✅', title: 'Last ones win', desc: `Top ${t.winnersCount} survivors share prizes` },
            { icon: '🥇', title: 'Rank = lowest score', desc: 'Less pts = better rank among survivors' },
          ].map(r => (
            <div key={r.title} className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-xs font-bold text-white mb-0.5">{r.icon} {r.title}</p>
              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{r.desc}</p>
            </div>
          ))}
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: tc }}>Prize Breakdown</p>
          <div className="space-y-1.5">
            {(t.prizeBreakdown ?? []).map((p: any) => (
              <div key={p.rank} className="flex items-center justify-between px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <span className="text-xs text-white">{p.label ?? `Rank #${p.rank}`}</span>
                <span className="text-xs font-black" style={{ color: tc }}>
                  {Math.floor(t.prizePool * p.percentage / 100).toLocaleString()} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Leaderboard Drawer ────────────────────────────────────────────────────────
function LeaderboardDrawer({ t, userId, color }: { t: any; userId: string; color: string }) {
  const tc = ACCENT[color]?.text ?? '#a5b4fc';
  const isElim = t.mode === 'elimination';
  const regs: any[] = [...(t.registrations ?? [])];

  regs.sort((a, b) => {
    if (t.status === 'completed') return (a.rank ?? 999) - (b.rank ?? 999);
    if (isElim) {
      if (a.eliminated && !b.eliminated) return 1;
      if (!a.eliminated && b.eliminated) return -1;
      if (!a.eliminated) return (a.score ?? 0) - (b.score ?? 0);
      return (new Date(b.eliminatedAt).getTime() || 0) - (new Date(a.eliminatedAt).getTime() || 0);
    }
    return (b.score ?? 0) - (a.score ?? 0);
  });

  return (
    <div className="border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
      <div className="px-5 py-4">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {t.status === 'live' ? (isElim ? '💀 Live Elimination' : '🏆 Live Standings') : '🏆 Final Results'}
        </p>
        <div className="space-y-1.5">
          {regs.map((reg, idx) => {
            const rank = t.status === 'completed' ? (reg.rank ?? idx + 1) : idx + 1;
            const isMe = String(reg.userId) === userId;
            const isEliminated = isElim && reg.eliminated;
            const medal = isEliminated ? '💀' : rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
            return (
              <div
                key={String(reg.userId)}
                className="flex items-center gap-3 px-3 py-2 rounded-xl"
                style={{
                  background: isMe
                    ? 'rgba(99,102,241,0.12)'
                    : isEliminated
                    ? 'rgba(239,68,68,0.06)'
                    : 'rgba(255,255,255,0.03)',
                  border: isMe ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
                  opacity: isEliminated ? 0.65 : 1,
                }}
              >
                <span className="text-sm w-6 text-center flex-shrink-0">{medal}</span>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-xs font-semibold truncate"
                    style={{
                      color: isEliminated ? '#f87171' : isMe ? '#a5b4fc' : 'white',
                      textDecoration: isEliminated ? 'line-through' : 'none',
                    }}
                  >
                    {reg.username} {isMe && <span className="text-[9px] font-bold opacity-70">(you)</span>}
                  </p>
                  {isEliminated && reg.eliminatedAt && (
                    <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      eliminated {new Date(reg.eliminatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  {t.status === 'completed' && reg.prizeWon > 0 ? (
                    <span className="text-xs font-black" style={{ color: '#4ade80' }}>+{reg.prizeWon.toLocaleString()} pts</span>
                  ) : (
                    <span className="text-xs font-bold" style={{ color: isEliminated ? '#f87171' : tc }}>
                      {(reg.score ?? 0).toLocaleString()} pts
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main Contest Card ─────────────────────────────────────────────────────────
function TournamentCard({ t: tProp, userId, onAction }: { t: any; userId: string; onAction: () => void }) {
  const [t, setT] = useState(tProp);
  const [loading, setLoading] = useState(false);
  const [drawer, setDrawer] = useState<null | 'rules' | 'leaderboard'>(null);

  // Sync when parent reloads fresh data (e.g. after register/unregister)
  useEffect(() => { setT(tProp); }, [JSON.stringify(tProp.registrations), tProp.status]);
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const walletBalance: number = (user as any)?.walletBalance ?? 0;
  // walletBalance is in rupees; entryFee is in pts (100 pts = ₹1)
  const walletPts = Math.round(walletBalance * 100);

  const color = t.bannerColor ?? 'purple';
  const ac = ACCENT[color] ?? ACCENT.purple;
  const isElim = t.mode === 'elimination';
  const isCancelled = t.status === 'cancelled';
  const isLive = t.status === 'live';
  const isUpcoming = t.status === 'upcoming';
  const isCompleted = t.status === 'completed';

  const countdown = useCountdown(isUpcoming ? t.startTime : t.endTime);

  const playerCount = t.registrations?.length ?? 0;
  const maxPlayers = t.maxPlayers ?? 0;
  const spotsLeft = maxPlayers > 0 ? maxPlayers - playerCount : null;
  const fillPct = maxPlayers > 0 ? Math.min(100, (playerCount / maxPlayers) * 100) : 30;
  const isFull = maxPlayers > 0 && playerCount >= maxPlayers;

  const myReg = t.registrations?.find((r: any) => String(r.userId) === userId || String(r.userId?._id) === userId);
  const isRegistered = !!myReg;
  const iAmElim = isElim && myReg?.eliminated;
  const canAfford = t.entryFee === 0 || walletPts >= t.entryFee;

  const survivors = isElim ? (t.registrations ?? []).filter((r: any) => !r.eliminated).length : null;
  const elimCount = isElim ? (t.registrations ?? []).filter((r: any) => r.eliminated).length : null;

  const topPrize = (t.prizeBreakdown ?? []).length > 0
    ? Math.floor(t.prizePool * (t.prizeBreakdown[0].percentage ?? 50) / 100)
    : t.prizePool;
  const winnersCount = (t.prizeBreakdown ?? []).length;

  // Socket listener for elimination updates
  useEffect(() => {
    if (!isElim || !isLive) return;
    let sock: ReturnType<typeof getSocket> | null = null;
    try {
      sock = getSocket();
      const handler = (data: any) => {
        if (data.tournamentId !== String(t._id)) return;
        setT((prev: any) => ({
          ...prev,
          registrations: data.registrations ?? prev.registrations,
          status: data.status ?? prev.status,
        }));
        if (data.status === 'completed') onAction();
      };
      sock.on('tournament:elim_update', handler);
      return () => { sock?.off('tournament:elim_update', handler); };
    } catch { /* socket not ready */ }
  }, [t._id, isElim, isLive]);

  const handleRegister = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canAfford) { notify.error(`Need ${t.entryFee} pts — you have ${walletPts} pts`); return; }
    setLoading(true);
    try {
      await tournamentsApi.register(t._id);
      notify.success('Registered! Good luck.');
      onAction();
    } catch (err: any) {
      notify.error(err?.response?.data?.error ?? 'Failed to register');
    } finally { setLoading(false); }
  };

  const handleUnregister = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      await tournamentsApi.unregister(t._id);
      notify.success('Unregistered. Entry fee refunded.');
      onAction();
    } catch (err: any) {
      notify.error(err?.response?.data?.error ?? 'Failed');
    } finally { setLoading(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: isCancelled ? 'rgba(30,20,20,0.9)' : 'rgba(15,15,28,0.95)',
        border: `1px solid ${isCancelled ? 'rgba(239,68,68,0.25)' : ac.border}`,
        boxShadow: isCancelled ? 'none' : `0 0 30px ${ac.glow}`,
      }}
    >
      {/* ── Header strip ── */}
      <div
        className="px-4 py-2.5 flex items-center justify-between"
        style={{ background: isCancelled ? 'rgba(239,68,68,0.08)' : ac.glow, borderBottom: `1px solid ${ac.border}` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm font-black text-white truncate">{t.name}</p>
          {t.description && !isCancelled && (
            <p className="text-[10px] hidden sm:block truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{t.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          {isLive && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black animate-pulse"
              style={{ background: 'rgba(34,197,94,0.2)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.4)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />LIVE
            </span>
          )}
          {isUpcoming && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
              ⏳ {countdown}
            </span>
          )}
          {isCompleted && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: 'rgba(148,163,184,0.1)', color: '#94a3b8' }}>✅ Ended</span>
          )}
          {isCancelled && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>❌ Cancelled</span>
          )}
          {isElim && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black"
              style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
              💀 ELIM
            </span>
          )}
        </div>
      </div>

      {/* ── Prize + Entry row ── */}
      <div className="px-4 pt-3 pb-2">
        {isCancelled && (
          <div className="mb-2 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
            <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: '#f87171' }}>❌ Tournament Cancelled</p>
            <p className="text-xs" style={{ color: 'rgba(252,165,165,0.85)' }}>
              {t.cancelReason ?? 'This tournament was cancelled by the admin.'}
            </p>
          </div>
        )}

        <div className="flex items-end justify-between gap-3 mb-2">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Prize Pool</p>
            <p className="text-xl font-black leading-none" style={{ color: isCancelled ? 'rgba(255,255,255,0.25)' : ac.text }}>
              {t.prizePool.toLocaleString()}
              <span className="text-sm font-semibold ml-1" style={{ color: 'rgba(255,255,255,0.4)' }}>pts</span>
            </p>
            <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {new Date(t.startTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} IST
              {!isElim && ` → ${new Date(t.endTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })} IST`}
            </p>
          </div>

          {/* Entry button column */}
          {!isCancelled && (
            <div className="flex-shrink-0 text-right">
              <p className="text-[9px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Entry</p>
              {isUpcoming && (
                isRegistered ? (
                  <button
                    onClick={handleUnregister}
                    disabled={loading}
                    className="px-3 py-1.5 rounded-xl text-xs font-black transition-all"
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.35)' }}
                  >
                    {loading ? '...' : '✓ Joined · Undo'}
                  </button>
                ) : (
                  <button
                    onClick={handleRegister}
                    disabled={loading || isFull}
                    className="px-3 py-1.5 rounded-xl text-xs font-black transition-all shadow-lg"
                    style={{
                      background: isFull ? 'rgba(100,100,100,0.2)' : !canAfford ? 'rgba(239,68,68,0.2)' : 'linear-gradient(135deg,#22c55e,#16a34a)',
                      color: isFull ? '#64748b' : !canAfford ? '#f87171' : 'white',
                      border: `1px solid ${isFull ? 'rgba(100,100,100,0.2)' : !canAfford ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.5)'}`,
                    }}
                  >
                    {loading ? '...' : isFull ? 'Full' : t.entryFee === 0 ? 'Free · Join' : `Join · ${t.entryFee} pts`}
                  </button>
                )
              )}
              {isLive && !iAmElim && (
                <button
                  onClick={() => {
                    if (t.activeRoomCode) {
                      // Queue the room code so GamePage shows a "connecting" spinner
                      // and its effect calls resumeGame → socketGame.reconnect
                      useGameStore.setState((s: any) => ({
                        resumeRoomCodes: s.resumeRoomCodes.includes(t.activeRoomCode)
                          ? s.resumeRoomCodes
                          : [...s.resumeRoomCodes, t.activeRoomCode],
                      }));
                      navigate('/game');
                    } else {
                      // Timed tournament — no specific room, go to lobby to play normally
                      navigate('/lobby');
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-black animate-pulse"
                  style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: 'white', border: '1px solid rgba(34,197,94,0.5)' }}
                >
                  ▶ Play Now
                </button>
              )}
              {isLive && iAmElim && (
                <span className="px-3 py-1.5 rounded-xl text-xs font-black inline-block"
                  style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>💀 Eliminated</span>
              )}
              {isCompleted && (
                <span className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,0.3)' }}>Closed</span>
              )}
            </div>
          )}
        </div>

        {/* ── Player fill bar ── */}
        {!isCancelled && (
          <div className="mb-2">
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${fillPct}%`,
                  background: fillPct > 80 ? 'linear-gradient(90deg,#ef4444,#f87171)' : fillPct > 50 ? 'linear-gradient(90deg,#f97316,#fb923c)' : `linear-gradient(90deg,${ac.text},${ac.text}88)`,
                }}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px] font-bold" style={{ color: spotsLeft !== null && spotsLeft < 5 ? '#f87171' : 'rgba(255,255,255,0.4)' }}>
                {spotsLeft !== null
                  ? spotsLeft <= 0 ? '🔴 Full' : `${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left`
                  : `${playerCount} joined`}
              </span>
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                {maxPlayers > 0 ? `${maxPlayers} total` : 'Open'}
              </span>
            </div>
          </div>
        )}

        {/* ── Stat chips row ── */}
        {!isCancelled && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Top prize */}
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <span className="text-[9px]">🏆</span>
              <span className="text-[10px] font-bold" style={{ color: ac.text }}>{topPrize.toLocaleString()} pts</span>
            </div>
            {/* Winners */}
            {winnersCount > 0 && (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <span className="text-[9px]">👥</span>
                <span className="text-[10px] font-bold text-white">{winnersCount} winner{winnersCount > 1 ? 's' : ''}</span>
              </div>
            )}
            {/* Mode indicator */}
            {isElim ? (
              <>
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <span className="text-[9px]">💀</span>
                  <span className="text-[10px] font-bold" style={{ color: '#f87171' }}>Target {t.eliminationTarget}pts</span>
                </div>
                {(isLive || isCompleted) && (
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(34,197,94,0.08)' }}>
                    <span className="text-[9px]">✅</span>
                    <span className="text-[10px] font-bold" style={{ color: '#4ade80' }}>{survivors} alive</span>
                    <span className="text-[9px] mx-0.5" style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
                    <span className="text-[9px]">💀</span>
                    <span className="text-[10px] font-bold" style={{ color: '#f87171' }}>{elimCount} out</span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <span className="text-[9px]">⏱</span>
                <span className="text-[10px] font-bold text-white">Timed</span>
              </div>
            )}
            {/* Live countdown for timed */}
            {isLive && !isElim && (
              <div className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg animate-pulse" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)' }}>
                <span className="text-[9px]">⏰</span>
                <span className="text-[10px] font-black" style={{ color: '#4ade80' }}>{countdown}</span>
              </div>
            )}
            {/* My elimination score */}
            {isElim && isLive && isRegistered && !iAmElim && myReg && (
              <div className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg"
                style={{ background: (myReg.score ?? 0) > t.eliminationTarget * 0.7 ? 'rgba(251,191,36,0.12)' : 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                <span className="text-[9px]">📊</span>
                <span className="text-[10px] font-black" style={{ color: (myReg.score ?? 0) > t.eliminationTarget * 0.7 ? '#fbbf24' : '#4ade80' }}>
                  You: {myReg.score ?? 0}/{t.eliminationTarget}
                </span>
              </div>
            )}
            {/* My prize if completed */}
            {isCompleted && isRegistered && myReg?.prizeWon > 0 && (
              <div className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg"
                style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)' }}>
                <span className="text-[9px]">🏆</span>
                <span className="text-[10px] font-black" style={{ color: '#4ade80' }}>+{myReg.prizeWon.toLocaleString()} pts won!</span>
              </div>
            )}
          </div>
        )}

        {/* Entry fee insufficient warning */}
        {isUpcoming && !isRegistered && !canAfford && t.entryFee > 0 && (
          <div className="mt-2 flex items-center justify-between px-3 py-1.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <span className="text-xs" style={{ color: '#fca5a5' }}>Need {t.entryFee} pts · You have {walletPts} pts</span>
            <a href="/wallet" className="text-xs font-bold" style={{ color: '#a5b4fc' }}>+ Add funds →</a>
          </div>
        )}

        {/* Drawer toggles */}
        {!isCancelled && (
          <div className="flex gap-2 mt-2">
            {(isLive || isCompleted) && (t.registrations ?? []).length > 0 && (
              <button
                onClick={() => setDrawer(d => d === 'leaderboard' ? null : 'leaderboard')}
                className="flex-1 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                style={drawer === 'leaderboard'
                  ? { background: ac.glow, color: ac.text, border: `1px solid ${ac.border}` }
                  : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                🏆 {drawer === 'leaderboard' ? 'Hide' : 'Standings'}
              </button>
            )}
            <button
              onClick={() => setDrawer(d => d === 'rules' ? null : 'rules')}
              className="flex-1 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
              style={drawer === 'rules'
                ? { background: ac.glow, color: ac.text, border: `1px solid ${ac.border}` }
                : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              {drawer === 'rules' ? '▲ Hide Rules' : '▼ How to Play'}
            </button>
          </div>
        )}
      </div>

      {/* ── Drawers ── */}
      <AnimatePresence>
        {drawer === 'leaderboard' && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <LeaderboardDrawer t={t} userId={userId} color={color} />
          </motion.div>
        )}
        {drawer === 'rules' && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            {isElim ? <ElimRulesDrawer t={t} color={color} /> : <TimedRulesDrawer t={t} color={color} />}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Tournament Room Ready Overlay ─────────────────────────────────────────────
function TournamentRoomOverlay({ data, onJoin, onDismiss }: {
  data: { tournamentName: string; round: number; roomCode: string; survivorsCount: number };
  onJoin: () => void;
  onDismiss: () => void;
}) {
  const [countdown, setCountdown] = useState(30);
  useEffect(() => {
    const id = setInterval(() => setCountdown(c => {
      if (c <= 1) { clearInterval(id); onJoin(); return 0; }
      return c - 1;
    }), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm rounded-3xl overflow-hidden"
        style={{ background: 'linear-gradient(160deg,#0d0d1a,#111827)', border: '1px solid rgba(239,68,68,0.4)', boxShadow: '0 0 60px rgba(239,68,68,0.2)' }}
      >
        <div className="px-6 pt-8 pb-6 text-center">
          <div className="text-6xl mb-4 animate-pulse">⚔️</div>
          <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: '#f87171' }}>Tournament Starting</p>
          <h2 className="text-xl font-black text-white mb-1">{data.tournamentName}</h2>
          <p className="text-sm mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Round {data.round} • {data.survivorsCount} players</p>
          <p className="text-xs mb-6" style={{ color: 'rgba(255,255,255,0.3)' }}>Room: <span className="font-mono font-bold text-white">{data.roomCode}</span></p>

          <div className="mb-4 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${(countdown / 30) * 100}%`, background: countdown > 10 ? 'linear-gradient(90deg,#22c55e,#4ade80)' : 'linear-gradient(90deg,#ef4444,#f87171)' }} />
          </div>
          <p className="text-xs mb-5" style={{ color: 'rgba(255,255,255,0.35)' }}>Auto-joining in {countdown}s…</p>

          <button
            onClick={onJoin}
            className="w-full py-3 rounded-2xl font-black text-base mb-3"
            style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', color: 'white', boxShadow: '0 4px 20px rgba(239,68,68,0.4)' }}
          >
            ⚔ Join Now
          </button>
          <button
            onClick={onDismiss}
            className="w-full py-2 rounded-xl text-sm"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          >
            Dismiss (you can rejoin from game page)
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function TournamentsPage() {
  const { user } = useAuthStore();
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'upcoming' | 'live' | 'completed'>('upcoming');
  const [roomReady, setRoomReady] = useState<any | null>(null);

  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const res = await tournamentsApi.list();
      setTournaments(res.data.tournaments);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Poll every 20s on upcoming tab (catches start-time crossover) and every 30s on live
  useEffect(() => {
    if (tab !== 'upcoming' && tab !== 'live') return;
    const ms = tab === 'upcoming' ? 20_000 : 30_000;
    const id = setInterval(load, ms);
    return () => clearInterval(id);
  }, [tab, load]);

  useEffect(() => {
    let sock: ReturnType<typeof getSocket> | null = null;
    try {
      sock = getSocket();
      const handler = (data: any) => {
        load();
        // Auto-switch to live tab when a round starts so the Play Now button is visible
        if (data.round >= 1) setTab('live');
      };
      sock.on('tournament:elim_update', handler);
      return () => { sock?.off('tournament:elim_update', handler); };
    } catch { /* socket not ready */ }
  }, [load]);

  // Listen for auto-created tournament rooms
  useEffect(() => {
    let sock: ReturnType<typeof getSocket> | null = null;
    try {
      sock = getSocket();
      const handler = (data: any) => {
        setRoomReady(data);
        setTab('live');
        load();
      };
      sock.on('tournament:room_ready', handler);
      return () => { sock?.off('tournament:room_ready', handler); };
    } catch { /* socket not ready */ }
  }, [load]);

  // Tournament went live — switch to live tab and reload
  useEffect(() => {
    let sock: ReturnType<typeof getSocket> | null = null;
    try {
      sock = getSocket();
      const handler = () => { load(); setTab('live'); };
      sock.on('tournament:started', handler);
      return () => { sock?.off('tournament:started', handler); };
    } catch { /* socket not ready */ }
  }, [load]);

  // Admin cleared all tournaments — refresh list
  useEffect(() => {
    let sock: ReturnType<typeof getSocket> | null = null;
    try {
      sock = getSocket();
      sock.on('tournaments:cleared', load);
      return () => { sock?.off('tournaments:cleared', load); };
    } catch { /* socket not ready */ }
  }, [load]);

  const userId = String((user as any)?.id ?? (user as any)?._id ?? '');

  const byTab = {
    upcoming:  tournaments.filter(t => t.status === 'upcoming'),
    live:      tournaments.filter(t => t.status === 'live'),
    completed: tournaments.filter(t => t.status === 'completed' || t.status === 'cancelled'),
  };

  const tabs = [
    { key: 'upcoming',  icon: '⏳', label: 'Upcoming',  count: byTab.upcoming.length },
    { key: 'live',      icon: '🔴', label: 'Live',      count: byTab.live.length },
    { key: 'completed', icon: '✅', label: 'Past',      count: byTab.completed.length },
  ] as const;

  const handleJoinRoom = () => {
    const code = roomReady?.roomCode;
    setRoomReady(null);
    if (code) useGameStore.getState().resumeGame(code);
    navigate('/game');
  };

  return (
    <Layout>
      <AnimatePresence>
        {roomReady && (
          <TournamentRoomOverlay
            data={roomReady}
            onJoin={handleJoinRoom}
            onDismiss={() => setRoomReady(null)}
          />
        )}
      </AnimatePresence>
      <div className="max-w-lg mx-auto px-4 py-6">

        {/* ── Page Header ── */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.3),rgba(168,85,247,0.2))', border: '1px solid rgba(99,102,241,0.4)' }}>
              ⚔️
            </div>
            <div>
              <h1 className="text-xl font-black text-white">Tournaments</h1>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Compete · Win pts · Glory</p>
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-2 mb-5 p-1 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {tabs.map(({ key, icon, label, count }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              style={tab === key
                ? { background: 'rgba(99,102,241,0.3)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.4)' }
                : { color: 'rgba(255,255,255,0.4)' }}
            >
              {icon} {label}
              {count > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black"
                  style={{ background: tab === key ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)', color: tab === key ? '#c7d2fe' : 'rgba(255,255,255,0.4)' }}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="rounded-2xl h-48 animate-pulse" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }} />
            ))}
          </div>
        ) : byTab[tab].length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">{tab === 'upcoming' ? '📅' : tab === 'live' ? '🎯' : '📜'}</div>
            <p className="font-bold text-white mb-1">{tab === 'live' ? 'No live tournaments' : tab === 'upcoming' ? 'No upcoming tournaments' : 'No past tournaments'}</p>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {tab === 'live' ? 'Check the Upcoming tab to see what\'s coming next.' : tab === 'upcoming' ? 'Check back soon — new contests drop regularly.' : 'Your completed contests will appear here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {byTab[tab].map((t) => (
              <TournamentCard key={t._id} t={t} userId={userId} onAction={load} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
