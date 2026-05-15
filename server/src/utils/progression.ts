export type Rank =
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "diamond"
  | "master";
export type PlayerStyle =
  | "aggressive"
  | "defensive"
  | "combo_hoarder"
  | "fast_show"
  | "trap"
  | "hold_7s"
  | "unknown";

export const RANK_CONFIG: Record<
  Rank,
  { label: string; color: string; minLevel: number; icon: string; glow: string }
> = {
  bronze: {
    label: "Bronze",
    color: "#cd7f32",
    glow: "rgba(205,127,50,0.3)",
    minLevel: 1,
    icon: "🥉",
  },
  silver: {
    label: "Silver",
    color: "#c0c0c0",
    glow: "rgba(192,192,192,0.3)",
    minLevel: 6,
    icon: "🥈",
  },
  gold: {
    label: "Gold",
    color: "#ffd700",
    glow: "rgba(255,215,0,0.3)",
    minLevel: 16,
    icon: "🥇",
  },
  platinum: {
    label: "Platinum",
    color: "#e5e4e2",
    glow: "rgba(229,228,226,0.3)",
    minLevel: 31,
    icon: "💎",
  },
  diamond: {
    label: "Diamond",
    color: "#b9f2ff",
    glow: "rgba(185,242,255,0.3)",
    minLevel: 51,
    icon: "💠",
  },
  master: {
    label: "Master",
    color: "#ff6b35",
    glow: "rgba(255,107,53,0.4)",
    minLevel: 76,
    icon: "👑",
  },
};

// Total XP needed to reach level N from level 1
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  const n = level - 1;
  return n * 100 + n * (n - 1) * 25;
}

// XP needed to advance from current level to next
export function xpToNextLevel(level: number): number {
  return xpForLevel(level + 1) - xpForLevel(level);
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (level < 100 && xpForLevel(level + 1) <= xp) level++;
  return level;
}

export function rankFromLevel(level: number): Rank {
  if (level >= 76) return "master";
  if (level >= 51) return "diamond";
  if (level >= 31) return "platinum";
  if (level >= 16) return "gold";
  if (level >= 6) return "silver";
  return "bronze";
}

export const XP_REWARDS = {
  WIN_GAME: 40,
  LOSE_GAME: 10,
  WIN_VS_BOT: 15, // conservative bot win reward
  WIN_SURVIVAL_STAGE: 30,
  WIN_SURVIVAL_BOSS: 80,
  COMPLETE_SURVIVAL: 220,
  DAILY_LOGIN: 20,
  STREAK_3_BONUS: 25,
  STREAK_5_BONUS: 45,
  STREAK_10_BONUS: 120,
} as const;

// 7-day daily reward cycle
export const DAILY_REWARDS = [
  { day: 1, points: 50, xp: 20, label: "Welcome Back!", emoji: "👋" },
  { day: 2, points: 75, xp: 25, label: "2-Day Streak", emoji: "🔥" },
  { day: 3, points: 150, xp: 40, label: "3-Day Streak!", emoji: "⚡" },
  { day: 4, points: 100, xp: 30, label: "4-Day Streak", emoji: "💫" },
  { day: 5, points: 125, xp: 35, label: "5-Day Streak", emoji: "🌟" },
  { day: 6, points: 200, xp: 50, label: "6-Day Streak!", emoji: "✨" },
  { day: 7, points: 500, xp: 150, label: "7-Day Champion!", emoji: "🏆" },
] as const;

// Lucky spin outcomes (weight = relative probability)
export const LUCKY_OUTCOMES = [
  {
    weight: 30,
    points: 0,
    xp: 0,
    label: "Better luck next time!",
    emoji: "💨",
  },
  { weight: 25, points: 50, xp: 10, label: "+50 pts", emoji: "⭐" },
  { weight: 20, points: 100, xp: 15, label: "+100 pts", emoji: "💫" },
  { weight: 12, points: 250, xp: 25, label: "+250 pts", emoji: "✨" },
  { weight: 8, points: 500, xp: 50, label: "+500 pts", emoji: "🌟" },
  {
    weight: 4,
    points: 1000,
    xp: 100,
    label: "JACKPOT! +1,000 pts",
    emoji: "🎰",
  },
  { weight: 1, points: 5000, xp: 500, label: "MEGA JACKPOT!", emoji: "💥" },
];

export function spinLucky() {
  const total = LUCKY_OUTCOMES.reduce((s, o) => s + o.weight, 0);
  let rand = Math.random() * total;
  for (const o of LUCKY_OUTCOMES) {
    rand -= o.weight;
    if (rand <= 0) return o;
  }
  return LUCKY_OUTCOMES[0];
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  emoji: string;
  xpReward: number;
  pointsReward: number;
  rarity: "common" | "rare" | "epic" | "legendary";
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: "first_win",
    name: "First Blood",
    description: "Win your first game",
    emoji: "🩸",
    xpReward: 50,
    pointsReward: 100,
    rarity: "common",
  },
  {
    id: "win_streak_3",
    name: "Hot Streak",
    description: "Win 3 games in a row",
    emoji: "🔥",
    xpReward: 75,
    pointsReward: 200,
    rarity: "common",
  },
  {
    id: "win_streak_5",
    name: "On Fire",
    description: "Win 5 games in a row",
    emoji: "🌋",
    xpReward: 150,
    pointsReward: 500,
    rarity: "rare",
  },
  {
    id: "win_streak_10",
    name: "Unstoppable",
    description: "Win 10 games in a row",
    emoji: "⚡",
    xpReward: 500,
    pointsReward: 2000,
    rarity: "legendary",
  },
  {
    id: "play_10",
    name: "Getting Started",
    description: "Play 10 games",
    emoji: "🎮",
    xpReward: 30,
    pointsReward: 50,
    rarity: "common",
  },
  {
    id: "play_50",
    name: "Veteran",
    description: "Play 50 games",
    emoji: "🎖️",
    xpReward: 100,
    pointsReward: 300,
    rarity: "rare",
  },
  {
    id: "play_100",
    name: "Centurion",
    description: "Play 100 games",
    emoji: "💯",
    xpReward: 300,
    pointsReward: 1000,
    rarity: "epic",
  },
  {
    id: "win_50",
    name: "Card Shark",
    description: "Win 50 games total",
    emoji: "🦈",
    xpReward: 200,
    pointsReward: 500,
    rarity: "epic",
  },
  {
    id: "survival_stage1",
    name: "Survivor",
    description: "Clear Stage 1 of AI Survival",
    emoji: "🛡️",
    xpReward: 50,
    pointsReward: 0,
    rarity: "common",
  },
  {
    id: "survival_stage3",
    name: "Half Champion",
    description: "Clear Stage 3 of AI Survival",
    emoji: "⚔️",
    xpReward: 150,
    pointsReward: 200,
    rarity: "rare",
  },
  {
    id: "survival_win",
    name: "Champion",
    description: "Win the AI Survival Championship",
    emoji: "🏆",
    xpReward: 500,
    pointsReward: 0,
    rarity: "legendary",
  },
  {
    id: "boss_slayer",
    name: "Boss Slayer",
    description: "Defeat the Boss AI in Survival",
    emoji: "💀",
    xpReward: 200,
    pointsReward: 500,
    rarity: "epic",
  },
  {
    id: "login_streak_7",
    name: "Daily Devotee",
    description: "Login 7 days in a row",
    emoji: "📅",
    xpReward: 100,
    pointsReward: 500,
    rarity: "rare",
  },
  {
    id: "login_streak_30",
    name: "Loyal Player",
    description: "Login 30 days in a row",
    emoji: "🗓️",
    xpReward: 500,
    pointsReward: 2000,
    rarity: "legendary",
  },
  {
    id: "rank_silver",
    name: "Rising Star",
    description: "Reach Silver rank",
    emoji: "🥈",
    xpReward: 100,
    pointsReward: 300,
    rarity: "common",
  },
  {
    id: "rank_gold",
    name: "Gold Standard",
    description: "Reach Gold rank",
    emoji: "🥇",
    xpReward: 200,
    pointsReward: 500,
    rarity: "rare",
  },
  {
    id: "rank_platinum",
    name: "Platinum Elite",
    description: "Reach Platinum rank",
    emoji: "💎",
    xpReward: 400,
    pointsReward: 1000,
    rarity: "epic",
  },
  {
    id: "rank_diamond",
    name: "Diamond Legend",
    description: "Reach Diamond rank",
    emoji: "💠",
    xpReward: 800,
    pointsReward: 2000,
    rarity: "legendary",
  },
  {
    id: "rank_master",
    name: "Grand Master",
    description: "Reach Master rank",
    emoji: "👑",
    xpReward: 2000,
    pointsReward: 5000,
    rarity: "legendary",
  },
];

export function getAchievement(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

// Anti-farming: XP multiplier based on bot game count this hour
export function botXpMultiplier(botGamesThisHour: number): number {
  if (botGamesThisHour < 5) return 1.0;
  if (botGamesThisHour < 10) return 0.5;
  if (botGamesThisHour < 20) return 0.2;
  return 0.1;
}

export function estimatePlayerStyle(behavior: {
  draws: number;
  cuts: number;
  showAttempts: number;
  attackThrows: number;
  attackTakes: number;
  handCountHistory: number[];
}): PlayerStyle {
  const drawAggression = behavior.draws;
  const cutAggression = behavior.cuts;
  const showAggression = behavior.showAttempts;
  const attackAggression = behavior.attackThrows - behavior.attackTakes;
  const averageHand =
    behavior.handCountHistory.length > 0
      ? behavior.handCountHistory.reduce((s, v) => s + v, 0) /
        behavior.handCountHistory.length
      : 0;

  if (showAggression >= 2 && drawAggression <= 2) return "fast_show";
  if (cutAggression >= 3 || averageHand >= 5) return "combo_hoarder";
  if (attackAggression >= 2) return "aggressive";
  if (averageHand >= 5 && drawAggression >= 3) return "trap";
  if (behavior.attackTakes > behavior.attackThrows + 1) return "defensive";
  if (behavior.draws >= 4 && behavior.cuts <= 1) return "hold_7s";
  return "unknown";
}

export function calculateBotDifficultyBoost(progress: {
  botGamesThisHour: number;
  winStreak: number;
  recentOpponentTypes: string[];
  recentPlayerStyles?: string[];
  totalWins: number;
  totalGames: number;
}): number {
  const recentBots = progress.recentOpponentTypes
    .slice(-7)
    .filter((t) => t === "bot").length;
  const botGamesPenalty = Math.min(
    0.18,
    Math.max(
      0,
      (progress.botGamesThisHour - 4) * 0.02 +
        Math.max(0, progress.botGamesThisHour - 9) * 0.01,
    ),
  );
  const streakPenalty =
    progress.winStreak >= 8
      ? 0.12
      : progress.winStreak >= 5
        ? 0.08
        : progress.winStreak >= 3
          ? 0.05
          : 0;
  const repeatBotPenalty = recentBots >= 6 ? 0.07 : recentBots >= 4 ? 0.04 : 0;
  const efficiency =
    progress.totalGames > 0 ? progress.totalWins / progress.totalGames : 0;
  const highWinRatePenalty =
    efficiency >= 0.75 ? 0.08 : efficiency >= 0.65 ? 0.05 : 0;
  const stylePenalty = (progress.recentPlayerStyles ?? []).reduce(
    (sum, style) => {
      if (style === "fast_show") return sum + 0.03;
      if (style === "aggressive") return sum + 0.02;
      if (style === "combo_hoarder") return sum + 0.01;
      return sum;
    },
    0,
  );
  const boost =
    botGamesPenalty +
    streakPenalty +
    repeatBotPenalty +
    highWinRatePenalty +
    Math.min(0.05, stylePenalty);
  return Math.min(0.35, boost);
}

// Randomized bot personality rotation to prevent pattern exploitation
const PERSONALITIES = ["safe", "aggressive", "bluff", "smart", "boss"] as const;
export function getAntiRepeatPersonality(
  intended: string,
  recentTypes: string[],
): string {
  const recent5 = recentTypes.slice(-5);
  const sameCount = recent5.filter((t) => t === intended).length;
  // If played same personality 3+ times in last 5 → inject random variety
  if (sameCount >= 3) {
    const others = PERSONALITIES.filter((p) => p !== intended);
    return others[Math.floor(Math.random() * others.length)];
  }
  // Small random chance (15%) to slightly vary personality even without pattern
  if (Math.random() < 0.15) {
    const idx = PERSONALITIES.indexOf(intended as any);
    const nearby = [idx - 1, idx + 1].filter(
      (i) => i >= 0 && i < PERSONALITIES.length,
    );
    if (nearby.length > 0)
      return PERSONALITIES[nearby[Math.floor(Math.random() * nearby.length)]];
  }
  return intended;
}

// IST midnight check for daily rewards
export function isSameDayIST(a: Date, b: Date): boolean {
  const toIST = (d: Date) => new Date(d.getTime() + 5.5 * 3600 * 1000);
  const ai = toIST(a);
  const bi = toIST(b);
  return (
    ai.getFullYear() === bi.getFullYear() &&
    ai.getMonth() === bi.getMonth() &&
    ai.getDate() === bi.getDate()
  );
}

export function isDayBeforeIST(earlier: Date, later: Date): boolean {
  const toIST = (d: Date) => new Date(d.getTime() + 5.5 * 3600 * 1000);
  const a = toIST(earlier);
  const b = toIST(later);
  const aDate = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const bDate = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  const diff = Math.round((bDate.getTime() - aDate.getTime()) / 86400000);
  return diff === 1;
}
