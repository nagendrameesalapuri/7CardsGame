import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { usersApi } from '../services/api';
import { Layout } from '../components/layout/Layout';
import { Avatar } from '../components/ui/Avatar';

interface LeaderEntry {
  rank: number;
  id: string;
  username: string;
  avatar: string;
  isGuest: boolean;
  gamesWon: number;
  gamesPlayed: number;
  winRate: number;
}

export function LeaderboardPage() {
  const [leaders, setLeaders] = useState<LeaderEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    usersApi.leaderboard()
      .then(r => setLeaders(r.data.leaderboard))
      .finally(() => setIsLoading(false));
  }, []);

  const MEDALS = ['🥇', '🥈', '🥉'];

  return (
    <Layout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-4xl font-bold font-game text-dark-text mb-2">🏆 Leaderboard</h1>
        <p className="text-dark-muted mb-8">Top players by wins</p>

        {isLoading ? (
          <div className="text-center py-16 text-dark-muted animate-pulse">Loading...</div>
        ) : leaders.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-dark-border rounded-2xl text-dark-muted">
            <p className="text-4xl mb-3">🏆</p>
            <p>No games played yet — be the first on the board!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {leaders.map((l, i) => (
              <motion.div
                key={l.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                  i < 3 ? 'bg-yellow-500/5 border-yellow-500/20' : 'bg-dark-surface border-dark-border'
                }`}
              >
                <div className="w-10 text-center font-bold text-lg">
                  {i < 3 ? MEDALS[i] : <span className="text-dark-muted">#{l.rank}</span>}
                </div>
                <Avatar avatar={l.avatar} size="md" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-dark-text">{l.username}</p>
                    {l.isGuest && <span className="text-xs text-dark-muted border border-dark-border rounded px-1">Guest</span>}
                  </div>
                  <p className="text-dark-muted text-xs">{l.gamesPlayed} games played</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-neon-green">{l.gamesWon} wins</p>
                  <p className="text-dark-muted text-xs">{l.winRate}% win rate</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </Layout>
  );
}
