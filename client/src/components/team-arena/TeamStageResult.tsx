import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TeamArenaStageResult, RoundHistoryEntry } from '../../store/teamArenaStore';
import { Avatar } from '../ui/Avatar';

interface TeamStageResultProps {
  result: TeamArenaStageResult;
  onContinue: () => void;
  onAbandon: () => void;
  stageResults: any[];
}

function ConfettiPiece({ i }: { i: number }) {
  const colors = ['#818cf8', '#6366f1', '#fbbf24', '#34d399', '#f87171', '#a78bfa'];
  return (
    <motion.div
      className="fixed pointer-events-none"
      style={{
        width: 6 + (i % 4) * 2,
        height: 6 + (i % 3) * 2,
        borderRadius: i % 2 === 0 ? 2 : '50%',
        background: colors[i % colors.length],
        left: `${5 + (i * 17 + 13) % 90}%`,
        top: -12,
      }}
      animate={{
        y: ['0vh', '110vh'],
        x: [0, (i % 2 === 0 ? 1 : -1) * (20 + (i * 7) % 40)],
        rotate: [0, (i % 2 === 0 ? 360 : -360)],
        opacity: [1, 1, 0],
      }}
      transition={{
        duration: 2.5 + (i % 5) * 0.3,
        delay: (i % 8) * 0.15,
        ease: 'easeIn',
      }}
    />
  );
}

const SUIT_SYMBOL: Record<string, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
const SUIT_COLOR: Record<string, string> = { hearts: '#f87171', diamonds: '#fb923c', spades: '#94a3b8', clubs: '#a5b4fc' };

function MiniCard({ card }: { card: any }) {
  if (card.isJoker) return (
    <span style={{ fontSize: 9, background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 3, padding: '1px 3px', color: '#fbbf24', fontWeight: 700 }}>🃏</span>
  );
  return (
    <span style={{ fontSize: 9, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, padding: '1px 3px', color: SUIT_COLOR[card.suit] ?? '#94a3b8', fontWeight: 700 }}>
      {card.rank}{SUIT_SYMBOL[card.suit] ?? '?'}
    </span>
  );
}

function RoundBreakdown({ rounds, myPlayerId }: { rounds: RoundHistoryEntry[]; myPlayerId?: string }) {
  if (!rounds.length) return null;

  return (
    <div className="mt-4">
      <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,rgba(99,102,241,0.25),transparent)', marginBottom: 12 }} />
      <p className="text-xs font-black uppercase tracking-widest mb-3 text-center" style={{ color: 'rgba(148,163,184,0.6)' }}>
        ⚡ Round Breakdown
      </p>
      <div className="space-y-3">
        {rounds.map((round) => {
          const winner = [...round.playerResults].sort((a, b) => a.roundPoints - b.roundPoints)[0];
          const teamAPlayers = round.playerResults.filter((p) => p.team === 'A');
          const teamBPlayers = round.playerResults.filter((p) => p.team === 'B');
          return (
            <div key={round.roundNumber} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 10px' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'rgba(165,180,252,0.9)' }}>
                  Round {round.roundNumber}
                </span>
                {winner && (
                  <span className="text-[9px] font-bold" style={{ color: '#fbbf24' }}>
                    🏆 {winner.username === myPlayerId ? 'You' : winner.username}
                  </span>
                )}
              </div>
              {[
                { players: teamAPlayers, color: '#818cf8', label: 'Your Team' },
                { players: teamBPlayers, color: '#f87171', label: 'Enemy' },
              ].map(({ players, color, label }, ti) => (
                <React.Fragment key={ti}>
                  {ti === 1 && <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '5px 0' }} />}
                  {players.map((pr) => (
                    <div key={pr.playerId} className="flex items-start gap-1.5 py-0.5">
                      <Avatar avatar={pr.avatar} size="xs" isBot={pr.isBot} />
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-semibold" style={{ color }}>{pr.username}</span>
                        <div className="flex flex-wrap gap-0.5 mt-0.5">
                          {pr.hand.map((c, ci) => <MiniCard key={ci} card={c} />)}
                        </div>
                      </div>
                      <span className="text-[10px] font-black flex-shrink-0" style={{ color: pr.roundPoints === 0 ? '#4ade80' : 'rgba(226,232,240,0.6)' }}>
                        +{pr.roundPoints}
                      </span>
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StageProgressPill({ stage, result, current }: {
  stage: number; result?: any; current: boolean;
}) {
  const won = result?.teamAWon;
  const done = !!result;

  return (
    <div
      className="flex flex-col items-center gap-1"
      style={{ opacity: done || current ? 1 : 0.35 }}
    >
      <motion.div
        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black"
        animate={current ? { scale: [1, 1.12, 1] } : {}}
        transition={{ repeat: Infinity, duration: 1.8 }}
        style={{
          background: done
            ? won ? 'linear-gradient(135deg,#34d399,#10b981)' : 'linear-gradient(135deg,#ef4444,#dc2626)'
            : current
              ? 'linear-gradient(135deg,#818cf8,#6366f1)'
              : 'rgba(255,255,255,0.06)',
          border: current ? '2px solid rgba(129,140,248,0.6)' : '1px solid rgba(255,255,255,0.1)',
          boxShadow: current ? '0 0 12px rgba(99,102,241,0.5)' : 'none',
          color: done || current ? '#fff' : 'rgba(148,163,184,0.5)',
        }}
      >
        {done ? (won ? '✓' : '✗') : stage}
      </motion.div>
      <span className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>
        S{stage}
      </span>
    </div>
  );
}

export function TeamStageResult({ result, onContinue, onAbandon, stageResults }: TeamStageResultProps) {
  const [showRounds, setShowRounds] = useState(false);
  const didWin = result.teamAWon;
  const isFinal = result.tournamentOver;

  const accentColor = didWin ? '#34d399' : '#ef4444';
  const accentGlow  = didWin ? 'rgba(52,211,153,0.3)' : 'rgba(239,68,68,0.3)';

  return (
    <motion.div
      key="team-stage-result"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(14px)' }}
    >
      {/* Confetti on win */}
      {didWin && Array.from({ length: 48 }).map((_, i) => <ConfettiPiece key={i} i={i} />)}

      {/* Radial glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 40%,${accentGlow} 0%,transparent 65%)`,
        }}
      />

      <div className="min-h-full flex items-center justify-center p-4 py-6">
      <motion.div
        initial={{ scale: 0.88, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 180, damping: 20 }}
        className="relative w-full rounded-2xl overflow-hidden"
        style={{
          maxWidth: 400,
          background: 'linear-gradient(160deg,#0d0f1f,#080a18)',
          border: `1px solid ${accentColor}44`,
          boxShadow: `0 0 0 1px ${accentColor}22, 0 24px 60px rgba(0,0,0,0.7), 0 0 40px ${accentGlow}`,
        }}
      >
        {/* Shimmer top bar */}
        <div
          className="h-1 w-full"
          style={{
            background: didWin
              ? 'linear-gradient(90deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981)'
              : 'linear-gradient(90deg,#dc2626,#ef4444,#fca5a5,#ef4444,#dc2626)',
          }}
        />

        <div className="p-5">
          {/* Stage progress map */}
          <div className="flex items-center justify-center gap-2 mb-5">
            {[1,2,3,4,5].map((s, i) => (
              <React.Fragment key={s}>
                <StageProgressPill
                  stage={s}
                  result={stageResults.find((r) => r.stage === s)}
                  current={s === result.stage}
                />
                {i < 4 && (
                  <div
                    className="h-px flex-1"
                    style={{ background: 'rgba(255,255,255,0.08)', maxWidth: 28 }}
                  />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Result header */}
          <div className="text-center mb-5">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.1 }}
              className="text-5xl mb-2"
            >
              {isFinal && didWin ? '🏆' : didWin ? '🎉' : '💀'}
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xl font-black mb-1"
              style={{ color: accentColor }}
            >
              {isFinal
                ? didWin ? 'ARENA CHAMPIONS!' : 'ELIMINATED'
                : didWin ? 'STAGE CLEARED!' : 'STAGE LOST'}
            </motion.h2>
            <p className="text-sm" style={{ color: 'rgba(148,163,184,0.7)' }}>
              {result.stageName} · {result.stageSubtitle}
            </p>
          </div>

          {/* Team score comparison */}
          <div
            className="rounded-xl p-4 mb-4"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            {/* Your team */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black tracking-widest uppercase" style={{ color: '#818cf8' }}>
                  YOUR TEAM
                </span>
                <span
                  className="text-sm font-black px-2 py-0.5 rounded-full"
                  style={{
                    background: result.teamAWon ? 'rgba(52,211,153,0.15)' : 'rgba(239,68,68,0.12)',
                    color: result.teamAWon ? '#34d399' : '#f87171',
                    border: `1px solid ${result.teamAWon ? 'rgba(52,211,153,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  }}
                >
                  {result.teamAScore} pts
                </span>
              </div>
              {result.scoreboard.filter((p) => p.team === 'A').map((p, i) => {
                const roundEntry = result.roundHistory?.[result.roundHistory.length - 1]?.playerResults.find(r => r.username === p.name && r.team === 'A');
                return (
                  <div key={i} className="flex items-center gap-2 py-0.5">
                    {roundEntry ? <Avatar avatar={roundEntry.avatar} size="xs" isBot={!p.isHuman} /> : <span className="text-xs">{p.isHuman ? '👤' : '🤖'}</span>}
                    <span className="flex-1 text-xs" style={{ color: 'rgba(165,180,252,0.8)' }}>{p.name}</span>
                    <span className="text-xs font-bold tabular-nums" style={{ color: '#a5b4fc' }}>{p.score} pts</span>
                  </div>
                );
              })}
            </div>

            {/* VS separator */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
              <span className="text-xs font-black" style={{ color: 'rgba(148,163,184,0.4)' }}>VS</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
            </div>

            {/* Enemy team */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black tracking-widest uppercase" style={{ color: '#f87171' }}>
                  ENEMY TEAM
                </span>
                <span
                  className="text-sm font-black px-2 py-0.5 rounded-full"
                  style={{
                    background: !result.teamAWon ? 'rgba(52,211,153,0.15)' : 'rgba(239,68,68,0.12)',
                    color: !result.teamAWon ? '#34d399' : '#f87171',
                    border: `1px solid ${!result.teamAWon ? 'rgba(52,211,153,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  }}
                >
                  {result.teamBScore} pts
                </span>
              </div>
              {result.scoreboard.filter((p) => p.team === 'B').map((p, i) => {
                const roundEntry = result.roundHistory?.[result.roundHistory.length - 1]?.playerResults.find(r => r.username === p.name && r.team === 'B');
                return (
                  <div key={i} className="flex items-center gap-2 py-0.5">
                    {roundEntry ? <Avatar avatar={roundEntry.avatar} size="xs" isBot /> : <span className="text-xs">🤖</span>}
                    <span className="flex-1 text-xs" style={{ color: 'rgba(248,113,113,0.8)' }}>{p.name}</span>
                    <span className="text-xs font-bold tabular-nums" style={{ color: '#fca5a5' }}>{p.score} pts</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Round Breakdown toggle */}
          {result.roundHistory && result.roundHistory.length > 0 && (
            <div className="mb-4">
              <button
                onClick={() => setShowRounds((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors"
                style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}
              >
                <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'rgba(165,180,252,0.8)' }}>
                  ⚡ Round Breakdown ({result.roundHistory.length} rounds)
                </span>
                <motion.span
                  animate={{ rotate: showRounds ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-[10px]"
                  style={{ color: 'rgba(99,102,241,0.7)' }}
                >▼</motion.span>
              </button>
              <AnimatePresence>
                {showRounds && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <RoundBreakdown rounds={result.roundHistory ?? []} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Points earned */}
          {didWin && result.pointsEarned > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              className="flex items-center justify-center gap-2 mb-4 py-2 rounded-xl"
              style={{
                background: 'rgba(52,211,153,0.1)',
                border: '1px solid rgba(52,211,153,0.3)',
              }}
            >
              <span className="text-base">💎</span>
              <span className="text-sm font-bold" style={{ color: '#34d399' }}>
                +{result.pointsEarned} pts earned (₹{(result.pointsEarned / 100).toFixed(2)})
              </span>
            </motion.div>
          )}

          {/* Total earned */}
          {isFinal && (result.totalPointsEarned ?? 0) > 0 && (
            <div
              className="flex items-center justify-between mb-4 px-3 py-2 rounded-xl"
              style={{
                background: 'rgba(251,191,36,0.08)',
                border: '1px solid rgba(251,191,36,0.25)',
              }}
            >
              <span className="text-xs font-bold" style={{ color: '#fbbf24' }}>Total earned this run</span>
              <span className="text-sm font-black" style={{ color: '#fbbf24' }}>
                {result.totalPointsEarned} pts
              </span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex flex-col gap-2">
            {!isFinal && didWin && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={onContinue}
                className="w-full py-3 rounded-xl font-black text-sm tracking-wide"
                style={{
                  background: 'linear-gradient(135deg,#6366f1,#818cf8)',
                  color: '#fff',
                  boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
                }}
              >
                {result.nextStage === 5 ? '⚔ Enter Final Arena' : `Continue → Stage ${result.nextStage}`}
              </motion.button>
            )}
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.97 }}
              onClick={onAbandon}
              className="w-full py-2.5 rounded-xl text-sm font-bold"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#64748b',
              }}
            >
              {isFinal ? 'Back to Lobby' : 'Abandon Tournament'}
            </motion.button>
          </div>
        </div>
      </motion.div>
      </div>
    </motion.div>
  );
}
