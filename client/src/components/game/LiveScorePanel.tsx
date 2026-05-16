import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClientPlayerState } from '../../types';

interface LiveScorePanelProps {
  players: ClientPlayerState[];
  myPlayerId: string;
  roundNumber: number;
  roundCount: number;
}

export function LiveScorePanel({ players, myPlayerId, roundNumber, roundCount }: LiveScorePanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  const sorted = [...players].sort((a, b) => a.totalScore - b.totalScore);
  const progress = (roundNumber / roundCount) * 100;

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
                {sorted.map((p, rank) => {
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

                      {/* Rank */}
                      <div className="w-5 flex-shrink-0 flex items-center justify-center">
                        {isLeader
                          ? <span className="text-sm leading-none">👑</span>
                          : <span className="text-[10px] font-black" style={{ color: 'rgba(148,163,184,0.5)' }}>#{rank + 1}</span>}
                      </div>

                      {/* Name */}
                      <p className="flex-1 text-xs font-semibold truncate leading-none"
                        style={{ color: isMe ? '#4ade80' : 'rgba(226,232,240,0.85)' }}>
                        {isMe ? 'You' : p.username}
                        {p.isBot && <span className="ml-1 opacity-70">🤖</span>}
                      </p>

                      {/* Score */}
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
                })}
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
