import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Player {
  id: string;
  username: string;
  totalScore: number;
  roundScore: number;
  isBot: boolean;
  isEliminated: boolean;
  seatIndex: number;
}

interface TeamHUDProps {
  players: Player[];
  myPlayerId: string;
  teammateType: 'ai' | 'human';
  teammateName: string;
  stage: number;
  stageName: string;
  stageSubtitle: string;
  totalStages: number;
}

function TeamBlock({
  label, color, glow, players, isMyTeam,
}: {
  label: string; color: string; glow: string; players: Player[]; isMyTeam: boolean;
}) {
  const teamTotal = players.reduce((s, p) => s + (p.isEliminated ? 999 : p.totalScore), 0);

  return (
    <div
      className="flex-1 rounded-xl overflow-hidden"
      style={{
        background: isMyTeam
          ? 'linear-gradient(135deg,rgba(99,102,241,0.18),rgba(139,92,246,0.10))'
          : 'linear-gradient(135deg,rgba(239,68,68,0.14),rgba(220,38,38,0.08))',
        border: `1px solid ${glow}`,
      }}
    >
      {/* Header */}
      <div
        className="px-3 py-1.5 flex items-center justify-between"
        style={{ background: `${color}22`, borderBottom: `1px solid ${glow}` }}
      >
        <span className="text-xs font-black tracking-widest uppercase" style={{ color }}>
          {label}
        </span>
        <span className="text-xs font-bold" style={{ color }}>
          Total: {teamTotal}
        </span>
      </div>

      {/* Player rows */}
      <div className="px-3 py-2 space-y-1.5">
        {players.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{
                  background: p.isEliminated ? '#ef4444' : color,
                  boxShadow: p.isEliminated ? 'none' : `0 0 5px ${color}`,
                }}
              />
              <span
                className="text-xs truncate"
                style={{ color: p.isEliminated ? '#64748b' : '#e2e8f0', maxWidth: 80 }}
              >
                {p.username}
              </span>
              {p.isEliminated && (
                <span className="text-xs" style={{ color: '#ef4444' }}>✕</span>
              )}
            </div>
            <span
              className="text-xs font-bold tabular-nums flex-shrink-0"
              style={{ color: p.isEliminated ? '#64748b' : color }}
            >
              {p.isEliminated ? 'OUT' : `${p.totalScore}pt`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TeamHUD({
  players, myPlayerId, teammateType, teammateName, stage, stageName, stageSubtitle, totalStages,
}: TeamHUDProps) {
  if (!players.length) return null;

  // Determine teams by seat parity
  // AI mode: even seats (0,2) = Team A, odd seats (1,3) = Team B
  // Human mode: seats 0,1 = Team A, seats 2,3 = Team B
  const teamAIndices = teammateType === 'ai' ? [0, 2] : [0, 1];
  const teamBIndices = teammateType === 'ai' ? [1, 3] : [2, 3];

  const teamAPlayers = players.filter((p) => teamAIndices.includes(p.seatIndex));
  const teamBPlayers = players.filter((p) => teamBIndices.includes(p.seatIndex));

  const teamATotal = teamAPlayers.reduce((s, p) => s + (p.isEliminated ? 999 : p.totalScore), 0);
  const teamBTotal = teamBPlayers.reduce((s, p) => s + (p.isEliminated ? 999 : p.totalScore), 0);
  const myTeamLeading = teamATotal <= teamBTotal;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full px-2 py-2"
      style={{ maxWidth: 480, margin: '0 auto' }}
    >
      {/* Stage pill */}
      <div className="flex items-center justify-center mb-2">
        <div
          className="flex items-center gap-2 px-3 py-1 rounded-full"
          style={{
            background: 'rgba(99,102,241,0.15)',
            border: '1px solid rgba(99,102,241,0.35)',
          }}
        >
          <span className="text-xs font-black tracking-widest uppercase" style={{ color: '#a5b4fc' }}>
            TEAM ARENA
          </span>
          <span className="text-xs" style={{ color: 'rgba(165,180,252,0.5)' }}>·</span>
          <span className="text-xs font-bold" style={{ color: '#a5b4fc' }}>
            Stage {stage}/{totalStages}
          </span>
          <span className="text-xs" style={{ color: 'rgba(165,180,252,0.5)' }}>·</span>
          <span className="text-xs" style={{ color: '#7c86c4' }}>{stageName}</span>
        </div>
      </div>

      {/* Team blocks */}
      <div className="flex gap-2">
        <TeamBlock
          label="Your Team"
          color="#818cf8"
          glow="rgba(129,140,248,0.35)"
          players={teamAPlayers}
          isMyTeam
        />

        {/* VS divider */}
        <div className="flex flex-col items-center justify-center gap-1 px-1">
          <div className="w-px flex-1" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <motion.span
            animate={{ scale: myTeamLeading ? [1, 1.15, 1] : [1, 0.9, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="text-xs font-black"
            style={{ color: myTeamLeading ? '#818cf8' : '#ef4444' }}
          >
            VS
          </motion.span>
          <div className="w-px flex-1" style={{ background: 'rgba(255,255,255,0.08)' }} />
        </div>

        <TeamBlock
          label="Enemy Team"
          color="#f87171"
          glow="rgba(248,113,113,0.3)"
          players={teamBPlayers}
          isMyTeam={false}
        />
      </div>

      {/* Score comparison bar */}
      <div className="mt-2 rounded-lg overflow-hidden h-1.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <motion.div
          className="h-full"
          style={{
            background: myTeamLeading
              ? 'linear-gradient(90deg,#818cf8,#6366f1)'
              : 'linear-gradient(90deg,#ef4444,#dc2626)',
            width: `${Math.min(100, Math.max(5, (teamBTotal / Math.max(1, teamATotal + teamBTotal)) * 100))}%`,
          }}
          animate={{ width: `${Math.min(100, Math.max(5, (teamBTotal / Math.max(1, teamATotal + teamBTotal)) * 100))}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-xs" style={{ color: 'rgba(129,140,248,0.7)' }}>Your team: {teamATotal}pt</span>
        <span className="text-xs" style={{ color: 'rgba(248,113,113,0.7)' }}>Enemies: {teamBTotal}pt</span>
      </div>
    </motion.div>
  );
}
