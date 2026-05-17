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

const B = {
  unstoppable:  { emoji:'⚡',  name:'Unstoppable',   rarity:'legendary' } as PlayerBadge,
  champion:     { emoji:'🏆',  name:'Champion',      rarity:'legendary' } as PlayerBadge,
  cardShark:    { emoji:'🦈',  name:'Card Shark',    rarity:'epic'      } as PlayerBadge,
  bossSlayer:   { emoji:'💀',  name:'Boss Slayer',   rarity:'epic'      } as PlayerBadge,
  centurion:    { emoji:'💯',  name:'Centurion',     rarity:'epic'      } as PlayerBadge,
  halfChampion: { emoji:'⚔️', name:'Half Champion', rarity:'rare'      } as PlayerBadge,
  onFire:       { emoji:'🌋',  name:'On Fire',       rarity:'rare'      } as PlayerBadge,
  veteran:      { emoji:'🎖️', name:'Veteran',       rarity:'rare'      } as PlayerBadge,
  hotStreak:    { emoji:'🔥',  name:'Hot Streak',    rarity:'common'    } as PlayerBadge,
  gettingStarted:{ emoji:'🎮', name:'Getting Started',rarity:'common'   } as PlayerBadge,
};

const DUMMY_PLAYERS: LeaderEntry[] = [
  { rank:0, userId:'d1',  username:'RajeshKumar',        avatar:'avatar_1',  isGuest:false, level:18, playerRank:'gold',   xp:4820, maxWinStreak:14, winStreak:2,  survivalWins:8,  totalWins:184, totalGames:247, winRate:74, badge:B.unstoppable   },
  { rank:0, userId:'d2',  username:'PriyaSharma',        avatar:'avatar_2',  isGuest:false, level:16, playerRank:'gold',   xp:4210, maxWinStreak:11, winStreak:3,  survivalWins:6,  totalWins:152, totalGames:211, winRate:72, badge:B.champion      },
  { rank:0, userId:'d3',  username:'ArjunReddy',         avatar:'avatar_3',  isGuest:false, level:14, playerRank:'silver', xp:3780, maxWinStreak:9,  winStreak:1,  survivalWins:5,  totalWins:127, totalGames:189, winRate:67, badge:B.bossSlayer    },
  { rank:0, userId:'d4',  username:'PoornimaPanjagalla', avatar:'avatar_4',  isGuest:false, level:14, playerRank:'silver', xp:3540, maxWinStreak:8,  winStreak:0,  survivalWins:4,  totalWins:122, totalGames:178, winRate:69, badge:B.cardShark     },
  { rank:0, userId:'d5',  username:'SunitaVerma',        avatar:'avatar_5',  isGuest:false, level:12, playerRank:'silver', xp:3120, maxWinStreak:7,  winStreak:4,  survivalWins:4,  totalWins:98,  totalGames:152, winRate:64, badge:B.centurion     },
  { rank:0, userId:'d6',  username:'VikramSingh',        avatar:'avatar_6',  isGuest:false, level:11, playerRank:'silver', xp:2870, maxWinStreak:7,  winStreak:2,  survivalWins:3,  totalWins:87,  totalGames:134, winRate:65, badge:B.halfChampion  },
  { rank:0, userId:'d7',  username:'DeepikaNair',        avatar:'avatar_7',  isGuest:false, level:10, playerRank:'bronze', xp:2540, maxWinStreak:6,  winStreak:1,  survivalWins:3,  totalWins:76,  totalGames:128, winRate:59, badge:B.onFire        },
  { rank:0, userId:'d8',  username:'AmitPatel',          avatar:'avatar_8',  isGuest:false, level:9,  playerRank:'bronze', xp:2340, maxWinStreak:6,  winStreak:0,  survivalWins:2,  totalWins:71,  totalGames:119, winRate:60, badge:B.onFire        },
  { rank:0, userId:'d9',  username:'KavyaMenon',         avatar:'avatar_9',  isGuest:false, level:8,  playerRank:'bronze', xp:2100, maxWinStreak:5,  winStreak:3,  survivalWins:2,  totalWins:65,  totalGames:109, winRate:60, badge:B.veteran       },
  { rank:0, userId:'d10', username:'SandeepRao',         avatar:'avatar_10', isGuest:false, level:7,  playerRank:'bronze', xp:1890, maxWinStreak:5,  winStreak:1,  survivalWins:2,  totalWins:59,  totalGames:101, winRate:58, badge:B.veteran       },
  { rank:0, userId:'d11', username:'MeenakshiIyer',      avatar:'avatar_11', isGuest:false, level:7,  playerRank:'bronze', xp:1650, maxWinStreak:4,  winStreak:0,  survivalWins:1,  totalWins:52,  totalGames:96,  winRate:54, badge:B.hotStreak     },
  { rank:0, userId:'d12', username:'RohitMishra',        avatar:'avatar_12', isGuest:false, level:6,  playerRank:'bronze', xp:1410, maxWinStreak:4,  winStreak:2,  survivalWins:1,  totalWins:44,  totalGames:87,  winRate:51, badge:B.hotStreak     },
  { rank:0, userId:'d13', username:'AnanyaDas',          avatar:'avatar_1',  isGuest:false, level:5,  playerRank:'bronze', xp:1250, maxWinStreak:3,  winStreak:0,  survivalWins:1,  totalWins:39,  totalGames:81,  winRate:48, badge:B.hotStreak     },
  { rank:0, userId:'d14', username:'NehaSaxena',         avatar:'avatar_2',  isGuest:false, level:5,  playerRank:'bronze', xp:1080, maxWinStreak:3,  winStreak:1,  survivalWins:1,  totalWins:35,  totalGames:76,  winRate:46, badge:B.gettingStarted},
  { rank:0, userId:'d15', username:'PrakashGupta',       avatar:'avatar_3',  isGuest:false, level:4,  playerRank:'bronze', xp:920,  maxWinStreak:2,  winStreak:0,  survivalWins:0,  totalWins:29,  totalGames:69,  winRate:42, badge:B.gettingStarted},
  { rank:0, userId:'d16', username:'LalithaKumar',       avatar:'avatar_4',  isGuest:false, level:4,  playerRank:'bronze', xp:780,  maxWinStreak:2,  winStreak:0,  survivalWins:0,  totalWins:24,  totalGames:63,  winRate:38, badge:B.gettingStarted},
  { rank:0, userId:'d17', username:'ManishBansal',       avatar:'avatar_5',  isGuest:false, level:3,  playerRank:'bronze', xp:640,  maxWinStreak:2,  winStreak:0,  survivalWins:0,  totalWins:21,  totalGames:59,  winRate:36, badge:B.gettingStarted},
  { rank:0, userId:'d18', username:'PreethaRajan',       avatar:'avatar_6',  isGuest:false, level:2,  playerRank:'bronze', xp:490,  maxWinStreak:1,  winStreak:0,  survivalWins:0,  totalWins:17,  totalGames:54,  winRate:31, badge:B.gettingStarted},
  { rank:0, userId:'d19', username:'HarshVardhan',       avatar:'avatar_7',  isGuest:false, level:2,  playerRank:'bronze', xp:310,  maxWinStreak:1,  winStreak:0,  survivalWins:0,  totalWins:12,  totalGames:48,  winRate:25, badge:B.gettingStarted},
  { rank:0, userId:'d20', username:'ShreyaTiwari',       avatar:'avatar_8',  isGuest:false, level:1,  playerRank:'bronze', xp:180,  maxWinStreak:1,  winStreak:0,  survivalWins:0,  totalWins:8,   totalGames:39,  winRate:21, badge:B.gettingStarted},
];

function mergeWithDummy(real: LeaderEntry[], sortKey: (e: LeaderEntry) => number): LeaderEntry[] {
  const realNames = new Set(real.map(r => r.username.toLowerCase()));
  const filtered = DUMMY_PLAYERS.filter(d => !realNames.has(d.username.toLowerCase()));
  return [...real, ...filtered]
    .sort((a, b) => sortKey(b) - sortKey(a))
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

export function LeaderboardPage() {
  const [leaders, setLeaders] = useState<LeaderEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [category, setCategory] = useState<Category>('xp');

  useEffect(() => {
    setIsLoading(true);
    progressionApi.leaderboard(category)
      .then(r => {
        const real: LeaderEntry[] = r.data.leaderboard;
        const sortKey =
          category === 'streak'   ? (e: LeaderEntry) => e.maxWinStreak :
          category === 'survival' ? (e: LeaderEntry) => e.survivalWins :
                                    (e: LeaderEntry) => e.xp;
        setLeaders(mergeWithDummy(real, sortKey));
      })
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
