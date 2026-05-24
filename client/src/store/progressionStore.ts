import { create } from 'zustand';
import { on } from '../services/socket';
import { progressionApi } from '../services/api';
import { notify } from '../services/notify';
import { PlayerBadge } from '../types';

const RARITY_ORDER: Record<string, number> = { legendary: 4, epic: 3, rare: 2, common: 1 };

function pickHigher(a: PlayerBadge | null | undefined, b: PlayerBadge | null | undefined): PlayerBadge | null {
  if (!a && !b) return null;
  if (!a) return b!;
  if (!b) return a;
  return RARITY_ORDER[a.rarity] >= RARITY_ORDER[b.rarity] ? a : b;
}

export const RANK_CONFIG: Record<string, { label: string; color: string; icon: string; glow: string }> = {
  bronze:   { label: 'Bronze',   color: '#cd7f32', icon: '🥉', glow: 'rgba(205,127,50,0.35)'  },
  silver:   { label: 'Silver',   color: '#c0c0c0', icon: '🥈', glow: 'rgba(192,192,192,0.35)' },
  gold:     { label: 'Gold',     color: '#ffd700', icon: '🥇', glow: 'rgba(255,215,0,0.35)'   },
  platinum: { label: 'Platinum', color: '#e5e4e2', icon: '💎', glow: 'rgba(229,228,226,0.35)' },
  diamond:  { label: 'Diamond',  color: '#b9f2ff', icon: '💠', glow: 'rgba(185,242,255,0.35)' },
  master:   { label: 'Master',   color: '#ff6b35', icon: '👑', glow: 'rgba(255,107,53,0.45)'  },
};

interface ProgressionState {
  progress: any | null;
  loaded: boolean;
  highestBadge: PlayerBadge | null;
  recentXpGains: Array<{ amount: number; id: number }>;
  pendingAchievements: any[];

  load: () => Promise<void>;
  claimDaily: () => Promise<any>;
  luckySpin: () => Promise<any>;
  subscribe: () => () => void;
  dismissAchievement: (idx: number) => void;
}

let xpGainId = 0;

export const useProgressionStore = create<ProgressionState>((set, get) => ({
  progress: null,
  loaded: false,
  highestBadge: null,
  recentXpGains: [],
  pendingAchievements: [],

  load: async () => {
    try {
      const r = await progressionApi.get();
      set({
        progress: r.data.progress,
        loaded: true,
        highestBadge: r.data.progress?.highestBadge ?? null,
      });
    } catch {
      set({ loaded: true });
    }
  },

  claimDaily: async () => {
    const r = await progressionApi.daily();
    set({ progress: r.data.progress });
    return r.data;
  },

  luckySpin: async () => {
    const r = await progressionApi.luckySpin();
    set({ progress: r.data.progress });
    return r.data;
  },

  dismissAchievement: (idx) => {
    set(s => ({ pendingAchievements: s.pendingAchievements.filter((_, i) => i !== idx) }));
  },

  subscribe: () => {
    const unsub = on('progression:update', (data: any) => {
      set(s => {
        // Pick highest badge from new achievements vs current
        let newHighest: PlayerBadge | null = s.highestBadge;
        for (const ach of (data.newAchievements ?? [])) {
          const candidate: PlayerBadge = { emoji: ach.emoji, name: ach.name, rarity: ach.rarity };
          newHighest = pickHigher(newHighest, candidate);
        }
        return {
          progress: s.progress ? {
            ...s.progress,
            xp:        data.newXp,
            level:     data.newLevel,
            rank:      data.newRank,
            xpProgress: data.xpProgress,
            xpNeeded:   data.xpNeeded,
            winStreak:  data.winStreak,
          } : s.progress,
          highestBadge: newHighest,
          recentXpGains: [
            ...s.recentXpGains,
            { amount: data.xpGained, id: ++xpGainId },
          ].slice(-5),
          pendingAchievements: [
            ...s.pendingAchievements,
            ...(data.newAchievements ?? []),
          ],
        };
      });

      if (data.leveled) {
        notify.success(`Level Up! You reached Level ${data.newLevel} 🎉`);
      }
      if (data.rankedUp) {
        const rc = RANK_CONFIG[data.newRank];
        notify.success(`Rank Up! You are now ${rc?.icon ?? ''} ${rc?.label ?? data.newRank}!`);
      }
    });
    return unsub;
  },
}));
