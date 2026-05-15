import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { getOrCreateProgress } from '../models/PlayerProgress';
import { PlayerProgress } from '../models/PlayerProgress';
import { User } from '../models/User';
import {
  levelFromXp, rankFromLevel, xpForLevel, xpToNextLevel,
  DAILY_REWARDS, spinLucky, ACHIEVEMENTS, getAchievement,
  isSameDayIST, isDayBeforeIST, RANK_CONFIG,
} from '../utils/progression';
import { computeAndCacheBadge } from '../utils/badgeCache';

const router = Router();

function canClaimDaily(lastClaim: Date | null): boolean {
  if (!lastClaim) return true;
  return !isSameDayIST(lastClaim, new Date());
}

function canSpin(lastSpin: Date | null): boolean {
  if (!lastSpin) return true;
  return !isSameDayIST(lastSpin, new Date());
}

function formatProgress(p: any) {
  const lvl = p.level as number;
  return {
    xp:          p.xp,
    level:       lvl,
    rank:        p.rank,
    seasonXp:    p.seasonXp ?? 0,
    xpProgress:  p.xp - xpForLevel(lvl),
    xpNeeded:    xpToNextLevel(lvl),
    xpForCurrentLevel: xpForLevel(lvl),
    xpForNextLevel:    xpForLevel(lvl + 1),
    winStreak:     p.winStreak,
    maxWinStreak:  p.maxWinStreak,
    loginStreak:   p.loginStreak,
    maxLoginStreak:p.maxLoginStreak,
    achievements:  p.achievements,
    highestBadge:  computeAndCacheBadge(p.userId, p.achievements.map((a: any) => a.id)),
    lastDailyReward: p.lastDailyReward,
    dailyRewardDay:  p.dailyRewardDay,
    lastLuckySpin:   p.lastLuckySpin,
    canClaimDaily:   canClaimDaily(p.lastDailyReward),
    canSpin:         canSpin(p.lastLuckySpin),
    totalWins:       p.totalWins,
    totalGames:      p.totalGames,
    survivalWins:    p.survivalWins ?? 0,
    rankConfig:      RANK_CONFIG,
  };
}

// GET /api/progression
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const p = await getOrCreateProgress(req.user!.id);
    res.json({ progress: formatProgress(p) });
  } catch {
    res.status(500).json({ error: 'Failed to load progression' });
  }
});

// POST /api/progression/daily — claim daily login reward
router.post('/daily', requireAuth, async (req: Request, res: Response) => {
  try {
    const p = await getOrCreateProgress(req.user!.id);

    if (!canClaimDaily(p.lastDailyReward)) {
      return res.status(400).json({ error: 'Already claimed today' });
    }

    const now = new Date();
    const isStreak = p.lastDailyReward && isDayBeforeIST(p.lastDailyReward, now);
    const newDay = isStreak ? (p.dailyRewardDay % 7) + 1 : 1;
    const newLoginStreak = isStreak ? p.loginStreak + 1 : 1;
    const reward = DAILY_REWARDS[newDay - 1];

    // Credit wallet (points → rupees)
    await User.findByIdAndUpdate(req.user!.id, {
      $inc: { walletBalance: reward.points / 100 },
    });

    // XP + streak achievements
    const newXp    = p.xp + reward.xp;
    const newLevel = levelFromXp(newXp);
    const newRank  = rankFromLevel(newLevel);
    const leveled  = newLevel > p.level;
    const rankedUp = newRank !== p.rank;

    const newAchievements: string[] = [];
    const has = (id: string) => p.achievements.some(a => a.id === id);
    if (newLoginStreak >= 7  && !has('login_streak_7'))  { newAchievements.push('login_streak_7');  p.achievements.push({ id: 'login_streak_7',  unlockedAt: now }); }
    if (newLoginStreak >= 30 && !has('login_streak_30')) { newAchievements.push('login_streak_30'); p.achievements.push({ id: 'login_streak_30', unlockedAt: now }); }

    // Rank-up achievements
    if (newRank === 'silver'   && p.rank !== 'silver'   && !has('rank_silver'))   { newAchievements.push('rank_silver');   p.achievements.push({ id: 'rank_silver',   unlockedAt: now }); }
    if (newRank === 'gold'     && p.rank !== 'gold'     && !has('rank_gold'))     { newAchievements.push('rank_gold');     p.achievements.push({ id: 'rank_gold',     unlockedAt: now }); }
    if (newRank === 'platinum' && p.rank !== 'platinum' && !has('rank_platinum')) { newAchievements.push('rank_platinum'); p.achievements.push({ id: 'rank_platinum', unlockedAt: now }); }
    if (newRank === 'diamond'  && p.rank !== 'diamond'  && !has('rank_diamond'))  { newAchievements.push('rank_diamond');  p.achievements.push({ id: 'rank_diamond',  unlockedAt: now }); }
    if (newRank === 'master'   && p.rank !== 'master'   && !has('rank_master'))   { newAchievements.push('rank_master');   p.achievements.push({ id: 'rank_master',   unlockedAt: now }); }

    // Award achievement wallet bonuses
    let bonusPoints = 0;
    for (const id of newAchievements) {
      const def = getAchievement(id);
      if (def && def.pointsReward > 0) bonusPoints += def.pointsReward;
    }
    if (bonusPoints > 0) await User.findByIdAndUpdate(req.user!.id, { $inc: { walletBalance: bonusPoints / 100 } });

    p.xp            = newXp;
    p.level         = newLevel;
    p.rank          = newRank;
    p.seasonXp      = (p.seasonXp ?? 0) + reward.xp;
    p.loginStreak   = newLoginStreak;
    p.maxLoginStreak = Math.max(p.maxLoginStreak, newLoginStreak);
    p.lastLoginDate  = now;
    p.lastDailyReward = now;
    p.dailyRewardDay  = newDay;
    await p.save();

    res.json({
      reward, newDay, loginStreak: newLoginStreak,
      leveled, rankedUp, newLevel, newRank,
      newAchievements: newAchievements.map(id => getAchievement(id)).filter(Boolean),
      progress: formatProgress(p),
    });
  } catch {
    res.status(500).json({ error: 'Failed to claim daily reward' });
  }
});

// POST /api/progression/lucky-spin
router.post('/lucky-spin', requireAuth, async (req: Request, res: Response) => {
  try {
    const p = await getOrCreateProgress(req.user!.id);

    if (!canSpin(p.lastLuckySpin)) {
      return res.status(400).json({ error: 'Already spun today' });
    }

    const outcome = spinLucky();

    if (outcome.points > 0) {
      await User.findByIdAndUpdate(req.user!.id, { $inc: { walletBalance: outcome.points / 100 } });
    }

    if (outcome.xp > 0) {
      const newXp = p.xp + outcome.xp;
      p.xp      = newXp;
      p.level   = levelFromXp(newXp);
      p.rank    = rankFromLevel(p.level);
      p.seasonXp = (p.seasonXp ?? 0) + outcome.xp;
    }

    p.lastLuckySpin = new Date();
    await p.save();

    res.json({ outcome, progress: formatProgress(p) });
  } catch {
    res.status(500).json({ error: 'Failed to spin' });
  }
});

// GET /api/progression/leaderboard?category=xp|streak|survival
router.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    const category = (req.query.category as string) ?? 'xp';
    let sortField: Record<string, -1> = { xp: -1 };
    if (category === 'streak')   sortField = { maxWinStreak: -1 };
    if (category === 'survival') sortField = { survivalWins: -1 };

    const records = await PlayerProgress.find({})
      .sort(sortField as any)
      .limit(50)
      .select('userId level rank xp maxWinStreak survivalWins totalWins totalGames winStreak achievements')
      .lean();

    // Enrich with usernames
    const userIds = records.map(r => r.userId);
    const users = await User.find({ _id: { $in: userIds } }).select('username avatar isGuest').lean();
    const userMap = new Map(users.map(u => [String(u._id), u]));

    const leaderboard = records.map((r, i) => {
      const u = userMap.get(r.userId);
      const badge = computeAndCacheBadge(r.userId, ((r as any).achievements ?? []).map((a: any) => a.id));
      return {
        rank: i + 1,
        userId:       r.userId,
        username:     u?.username ?? 'Unknown',
        avatar:       (u as any)?.avatar ?? 'avatar_1',
        isGuest:      u?.isGuest ?? false,
        level:        r.level,
        playerRank:   r.rank,
        xp:           r.xp,
        maxWinStreak: r.maxWinStreak,
        winStreak:    r.winStreak,
        survivalWins: r.survivalWins ?? 0,
        totalWins:    r.totalWins,
        totalGames:   r.totalGames,
        winRate:      r.totalGames > 0 ? Math.round((r.totalWins / r.totalGames) * 100) : 0,
        badge:        badge ?? null,
      };
    });

    res.json({ leaderboard, category });
  } catch {
    res.status(500).json({ error: 'Failed to load leaderboard' });
  }
});

// GET /api/progression/achievements — all achievement definitions
router.get('/achievements', async (_req: Request, res: Response) => {
  res.json({ achievements: ACHIEVEMENTS });
});

export default router;
