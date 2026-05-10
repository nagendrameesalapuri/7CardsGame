import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { ClientPlayerState } from '../../types';

interface LiveScorePanelProps {
  players: ClientPlayerState[];
  myPlayerId: string;
  roundNumber: number;
  roundCount: number;
}

export function LiveScorePanel({ players, myPlayerId, roundNumber, roundCount }: LiveScorePanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Sort ascending — lowest score is winning
  const sorted = [...players].sort((a, b) => a.totalScore - b.totalScore);
  const leader = sorted[0];

  return (
    <div className="absolute left-3 top-1/2 -translate-y-1/2 z-20 flex flex-col items-start">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="bg-black/70 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden shadow-2xl w-44"
      >
        {/* Header */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-yellow-400 text-sm">🏆</span>
            <span className="text-white text-xs font-bold uppercase tracking-wide">Scores</span>
          </div>
          <span className="text-dark-muted text-xs">
            {collapsed ? '▶' : '▼'}
          </span>
        </button>

        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Round progress bar */}
              <div className="px-3 pb-2">
                <div className="flex justify-between text-xs text-dark-muted mb-1">
                  <span>Round {roundNumber}/{roundCount}</span>
                  <span className="text-neon-green text-xs">Low wins</span>
                </div>
                <div className="h-1 bg-dark-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-neon-green rounded-full transition-all"
                    style={{ width: `${(roundNumber / roundCount) * 100}%` }}
                  />
                </div>
              </div>

              {/* Player scores */}
              <div className="px-2 pb-2 space-y-1">
                {sorted.map((p, rank) => {
                  const isMe = p.id === myPlayerId;
                  const isLeading = p.id === leader.id;

                  return (
                    <motion.div
                      key={p.id}
                      layout
                      className={clsx(
                        'flex items-center gap-2 px-2 py-1.5 rounded-lg',
                        isMe
                          ? 'bg-neon-green/15 border border-neon-green/30'
                          : 'bg-white/5 border border-transparent',
                      )}
                    >
                      {/* Rank / crown */}
                      <div className="w-5 text-center flex-shrink-0">
                        {rank === 0
                          ? <span className="text-yellow-400 text-sm">👑</span>
                          : <span className="text-dark-muted text-xs font-bold">#{rank + 1}</span>}
                      </div>

                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <p className={clsx(
                          'text-xs font-medium truncate',
                          isMe ? 'text-neon-green' : 'text-dark-text',
                        )}>
                          {isMe ? 'You' : p.username}
                          {p.isBot && <span className="ml-1 text-neon-blue text-xs">🤖</span>}
                        </p>
                      </div>

                      {/* Score */}
                      <div className={clsx(
                        'text-sm font-bold flex-shrink-0',
                        isLeading ? 'text-yellow-400' : 'text-dark-text',
                      )}>
                        {p.totalScore}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Footer hint */}
              <div className="px-3 py-1.5 border-t border-white/5 text-center">
                <p className="text-dark-muted text-xs">
                  {roundNumber < roundCount
                    ? `${roundCount - roundNumber} round${roundCount - roundNumber > 1 ? 's' : ''} left`
                    : 'Final round!'}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
