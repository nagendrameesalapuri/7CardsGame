import mongoose, { Document, Schema } from 'mongoose';

export type SurvivalTier = 'beginner' | 'pro' | 'elite' | 'boss_arena';
export type BotPersonality = 'safe' | 'aggressive' | 'bluff' | 'smart' | 'boss';

export const SURVIVAL_STAGES: Array<{ stage: number; personality: BotPersonality; name: string }> = [
  { stage: 1, personality: 'safe',       name: 'Safe Bot' },
  { stage: 2, personality: 'aggressive', name: 'Aggressive Bot' },
  { stage: 3, personality: 'bluff',      name: 'Bluff Bot' },
  { stage: 4, personality: 'smart',      name: 'Smart AI' },
  { stage: 5, personality: 'boss',       name: 'Boss AI' },
];

export const TIER_CONFIG: Record<SurvivalTier, { entryPoints: number; label: string; stageRewards: number[] }> = {
  beginner:   { entryPoints: 1000,  label: 'Beginner',   stageRewards: [200, 400, 700, 1200, 2500] },
  pro:        { entryPoints: 2000,  label: 'Pro',        stageRewards: [400, 800, 1400, 2400, 5000] },
  elite:      { entryPoints: 5000,  label: 'Elite',      stageRewards: [1000, 2000, 3500, 6000, 12500] },
  boss_arena: { entryPoints: 10000, label: 'Boss Arena', stageRewards: [2000, 4000, 7000, 12000, 25000] },
};

export interface ISurvivalTournament extends Document {
  userId: string;
  tier: SurvivalTier;
  currentStage: number;
  status: 'active' | 'won' | 'lost' | 'abandoned';
  entryPoints: number;
  stageResults: Array<{
    stage: number;
    personality: string;
    playerWon: boolean;
    playerScore: number;
    botScore: number;
    pointsEarned: number;
  }>;
  totalPointsEarned: number;
  roundsPlayed: number;
  currentRoomCode: string | null;
  createdAt: Date;
  completedAt?: Date;
}

const SurvivalTournamentSchema = new Schema<ISurvivalTournament>(
  {
    userId:           { type: String, required: true, index: true },
    tier:             { type: String, enum: ['beginner', 'pro', 'elite', 'boss_arena'], required: true },
    currentStage:     { type: Number, default: 1 },
    status:           { type: String, enum: ['active', 'won', 'lost', 'abandoned'], default: 'active' },
    entryPoints:      { type: Number, required: true },
    stageResults:     [{
      stage:       { type: Number },
      personality: { type: String },
      playerWon:   { type: Boolean },
      playerScore: { type: Number },
      botScore:    { type: Number },
      pointsEarned:{ type: Number, default: 0 },
    }],
    totalPointsEarned:{ type: Number, default: 0 },
    roundsPlayed:     { type: Number, default: 0 },
    currentRoomCode:  { type: String, default: null },
    completedAt:      { type: Date },
  },
  { timestamps: true },
);

export const SurvivalTournament = mongoose.model<ISurvivalTournament>('SurvivalTournament', SurvivalTournamentSchema);
