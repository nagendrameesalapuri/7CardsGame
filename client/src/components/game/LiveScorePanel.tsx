import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClientPlayerState } from '../../types';

interface LiveScorePanelProps {
  players: ClientPlayerState[];
  myPlayerId: string;
  roundNumber: number;
  roundCount: number;
  isTeamArena?: boolean;
  teammateType?: 'ai' | 'human';
}

export function LiveScorePanel({ players, myPlayerId, roundNumber, roundCount, isTeamArena = false, teammateType }: LiveScorePanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  const sorted = [...players].sort((a, b) => a.totalScore - b.totalScore);
  const progress = (roundNumber / roundCount) * 100;

  // Team grouping for Team Arena mode
  const teamASeats = teammateType === 'human' ? [0, 1] : [0, 2];
  const teamBSeats = teammateType === 'human' ? [2, 3] : [1, 3];
  const teamAPlayers = players.filter(p => teamASeats.includes(p.seatIndex));
  const teamBPlayers = players.filter(p => teamBSeats.includes(p.seatIndex));
  const teamAScore = teamAPlayers.reduce((s, p) => s + p.totalScore, 0);
  const teamBScore = teamBPlayers.reduce((s, p) => s + p.totalScore, 0);
  const myTeam = players.find(p => p.id === myPlayerId)
    ? teamASeats.includes(players.find(p => p.id === myPlayerId)!.seatIndex) ? 'A' : 'B'
    : 'A';

  return (
    <div className="absolute left-3 top-1/2 -translate-y-1/2 z-20">
      <motion.div
        initial={{ opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24 }}
        className="w-48 overflow-hidden"
        style={{
          background: 'rgba(5,5,18,0.92)',
          border: '1px solid rgba(99,102,241,0.25)',
          borderRadius: 18,
          boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)',
          backdropFilter: 'blur(24px)',
        }}>

        {/* Header */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="w-full flex items-center justify-between px-3.5 py-2.5 transition-colors hover:bg-white/[0.03]"
        >
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-lg flex items-center justify-center text-xs"
              style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', boxShadow: '0 2px 8px rgba(245,158,11,0.4)' }}>
              🏆
            </div>
            <span className="text-white text-xs font-black uppercase tracking-widest">Scores</span>
          </div>
          <motion.span
            animate={{ rotate: collapsed ? -90 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-[10px]"
            style={{ color: 'rgba(99,102,241,0.7)' }}>
            ▼
          </motion.span>
        </button>

        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
            >
              {/* Round progress */}
              <div className="px-3.5 pb-2.5">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(148,163,184,0.7)' }}>
                    Round {roundNumber}/{roundCount}
                  </span>
                  <span className="text-[10px] font-black" style={{ color: '#4ade80' }}>Low wins</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg,#6366f1,#4ade80)', width: `${progress}%` }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,rgba(99,102,241,0.2),transparent)', margin: '0 12px 8px' }} />

              {/* Player rows */}
              <div className="px-2 pb-2.5 space-y-1">
                {isTeamArena ? (
                  // ── Team Arena: two team rows ──────────────────────────────
                  <>
                    {[
                      { team: 'A' as const, score: teamAScore, seats: teamASeats, isMyTeam: myTeam === 'A' },
                      { team: 'B' as const, score: teamBScore, seats: teamBSeats, isMyTeam: myTeam === 'B' },
                    ].sort((a, b) => a.score - b.score).map((t, rank) => {
                      const teamPlayers = players.filter(p => t.seats.includes(p.seatIndex));
                      const isWinning = rank === 0;
                      const teamColor = t.team === 'A' ? '#818cf8' : '#f87171';
                      const teamBg = t.isMyTeam
                        ? 'rgba(34,197,94,0.12)'
                        : t.team === 'A' ? 'rgba(129,140,248,0.08)' : 'rgba(239,68,68,0.08)';
                      const teamBorder = t.isMyTeam
                        ? '1px solid rgba(34,197,94,0.3)'
                        : `1px solid ${teamColor}30`;
                      return (
                        <motion.div
                          key={t.team}
                          layout
                          className="px-2.5 py-2 rounded-xl relative overflow-hidden"
                          style={{ background: teamBg, border: teamBorder }}
                        >
                          {t.isMyTeam && (
                            <div className="absolute inset-x-0 top-0 h-px"
                              style={{ background: 'linear-gradient(90deg,transparent,rgba(34,197,94,0.5),transparent)' }} />
                          )}
                          <div className="flex items-center gap-2">
                            <div className="w-5 flex-shrink-0 flex items-center justify-center">
                              {isWinning
                                ? <span className="text-sm leading-none">👑</span>
                                : <span className="text-[10px] font-black" style={{ color: 'rgba(148,163,184,0.5)' }}>#2</span>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-black uppercase tracking-wider leading-none mb-0.5"
                                style={{ color: t.isMyTeam ? '#4ade80' : teamColor }}>
                                {t.isMyTeam ? '⚡ Your Team' : '⚔ Enemy'}
                              </p>
                              <p className="text-[9px] truncate leading-none"
                                style={{ color: 'rgba(148,163,184,0.55)' }}>
                                {teamPlayers.map(p => p.id === myPlayerId ? 'You' : p.username).join(' + ')}
                              </p>
                            </div>
                            <span className="text-sm font-black flex-shrink-0"
                              style={{ color: isWinning ? '#fbbf24' : t.isMyTeam ? '#4ade80' : 'rgba(226,232,240,0.6)' }}>
                              {t.score}
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </>
                ) : (
                  // ── Individual rows ────────────────────────────────────────
                  sorted.map((p, rank) => {
                    const isMe = p.id === myPlayerId;
                    const isLeader = rank === 0;
                    return (
                      <motion.div
                        key={p.id}
                        layout
                        className="flex items-center gap-2 px-2.5 py-2 rounded-xl relative overflow-hidden"
                        style={isMe
                          ? { background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)' }
                          : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)' }}
                      >
                        {isMe && (
                          <div className="absolute inset-x-0 top-0 h-px"
                            style={{ background: 'linear-gradient(90deg,transparent,rgba(34,197,94,0.5),transparent)' }} />
                        )}
                        <div className="w-5 flex-shrink-0 flex items-center justify-center">
                          {isLeader
                            ? <span className="text-sm leading-none">👑</span>
                            : <span className="text-[10px] font-black" style={{ color: 'rgba(148,163,184,0.5)' }}>#{rank + 1}</span>}
                        </div>
                        <p className="flex-1 text-xs font-semibold truncate leading-none"
                          style={{ color: isMe ? '#4ade80' : 'rgba(226,232,240,0.85)' }}>
                          {isMe ? 'You' : p.username}
                          {p.isBot && <span className="ml-1 opacity-70">🤖</span>}
                        </p>
                        <div className="flex-shrink-0 text-right">
                          {p.isEliminated ? (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                              style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171' }}>OUT</span>
                          ) : (
                            <span className="text-sm font-black leading-none"
                              style={{ color: isLeader ? '#fbbf24' : isMe ? '#4ade80' : 'rgba(226,232,240,0.7)' }}>
                              {p.totalScore}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="mx-3 mb-2.5 px-3 py-1.5 rounded-xl text-center"
                style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.12)' }}>
                <p className="text-[10px] font-semibold" style={{ color: 'rgba(165,180,252,0.8)' }}>
                  {roundNumber < roundCount
                    ? `${roundCount - roundNumber} round${roundCount - roundNumber > 1 ? 's' : ''} left`
                    : '🔥 Final round!'}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
