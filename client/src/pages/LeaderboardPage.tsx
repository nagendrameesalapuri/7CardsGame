import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { progressionApi } from '../services/api';
import { Layout } from '../components/layout/Layout';
import { Avatar } from '../components/ui/Avatar';
import { AchievementBadge } from '../components/AchievementBadge';
import { PlayerBadge } from '../types';

type Category = 'xp' | 'streak' | 'survival';

interface LeaderEntry {
  rank: number;
  userId: string;
  username: string;
  avatar: string;
  isGuest: boolean;
  level: number;
  playerRank: string;
  xp: number;
  maxWinStreak: number;
  winStreak: number;
  survivalWins: number;
  totalWins: number;
  totalGames: number;
  winRate: number;
  badge?: PlayerBadge | null;
}

const RANK_ICONS: Record<string, string> = {
  bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '💎', diamond: '💠', master: '👑',
};

export function LeaderboardPage() {
  const [leaders, setLeaders] = useState<LeaderEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [category, setCategory] = useState<Category>('xp');

  useEffect(() => {
    setIsLoading(true);
    progressionApi.leaderboard(category)
      .then(r => setLeaders(r.data.leaderboard))
      .finally(() => setIsLoading(false));
  }, [category]);

  const PODIUM = ['🥇', '🥈', '🥉'];
  const CATEGORY_TABS: { key: Category; label: string; emoji: string }[] = [
    { key: 'xp',       label: 'XP & Rank',    emoji: '⭐' },
    { key: 'streak',   label: 'Win Streak',   emoji: '🔥' },
    { key: 'survival', label: 'AI Survival',  emoji: '⚔️' },
  ];

  const statDisplay = (l: LeaderEntry) => {
    if (category === 'xp')       return { main: `${l.xp.toLocaleString()} XP`, sub: `Lv.${l.level} ${RANK_ICONS[l.playerRank] ?? ''} ${l.playerRank}` };
    if (category === 'streak')   return { main: `🔥 ${l.maxWinStreak} best streak`, sub: `Current: ${l.winStreak}` };
    if (category === 'survival') return { main: `⚔️ ${l.survivalWins} wins`, sub: `${l.winRate}% win rate` };
    return { main: '', sub: '' };
  };

  return (
    <Layout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-4xl font-bold font-game text-dark-text mb-2">🏆 Leaderboard</h1>
        <p className="text-dark-muted mb-5">Top players ranked by progression</p>

        {/* Category tabs */}
        <div className="flex gap-2 mb-6">
          {CATEGORY_TABS.map(t => (
            <button key={t.key} onClick={() => setCategory(t.key)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={category === t.key
                ? { background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.4)' }
                : { background: 'rgba(255,255,255,0.04)', color: '#8b949e', border: '1px solid rgba(255,255,255,0.07)' }}>
              {t.emoji} {t.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-dark-muted animate-pulse">Loading...</div>
        ) : leaders.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-dark-border rounded-2xl text-dark-muted">
            <p className="text-4xl mb-3">🏆</p>
            <p>No players yet — be the first on the board!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {leaders.map((l, i) => {
              const stat = statDisplay(l);
              return (
                <motion.div
                  key={l.userId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`flex items-center gap-3 p-4 rounded-xl border transition-colors ${
                    i < 3 ? 'bg-yellow-500/5 border-yellow-500/20' : 'bg-dark-surface border-dark-border'
                  }`}
                >
                  <div className="w-9 text-center font-bold text-lg flex-shrink-0">
                    {i < 3 ? PODIUM[i] : <span className="text-dark-muted text-sm">#{l.rank}</span>}
                  </div>
                  <Avatar avatar={l.avatar} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-dark-text truncate">{l.username}</p>
                      {l.badge && <AchievementBadge badge={l.badge} size="xs" />}
                      {l.isGuest && <span className="text-[10px] text-dark-muted border border-dark-border rounded px-1">Guest</span>}
                    </div>
                    <p className="text-dark-muted text-xs mt-0.5">{l.totalGames} games · {l.winRate}% win rate</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-neon-green text-sm">{stat.main}</p>
                    <p className="text-dark-muted text-xs">{stat.sub}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </Layout>
  );
}
