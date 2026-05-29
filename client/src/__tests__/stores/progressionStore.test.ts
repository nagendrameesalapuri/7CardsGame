import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  progressionApi: {
    get: vi.fn(),
    daily: vi.fn(),
    luckySpin: vi.fn(),
  },
}));

vi.mock('../../services/socket', () => ({
  on: vi.fn(() => vi.fn()),
  connectSocket: vi.fn(),
  disconnectSocket: vi.fn(),
}));

vi.mock('../../services/notify', () => ({
  notify: { success: vi.fn(), error: vi.fn(), loading: vi.fn() },
}));

import { useProgressionStore, RANK_CONFIG } from '../../store/progressionStore';
import { progressionApi } from '../../services/api';
import { on as socketOn } from '../../services/socket';
import { notify } from '../../services/notify';

const resetState = {
  progress: null,
  loaded: false,
  highestBadge: null,
  recentXpGains: [],
  pendingAchievements: [],
};

describe('progressionStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProgressionStore.setState(resetState);
  });

  // ── RANK_CONFIG ─────────────────────────────────────────────────────────────

  describe('RANK_CONFIG', () => {
    const expectedRanks = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master'];

    it('defines all 6 ranks', () => {
      expectedRanks.forEach(rank => {
        expect(RANK_CONFIG[rank]).toBeDefined();
      });
    });

    it('each rank has label, color, icon, and glow', () => {
      expectedRanks.forEach(rank => {
        const rc = RANK_CONFIG[rank];
        expect(rc.label).toBeTruthy();
        expect(rc.color).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(rc.icon).toBeTruthy();
        expect(rc.glow).toBeTruthy();
      });
    });

    it('master rank has the highest visual weight (orange/red glow)', () => {
      expect(RANK_CONFIG.master.color).toBe('#ff6b35');
    });
  });

  // ── load ────────────────────────────────────────────────────────────────────

  describe('load', () => {
    it('sets progress and loaded on success', async () => {
      const mockProgress = {
        xp: 1000, level: 8, rank: 'gold', winStreak: 5,
        highestBadge: { emoji: '🏆', name: 'Champion', rarity: 'rare' },
      };
      (progressionApi.get as any).mockResolvedValue({ data: { progress: mockProgress } });

      const { result } = renderHook(() => useProgressionStore());
      await act(async () => { await result.current.load(); });

      expect(result.current.progress).toEqual(mockProgress);
      expect(result.current.loaded).toBe(true);
      expect(result.current.highestBadge).toEqual(mockProgress.highestBadge);
    });

    it('sets loaded=true even on API failure', async () => {
      (progressionApi.get as any).mockRejectedValue(new Error('500 Internal Server Error'));

      const { result } = renderHook(() => useProgressionStore());
      await act(async () => { await result.current.load(); });

      expect(result.current.loaded).toBe(true);
      expect(result.current.progress).toBeNull();
    });
  });

  // ── claimDaily ──────────────────────────────────────────────────────────────

  describe('claimDaily', () => {
    it('updates progress state and returns reward data', async () => {
      const updatedProgress = { xp: 600, level: 6, rank: 'silver' };
      const reward = { points: 75, emoji: '🔥' };
      (progressionApi.daily as any).mockResolvedValue({
        data: { progress: updatedProgress, reward },
      });
      useProgressionStore.setState({ progress: { xp: 500 } as any });

      const { result } = renderHook(() => useProgressionStore());
      let returned: any;
      await act(async () => { returned = await result.current.claimDaily(); });

      expect(result.current.progress).toEqual(updatedProgress);
      expect(returned.reward).toEqual(reward);
    });
  });

  // ── dismissAchievement ──────────────────────────────────────────────────────

  describe('dismissAchievement', () => {
    it('removes achievement at the given index', () => {
      useProgressionStore.setState({
        pendingAchievements: [{ id: 'ach1' }, { id: 'ach2' }, { id: 'ach3' }],
      } as any);

      const { result } = renderHook(() => useProgressionStore());
      act(() => { result.current.dismissAchievement(1); });

      expect(result.current.pendingAchievements).toHaveLength(2);
      expect(result.current.pendingAchievements[0]).toEqual({ id: 'ach1' });
      expect(result.current.pendingAchievements[1]).toEqual({ id: 'ach3' });
    });

    it('handles dismissing the first item', () => {
      useProgressionStore.setState({
        pendingAchievements: [{ id: 'a' }, { id: 'b' }],
      } as any);

      const { result } = renderHook(() => useProgressionStore());
      act(() => { result.current.dismissAchievement(0); });

      expect(result.current.pendingAchievements).toHaveLength(1);
      expect(result.current.pendingAchievements[0]).toEqual({ id: 'b' });
    });
  });

  // ── subscribe (socket event handler) ───────────────────────────────────────

  describe('subscribe', () => {
    it('registers a progression:update socket listener', () => {
      const { result } = renderHook(() => useProgressionStore());
      result.current.subscribe();

      expect(socketOn).toHaveBeenCalledWith('progression:update', expect.any(Function));
    });

    it('returns an unsubscribe function', () => {
      const { result } = renderHook(() => useProgressionStore());
      const unsub = result.current.subscribe();
      expect(typeof unsub).toBe('function');
    });

    it('shows level-up toast when handler fires with leveled=true', () => {
      let capturedHandler: Function | null = null;
      (socketOn as any).mockImplementation((_event: string, handler: Function) => {
        capturedHandler = handler;
        return vi.fn();
      });

      useProgressionStore.setState({
        progress: { xp: 500, level: 4, rank: 'silver', winStreak: 2 } as any,
        recentXpGains: [],
        pendingAchievements: [],
        highestBadge: null,
      });

      const { result } = renderHook(() => useProgressionStore());
      result.current.subscribe();

      act(() => {
        capturedHandler!({
          newXp: 600,
          newLevel: 5,
          newRank: 'silver',
          xpProgress: 100,
          xpNeeded: 500,
          xpGained: 100,
          winStreak: 2,
          leveled: true,
          rankedUp: false,
          newAchievements: [],
        });
      });

      expect(notify.success).toHaveBeenCalledWith(expect.stringContaining('Level Up'));
      expect(result.current.progress?.level).toBe(5);
    });

    it('shows rank-up toast when handler fires with rankedUp=true', () => {
      let capturedHandler: Function | null = null;
      (socketOn as any).mockImplementation((_event: string, handler: Function) => {
        capturedHandler = handler;
        return vi.fn();
      });

      useProgressionStore.setState({
        progress: { xp: 3000, level: 20, rank: 'silver', winStreak: 10 } as any,
        recentXpGains: [],
        pendingAchievements: [],
        highestBadge: null,
      });

      const { result } = renderHook(() => useProgressionStore());
      result.current.subscribe();

      act(() => {
        capturedHandler!({
          newXp: 3100,
          newLevel: 20,
          newRank: 'gold',
          xpProgress: 100,
          xpNeeded: 500,
          xpGained: 100,
          winStreak: 10,
          leveled: false,
          rankedUp: true,
          newAchievements: [],
        });
      });

      expect(notify.success).toHaveBeenCalledWith(expect.stringContaining('Rank Up'));
    });

    it('appends new achievements to pendingAchievements', () => {
      let capturedHandler: Function | null = null;
      (socketOn as any).mockImplementation((_event: string, handler: Function) => {
        capturedHandler = handler;
        return vi.fn();
      });

      useProgressionStore.setState({
        progress: { xp: 100, level: 1, rank: 'bronze', winStreak: 1 } as any,
        recentXpGains: [],
        pendingAchievements: [],
        highestBadge: null,
      });

      const { result } = renderHook(() => useProgressionStore());
      result.current.subscribe();

      const newAch = { id: 'first_win', name: 'First Blood', emoji: '🩸', rarity: 'common' };
      act(() => {
        capturedHandler!({
          newXp: 150,
          newLevel: 1,
          newRank: 'bronze',
          xpProgress: 50,
          xpNeeded: 200,
          xpGained: 50,
          winStreak: 1,
          leveled: false,
          rankedUp: false,
          newAchievements: [newAch],
        });
      });

      expect(result.current.pendingAchievements).toHaveLength(1);
      expect(result.current.pendingAchievements[0]).toEqual(newAch);
    });
  });
});
