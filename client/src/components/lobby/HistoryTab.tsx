import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { gamesApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

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
    return (
      <div className="text-center py-20 text-neon-red">{error}</div>
    );
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

        return (
          <motion.div
            key={game.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={clsx(
              'bg-dark-surface border rounded-xl p-4',
              iWon ? 'border-neon-green/40' : 'border-dark-border',
            )}
          >
            {/* Header row */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">{iWon ? '🏆' : '💀'}</span>
                <div>
                  <p className={clsx(
                    'font-bold text-sm',
                    iWon ? 'text-neon-green' : 'text-neon-red',
                  )}>
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
                  <p className={clsx(
                    'font-bold text-lg',
                    iWon ? 'text-neon-green' : 'text-dark-text',
                  )}>{myScore} pts</p>
                </div>
              )}
            </div>

            {/* Winner */}
            {game.winnerUsername && (
              <p className="text-xs text-dark-muted mb-2">
                Winner: <span className="text-yellow-400 font-semibold">{game.winnerUsername}</span>
              </p>
            )}

            {/* Players scoreboard */}
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
                    <span className="w-4 text-center font-bold">
                      {rank === 0 ? '👑' : `#${rank + 1}`}
                    </span>
                    <span className="font-medium">
                      {p.userId === user?.id ? 'You' : p.username}
                      {p.isBot && ' 🤖'}
                    </span>
                  </div>
                  <span className="font-bold">{p.totalScore} pts</span>
                </div>
              ))}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
