import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usersApi } from '../../services/api';
import { Avatar } from './Avatar';

const STAGE_NAMES = ['', 'Safe Bot', 'Aggressive Bot', 'Bluff Bot', 'Smart AI', 'Boss AI'];

function formatLastSeen(date: string | null, isOnline: boolean): string {
  if (isOnline) return 'Online now';
  if (!date) return 'Never seen';
  const diff = Date.now() - new Date(date).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 2)   return 'Just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return new Date(date).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function StatPill({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl py-2.5 px-2"
      style={{ background: `${color}12`, border: `1px solid ${color}25` }}>
      <span className="text-sm font-black" style={{ color }}>{value}</span>
      <span className="text-[9px] mt-0.5 font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</span>
    </div>
  );
}

interface Props {
  userId: string;
  username: string;
  avatar: string;
  isOnline?: boolean;
  lastSeenAt?: string | null;
  onClose: () => void;
}

export function PlayerProfileModal({ userId, username, avatar, isOnline = false, lastSeenAt = null, onClose }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    usersApi.profile(userId)
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [userId]);

  const u = data?.user;
  const games = data?.recentGames ?? [];

  const gamesPlayed = u?.stats?.gamesPlayed ?? 0;
  const gamesWon    = u?.stats?.gamesWon    ?? 0;
  const winRate     = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;
  const roundsPlayed = u?.stats?.roundsPlayed ?? 0;
  const roundsWon    = u?.stats?.roundsWon   ?? 0;
  const roundWinRate = roundsPlayed > 0 ? Math.round((roundsWon / roundsPlayed) * 100) : 0;
  const showRate     = u?.stats?.showAttempts > 0
    ? Math.round((u.stats.showSuccesses / u.stats.showAttempts) * 100) : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{ zIndex: 100, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }}
      >
        <motion.div
          initial={{ scale: 0.88, opacity: 0, y: 24 }}
          animate={{ scale: 1,    opacity: 1, y: 0  }}
          exit   ={{ scale: 0.88, opacity: 0, y: 24 }}
          transition={{ type: 'spring', stiffness: 220, damping: 22 }}
          onClick={e => e.stopPropagation()}
          className="w-full overflow-hidden rounded-3xl"
          style={{
            maxWidth: 400,
            maxHeight: '88vh',
            overflowY: 'auto',
            background: 'linear-gradient(160deg, rgba(12,10,28,0.99) 0%, rgba(8,7,20,1) 100%)',
            border: '1px solid rgba(250,204,21,0.2)',
            boxShadow: '0 0 0 1px rgba(250,204,21,0.06), 0 24px 80px rgba(0,0,0,0.9)',
          }}
        >
          {/* Gold accent bar */}
          <div style={{ height: 3, background: 'linear-gradient(90deg, #facc15, rgba(250,204,21,0.2))' }} />

          {/* Header */}
          <div className="relative px-5 pt-5 pb-4 flex items-center gap-4"
            style={{ background: 'linear-gradient(180deg, rgba(250,204,21,0.07) 0%, transparent 100%)' }}>
            <div className="relative flex-shrink-0">
              <Avatar avatar={u?.avatar ?? avatar} size="lg" />
              <div
                className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full"
                style={{
                  background: (u?.isOnline ?? isOnline) ? '#22c55e' : '#374151',
                  border: '2px solid rgba(8,7,20,1)',
                  boxShadow: (u?.isOnline ?? isOnline) ? '0 0 8px rgba(34,197,94,0.7)' : 'none',
                }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-black text-white text-base truncate">{u?.username ?? username}</h2>
              <p className="text-[11px] mt-0.5 font-semibold"
                style={{ color: (u?.isOnline ?? isOnline) ? '#4ade80' : 'rgba(255,255,255,0.35)' }}>
                {formatLastSeen(u?.lastSeenAt ?? lastSeenAt, u?.isOnline ?? isOnline)}
              </p>
            </div>
            <button onClick={onClose}
              className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-sm transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
              ✕
            </button>
          </div>

          {loading ? (
            <div className="py-16 flex flex-col items-center gap-3">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-8 h-8 rounded-full border-2" style={{ borderColor: 'rgba(250,204,21,0.3)', borderTopColor: '#facc15' }} />
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading stats…</p>
            </div>
          ) : !u ? (
            <div className="py-12 text-center">
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Could not load profile</p>
            </div>
          ) : (
            <div className="px-5 pb-6 space-y-5">

              {/* ── Multiplayer stats ── */}
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.22em] mb-2.5" style={{ color: 'rgba(250,204,21,0.5)' }}>
                  Multiplayer
                </p>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <StatPill label="Games"   value={gamesPlayed} color="#60a5fa" />
                  <StatPill label="Wins"    value={gamesWon}    color="#4ade80" />
                  <StatPill label="Win %"   value={`${winRate}%`}
                    color={winRate >= 60 ? '#fbbf24' : winRate >= 40 ? '#60a5fa' : '#9ca3af'} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <StatPill label="Rounds"   value={roundsPlayed}    color="#818cf8" />
                  <StatPill label="Rnd Won"  value={roundsWon}       color="#4ade80" />
                  <StatPill label="Rnd Win%" value={`${roundWinRate}%`}
                    color={roundWinRate >= 50 ? '#4ade80' : '#f87171'} />
                </div>
              </div>

              {/* ── Show stat ── */}
              <div className="flex items-center gap-3 rounded-2xl px-4 py-3"
                style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.18)' }}>
                <span style={{ fontSize: 22 }}>🎯</span>
                <div>
                  <p className="text-xs font-black" style={{ color: '#c4b5fd' }}>Show Success Rate</p>
                  <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {u.stats?.showSuccesses ?? 0} successful of {u.stats?.showAttempts ?? 0} attempts
                  </p>
                </div>
                <p className="ml-auto font-black text-lg" style={{ color: showRate >= 60 ? '#4ade80' : showRate >= 35 ? '#fbbf24' : '#f87171' }}>
                  {showRate}%
                </p>
              </div>

              {/* ── Recent games ── */}
              {games.length > 0 && (
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.22em] mb-2.5" style={{ color: 'rgba(250,204,21,0.5)' }}>
                    Recent Games
                  </p>
                  <div className="space-y-1.5">
                    {games.slice(0, 5).map((g: any, i: number) => {
                      const won  = g.winnerId === userId;
                      const lost = !!g.winnerId && g.winnerId !== userId;
                      const date = new Date(g.endedAt ?? g.startedAt);
                      return (
                        <div key={g._id ?? i}
                          className="flex items-center gap-3 rounded-xl px-3 py-2"
                          style={{
                            background: won ? 'rgba(74,222,128,0.06)' : lost ? 'rgba(248,113,113,0.06)' : 'rgba(255,255,255,0.03)',
                            border: won ? '1px solid rgba(74,222,128,0.18)' : lost ? '1px solid rgba(248,113,113,0.18)' : '1px solid rgba(255,255,255,0.06)',
                          }}>
                          <span className="text-base">{won ? '🏆' : lost ? '💀' : '🤝'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold" style={{ color: won ? '#4ade80' : lost ? '#f87171' : '#9ca3af' }}>
                              {won ? 'Victory' : lost ? 'Defeat' : 'Draw'}
                            </p>
                            <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                              {g.players?.length ?? '?'} players · {g.rounds?.length ?? g.roundCount ?? 0} rounds
                            </p>
                          </div>
                          <p className="text-[9px] flex-shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>
                            {isNaN(date.getTime()) ? '' : date.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
