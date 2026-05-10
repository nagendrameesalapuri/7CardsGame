import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { gamesApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

interface PlayerRoundResult {
  playerId: string;
  username: string;
  roundPoints: number;
  totalScore: number;
}

interface RoundEntry {
  roundNumber: number;
  jokerRank: string;
  showPlayerWon: boolean;
  playerResults: PlayerRoundResult[];
}

interface GameHistoryEntry {
  id: string;
  roomId: string;
  roundCount: number;
  winnerId: string | null;
  winnerUsername: string | null;
  myResult: { userId: string; username: string; totalScore: number; isBot: boolean } | null;
  players: Array<{
    userId: string;
    username: string;
    avatar: string;
    totalScore: number;
    isBot: boolean;
    isWinner: boolean;
  }>;
  rounds: RoundEntry[];
  roundsPlayed: number;
  startedAt: string;
  endedAt: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function HistoryTab() {
  const { user } = useAuthStore();
  const [games, setGames] = useState<GameHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedGame, setExpandedGame] = useState<string | null>(null);

  useEffect(() => {
    gamesApi.history()
      .then(r => setGames(r.data.games))
      .catch(() => setError('Failed to load history'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-dark-muted animate-pulse">
        Loading history…
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-20 text-neon-red">{error}</div>;
  }

  if (games.length === 0) {
    return (
      <div className="text-center py-20 border border-dashed border-dark-border rounded-2xl text-dark-muted">
        <p className="text-4xl mb-3">🃏</p>
        <p>No games played yet — start a game to see your history!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {games.map((game, i) => {
        const iWon = game.winnerId === user?.id ||
          game.players.some(p => p.userId === user?.id && p.isWinner);
        const myScore = game.myResult?.totalScore ?? null;
        const sorted = [...game.players].sort((a, b) => a.totalScore - b.totalScore);
        const isExpanded = expandedGame === game.id;

        return (
          <motion.div
            key={game.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={clsx(
              'bg-dark-surface border rounded-xl overflow-hidden',
              iWon ? 'border-neon-green/40' : 'border-dark-border',
            )}
          >
            {/* ── Header ── */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{iWon ? '🏆' : '💀'}</span>
                  <div>
                    <p className={clsx('font-bold text-sm', iWon ? 'text-neon-green' : 'text-neon-red')}>
                      {iWon ? 'Victory' : 'Defeat'}
                    </p>
                    <p className="text-dark-muted text-xs">
                      {game.roundsPlayed}{game.roundCount ? `/${game.roundCount}` : ''} rounds · {timeAgo(game.endedAt)}
                    </p>
                  </div>
                </div>
                {myScore !== null && (
                  <div className="text-right">
                    <p className="text-dark-muted text-xs">Your score</p>
                    <p className={clsx('font-bold text-lg', iWon ? 'text-neon-green' : 'text-dark-text')}>
                      {myScore} pts
                    </p>
                  </div>
                )}
              </div>

              {game.winnerUsername && (
                <p className="text-xs text-dark-muted mb-2">
                  Winner: <span className="text-yellow-400 font-semibold">{game.winnerUsername}</span>
                </p>
              )}

              {/* Final standings */}
              <div className="space-y-1">
                {sorted.map((p, rank) => (
                  <div
                    key={p.userId}
                    className={clsx(
                      'flex items-center justify-between px-2 py-1 rounded-lg text-xs',
                      p.isWinner
                        ? 'bg-neon-green/10 text-neon-green'
                        : p.userId === user?.id
                          ? 'bg-white/5 text-dark-text'
                          : 'text-dark-muted',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-4 text-center font-bold">{rank === 0 ? '👑' : `#${rank + 1}`}</span>
                      <span className="font-medium">
                        {p.userId === user?.id ? 'You' : p.username}
                        {p.isBot && ' 🤖'}
                      </span>
                    </div>
                    <span className="font-bold">{p.totalScore} pts</span>
                  </div>
                ))}
              </div>

              {/* Expand toggle */}
              {game.rounds.length > 0 && (
                <button
                  onClick={() => setExpandedGame(isExpanded ? null : game.id)}
                  className="mt-3 w-full flex items-center justify-center gap-1 text-xs text-dark-muted hover:text-dark-text transition-colors py-1 border border-dark-border rounded-lg hover:border-dark-text/30"
                >
                  <span>{isExpanded ? '▲ Hide' : '▼ Show'} round-by-round details</span>
                </button>
              )}
            </div>

            {/* ── Round breakdown ── */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden border-t border-dark-border"
                >
                  <div className="p-4 space-y-3">
                    <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider">Round Results</p>
                    {game.rounds.map(round => {
                      const roundWinner = round.playerResults.reduce(
                        (best, r) => r.roundPoints < best.roundPoints ? r : best,
                        round.playerResults[0],
                      );
                      const sortedRound = [...round.playerResults].sort((a, b) => a.roundPoints - b.roundPoints);

                      return (
                        <div key={round.roundNumber} className="bg-dark-bg rounded-xl p-3">
                          {/* Round header */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-dark-text bg-dark-border px-2 py-0.5 rounded-full">
                                Round {round.roundNumber}
                              </span>
                              <span className="text-xs text-dark-muted">
                                ★ Joker: <span className="text-yellow-400 font-semibold">{round.jokerRank}</span>
                              </span>
                            </div>
                            <span className="text-xs text-neon-green font-medium">
                              🏆 {roundWinner.username === (game.players.find(p => p.userId === user?.id)?.username) ? 'You' : roundWinner.username}
                            </span>
                          </div>

                          {/* Per-player row */}
                          <div className="space-y-1">
                            {sortedRound.map((pr, ri) => {
                              const isMe = game.players.find(p => p.userId === user?.id)?.username === pr.username;
                              const isRoundWinner = pr.roundPoints === 0;
                              return (
                                <div
                                  key={pr.playerId}
                                  className={clsx(
                                    'flex items-center justify-between px-2 py-1 rounded-lg text-xs',
                                    isRoundWinner
                                      ? 'bg-neon-green/10 text-neon-green'
                                      : isMe
                                        ? 'bg-white/5 text-dark-text'
                                        : 'text-dark-muted',
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="w-4 text-center">{ri === 0 ? '👑' : `#${ri + 1}`}</span>
                                    <span className="font-medium">{isMe ? 'You' : pr.username}</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className={clsx(
                                      'font-bold',
                                      isRoundWinner ? 'text-neon-green' : 'text-neon-red',
                                    )}>
                                      {isRoundWinner ? '+0' : `+${pr.roundPoints}`} pts
                                    </span>
                                    <span className="text-dark-muted">→ {pr.totalScore} total</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}
