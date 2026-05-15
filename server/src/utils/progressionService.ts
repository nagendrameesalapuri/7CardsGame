/**
 * progressionService — awards XP, checks achievements, emits socket events.
 * Called from gameHandler and survivalHandler after match end.
 */

import { Server } from 'socket.io';
import { getOrCreateProgress } from '../models/PlayerProgress';
import { User } from '../models/User';
import {
  levelFromXp, rankFromLevel, xpForLevel, xpToNextLevel,
  ACHIEVEMENTS, getAchievement, botXpMultiplier, isSameDayIST,
} from './progression';
import { computeAndCacheBadge } from './badgeCache';

export interface XpEvent {
  userId: string;
  socketId?: string;
  baseXp: number;
  isBot: boolean;
  won: boolean;
  isSurvivalStage?: boolean;
  isSurvivalBoss?: boolean;
  isSurvivalWin?: boolean;
  stageClearedNum?: number;
}

// Core function: award XP, update streak, check achievements, emit events
export async function awardXp(io: Server, event: XpEvent): Promise<void> {
  try {
    const p = await getOrCreateProgress(event.userId);

    // Reset bot-game hourly counter if hour has passed
    const now = new Date();
    if (!p.botGameHourReset || now.getTime() - p.botGameHourReset.getTime() > 3600000) {
      p.botGamesThisHour = 0;
      p.botGameHourReset = now;
    }

    // Anti-farming multiplier
    let multiplier = 1.0;
    if (event.isBot) {
      multiplier = botXpMultiplier(p.botGamesThisHour);
      p.botGamesThisHour += 1;
    }

    // XP to award
    const xpGained = Math.max(1, Math.round(event.baseXp * multiplier));
    const oldXp    = p.xp;
    const oldLevel = p.level;
    const oldRank  = p.rank;

    p.xp       += xpGained;
    p.seasonXp  = (p.seasonXp ?? 0) + xpGained;
    p.level     = levelFromXp(p.xp);
    p.rank      = rankFromLevel(p.level);

    // Win/loss streak
    if (event.won) {
      p.winStreak += 1;
      p.maxWinStreak = Math.max(p.maxWinStreak, p.winStreak);
      p.totalWins += 1;
    } else {
      p.winStreak = 0;
    }
    p.totalGames += 1;
    if (event.isSurvivalWin) p.survivalWins += 1;

    // Track opponent type for anti-repeat
    if (event.isBot) {
      p.recentOpponentTypes = [...(p.recentOpponentTypes ?? []).slice(-9), 'bot'];
    }

    // Achievements to unlock
    const newAchievements: string[] = [];
    const has = (id: string) => p.achievements.some(a => a.id === id);
    const unlock = (id: string) => {
      if (!has(id)) { newAchievements.push(id); p.achievements.push({ id, unlockedAt: new Date() }); }
    };

    if (event.won && p.totalWins === 1) unlock('first_win');
    if (p.totalGames >= 10)  unlock('play_10');
    if (p.totalGames >= 50)  unlock('play_50');
    if (p.totalGames >= 100) unlock('play_100');
    if (p.totalWins >= 50)   unlock('win_50');
    if (p.winStreak >= 3)    unlock('win_streak_3');
    if (p.winStreak >= 5)    unlock('win_streak_5');
    if (p.winStreak >= 10)   unlock('win_streak_10');
    if (event.isSurvivalStage && (event.stageClearedNum ?? 0) >= 1) unlock('survival_stage1');
    if (event.isSurvivalStage && (event.stageClearedNum ?? 0) >= 3) unlock('survival_stage3');
    if (event.isSurvivalWin) unlock('survival_win');
    if (event.isSurvivalBoss) unlock('boss_slayer');
    if (p.rank === 'silver'   && oldRank !== 'silver')   unlock('rank_silver');
    if (p.rank === 'gold'     && oldRank !== 'gold')     unlock('rank_gold');
    if (p.rank === 'platinum' && oldRank !== 'platinum') unlock('rank_platinum');
    if (p.rank === 'diamond'  && oldRank !== 'diamond')  unlock('rank_diamond');
    if (p.rank === 'master'   && oldRank !== 'master')   unlock('rank_master');

    // Award wallet points for achievement rewards
    if (newAchievements.length > 0) {
      let bonusPoints = 0;
      for (const id of newAchievements) {
        const def = getAchievement(id);
        if (def && def.pointsReward > 0) bonusPoints += def.pointsReward;
      }
      if (bonusPoints > 0) {
        await User.findByIdAndUpdate(event.userId, {
          $inc: { walletBalance: bonusPoints / 100 },
        });
      }
    }

    await p.save();

    // Keep badge cache fresh when new achievements unlock
    if (newAchievements.length > 0) {
      computeAndCacheBadge(event.userId, p.achievements.map(a => a.id));
    }

    // Emit progression update to this user's socket room
    const userRoom = `user:${event.userId}`;
    const leveled  = p.level > oldLevel;
    const rankedUp = p.rank  !== oldRank;

    io.to(userRoom).emit('progression:update', {
      xpGained,
      multiplier,
      newXp: p.xp,
      newLevel: p.level,
      newRank: p.rank,
      leveled,
      rankedUp,
      winStreak: p.winStreak,
      xpProgress: p.xp - xpForLevel(p.level),
      xpNeeded: xpToNextLevel(p.level),
      newAchievements: newAchievements.map(id => getAchievement(id)).filter(Boolean),
    });

  } catch (err) {
    console.error('[progressionService] awardXp error:', err);
  }
}
