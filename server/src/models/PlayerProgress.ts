import mongoose, { Document, Schema } from 'mongoose';

export interface IPlayerProgress extends Document {
  userId: string;
  xp: number;
  level: number;
  rank: string;
  seasonXp: number;
  winStreak: number;
  maxWinStreak: number;
  loginStreak: number;
  maxLoginStreak: number;
  lastLoginDate: Date | null;
  botGamesThisHour: number;
  botGameHourReset: Date | null;
  recentOpponentTypes: string[];
  lastDailyReward: Date | null;
  dailyRewardDay: number;
  lastLuckySpin: Date | null;
  achievements: Array<{ id: string; unlockedAt: Date }>;
  totalWins: number;
  totalGames: number;
  survivalWins: number;
  createdAt: Date;
  updatedAt: Date;
}

const PlayerProgressSchema = new Schema<IPlayerProgress>(
  {
    userId:              { type: String, required: true, unique: true, index: true },
    xp:                  { type: Number, default: 0 },
    level:               { type: Number, default: 1 },
    rank:                { type: String, default: 'bronze' },
    seasonXp:            { type: Number, default: 0 },
    winStreak:           { type: Number, default: 0 },
    maxWinStreak:        { type: Number, default: 0 },
    loginStreak:         { type: Number, default: 0 },
    maxLoginStreak:      { type: Number, default: 0 },
    lastLoginDate:       { type: Date, default: null },
    botGamesThisHour:    { type: Number, default: 0 },
    botGameHourReset:    { type: Date, default: null },
    recentOpponentTypes: { type: [String], default: [] },
    lastDailyReward:     { type: Date, default: null },
    dailyRewardDay:      { type: Number, default: 0 },
    lastLuckySpin:       { type: Date, default: null },
    achievements: [{
      id:          { type: String },
      unlockedAt:  { type: Date, default: Date.now },
    }],
    totalWins:           { type: Number, default: 0 },
    totalGames:          { type: Number, default: 0 },
    survivalWins:        { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const PlayerProgress = mongoose.model<IPlayerProgress>('PlayerProgress', PlayerProgressSchema);

export async function getOrCreateProgress(userId: string): Promise<IPlayerProgress> {
  let p = await PlayerProgress.findOne({ userId });
  if (!p) p = await PlayerProgress.create({ userId });
  return p;
}
