/**
 * Weekly Challenge System
 *
 * 3 challenges reset every Monday at 00:00 IST.
 * Completing each challenge awards AI points.
 * All challenges are based on normal gameplay — no grind required.
 */

export interface WeeklyChallenge {
  id: string;
  title: string;
  description: string;
  goal: number;        // target count
  pointsReward: number;
  xpReward: number;
  icon: string;
}

export const WEEKLY_CHALLENGES: WeeklyChallenge[] = [
  {
    id: 'play_5_games',
    title: 'Active Player',
    description: 'Play 5 games (any mode)',
    goal: 5,
    pointsReward: 100,
    xpReward: 50,
    icon: '🎮',
  },
  {
    id: 'win_3_games',
    title: 'Winning Streak',
    description: 'Win 3 games (any mode)',
    goal: 3,
    pointsReward: 200,
    xpReward: 100,
    icon: '🏆',
  },
  {
    id: 'show_low_pts',
    title: 'Sharp SHOW',
    description: 'Call SHOW with ≤3 pts in hand',
    goal: 1,
    pointsReward: 150,
    xpReward: 75,
    icon: '⚡',
  },
  {
    id: 'play_wager',
    title: 'High Stakes',
    description: 'Play 3 wager games',
    goal: 3,
    pointsReward: 175,
    xpReward: 80,
    icon: '💰',
  },
  {
    id: 'beat_survival',
    title: 'Arena Fighter',
    description: 'Clear any AI Championship stage',
    goal: 1,
    pointsReward: 250,
    xpReward: 150,
    icon: '🛡️',
  },
  {
    id: 'daily_login_3',
    title: 'Consistent',
    description: 'Log in 3 days this week',
    goal: 3,
    pointsReward: 100,
    xpReward: 50,
    icon: '📅',
  },
];

// Returns current ISO week string e.g. "2026-W22" in IST
export function currentWeekIST(): string {
  const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000); // UTC+5:30
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((now.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

// Pick 3 stable challenges for the current week (deterministic from week string)
export function challengesForWeek(week: string): WeeklyChallenge[] {
  // Use week string as seed to always return the same 3 for a given week
  let hash = 0;
  for (const ch of week) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff;
  const indices: number[] = [];
  let seed = Math.abs(hash);
  while (indices.length < 3) {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    const idx = Math.abs(seed) % WEEKLY_CHALLENGES.length;
    if (!indices.includes(idx)) indices.push(idx);
  }
  return indices.map(i => WEEKLY_CHALLENGES[i]);
}

// Reset weekly progress if week changed
export function resetIfNewWeek(p: any): boolean {
  const thisWeek = currentWeekIST();
  if (p.weeklyChallengeWeek !== thisWeek) {
    p.weeklyChallengeWeek = thisWeek;
    p.weeklyProgress  = new Map();
    p.weeklyCompleted = [];
    return true;
  }
  return false;
}

// Increment a challenge counter and return any newly completed challenge
export function incrementChallenge(
  p: any,
  challengeId: string,
  by = 1,
): WeeklyChallenge | null {
  resetIfNewWeek(p);
  const week     = currentWeekIST();
  const challenges = challengesForWeek(week);
  const challenge  = challenges.find(c => c.id === challengeId);
  if (!challenge) return null;
  if ((p.weeklyCompleted ?? []).includes(challengeId)) return null; // already done

  if (!p.weeklyProgress) p.weeklyProgress = new Map();
  const prev = p.weeklyProgress.get(challengeId) ?? 0;
  const next = prev + by;
  p.weeklyProgress.set(challengeId, next);

  if (next >= challenge.goal) {
    if (!p.weeklyCompleted) p.weeklyCompleted = [];
    p.weeklyCompleted.push(challengeId);
    return challenge; // newly completed
  }
  return null;
}
