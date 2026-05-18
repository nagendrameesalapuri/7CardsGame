/**
 * Notification Triggers — event-driven, personalized, non-blocking.
 *
 * All exported functions are fire-and-forget wrappers around sendNotification.
 * They MUST NOT throw or block the calling game / socket handler.
 */

import { sendNotification } from './fcmService';

// ── Survival / Tournament ──────────────────────────────────────────────────────

export function notifySurvivalStageComplete(
  userId: string,
  stage: number,
  nextStage: number | null,
  pointsEarned: number
) {
  const stageNames = ['', 'Warmup Duel', 'Tactical Pressure', 'Mind Games', 'Survival Clash', 'Final Arena'];

  if (nextStage === 5) {
    sendNotification({
      userId,
      title: '👑 Boss Arena Unlocked!',
      message: 'The Final Arena awaits. Face the Apex Trinity — Boss + Smart + Aggressive AI.',
      category: 'boss_arena',
      type: 'warning',
      actionUrl: '/survival',
    }).catch(() => {});
    return;
  }

  if (nextStage && nextStage <= 5) {
    sendNotification({
      userId,
      title: `⚔ Stage ${nextStage} Unlocked`,
      message: `${stageNames[nextStage]} is ready. You earned ${pointsEarned} pts from Stage ${stage}.`,
      category: 'tournament',
      type: 'success',
      actionUrl: '/survival',
    }).catch(() => {});
  }
}

export function notifySurvivalWon(userId: string, tier: string, totalPoints: number) {
  sendNotification({
    userId,
    title: '🏆 Tournament Champion!',
    message: `You conquered all 5 stages of the ${tier} tier! Total: ${totalPoints} pts earned.`,
    category: 'tournament',
    type: 'success',
    actionUrl: '/survival',
    skipThrottle: true,
  }).catch(() => {});
}

export function notifySurvivalLost(userId: string, stage: number, botName: string) {
  const retryMessages: Record<number, string> = {
    1: `${botName} held the line. Adapt your strategy and try again.`,
    2: `${botName} outplayed you. A smarter approach awaits.`,
    3: `${botName} bent your mind. Ready for revenge?`,
    4: `The dual-AI alliance broke you. Comeback starts now.`,
    5: `The Apex Trinity stood firm. You were close — try again.`,
  };

  sendNotification({
    userId,
    title: `🎯 Defeated at Stage ${stage}`,
    message: retryMessages[stage] ?? 'The Arena tests you. Return and climb again.',
    category: 'tournament',
    type: 'info',
    actionUrl: '/survival',
  }).catch(() => {});
}

export function notifyBossArenaUnlocked(userId: string) {
  sendNotification({
    userId,
    title: '💀 Boss Arena is LIVE',
    message: '🔥 Boss AI awaits your challenge. Enter the Final Arena now.',
    category: 'boss_arena',
    type: 'warning',
    actionUrl: '/survival',
    skipThrottle: true,
  }).catch(() => {});
}

// ── Survival Streak ────────────────────────────────────────────────────────────

export function notifyWinStreak(userId: string, streak: number) {
  if (streak < 3) return;

  const milestones: Record<number, { title: string; msg: string }> = {
    3:  { title: '🔥 3-Win Streak!',  msg: 'You are on fire in the Arena. Keep climbing!' },
    5:  { title: '⚡ 5-Win Streak!',  msg: 'Unstoppable form. Boss Arena is watching.' },
    7:  { title: '👑 7-Win Streak!',  msg: 'Legendary run. Master the SHOW.' },
    10: { title: '💎 10-Win Streak!', msg: 'Arena legend. No one can stop your momentum.' },
  };

  const hit = milestones[streak];
  if (!hit) return;

  sendNotification({
    userId,
    title: hit.title,
    message: hit.msg,
    category: 'survival_streak',
    type: 'success',
    actionUrl: '/lobby',
    skipThrottle: true,
  }).catch(() => {});
}

// ── Rewards ────────────────────────────────────────────────────────────────────

export function notifyRewardApproved(userId: string, amount: number, description: string) {
  sendNotification({
    userId,
    title: '✅ Reward Approved',
    message: `${description} — ₹${amount} has been approved. Check your Voucher Details.`,
    category: 'rewards',
    type: 'success',
    actionUrl: '/wallet',
    skipThrottle: true,
  }).catch(() => {});
}

export function notifyRewardDelivered(userId: string, description: string) {
  sendNotification({
    userId,
    title: '🎁 Reward Delivered',
    message: `Your reward "${description}" has been sent. Check Voucher Details tab.`,
    category: 'rewards',
    type: 'success',
    actionUrl: '/wallet',
    skipThrottle: true,
  }).catch(() => {});
}

export function notifyPointsEarned(userId: string, points: number, reason: string) {
  sendNotification({
    userId,
    title: `💳 +${points} Points Earned`,
    message: reason,
    category: 'rewards',
    type: 'success',
    actionUrl: '/wallet',
  }).catch(() => {});
}

// ── Multiplayer ────────────────────────────────────────────────────────────────

export function notifyRoomInvite(userId: string, inviterName: string, roomCode: string) {
  sendNotification({
    userId,
    title: '⚔ Arena Invitation',
    message: `${inviterName} invited you to a private Arena room. Code: ${roomCode}`,
    category: 'multiplayer',
    type: 'info',
    actionUrl: `/lobby`,
    skipThrottle: true,
    data: { roomCode },
  }).catch(() => {});
}

export function notifyGameStarting(userId: string, roomName: string) {
  sendNotification({
    userId,
    title: '🏟 Game Starting!',
    message: `"${roomName}" is about to begin. Return to the Arena now.`,
    category: 'multiplayer',
    type: 'warning',
    actionUrl: '/game',
    skipThrottle: true,
  }).catch(() => {});
}

// ── Daily Missions ─────────────────────────────────────────────────────────────

export function notifyDailyMissions(userIds: string[]) {
  const missions = [
    'New daily arena missions are available.',
    '⚡ Complete today\'s challenge for bonus XP.',
    '🧠 Smart AI challenge is live today.',
  ];
  const pick = missions[Math.floor(Math.random() * missions.length)];

  userIds.forEach(uid => {
    sendNotification({
      userId: uid,
      title: '🎯 Daily Arena Missions',
      message: pick,
      category: 'daily_missions',
      type: 'info',
      actionUrl: '/lobby',
    }).catch(() => {});
  });
}

// ── Seasonal Events ────────────────────────────────────────────────────────────

export function notifySeasonalEvent(userIds: string[], title: string, message: string) {
  userIds.forEach(uid => {
    sendNotification({
      userId: uid,
      title,
      message,
      category: 'events',
      type: 'success',
      actionUrl: '/survival',
    }).catch(() => {});
  });
}
