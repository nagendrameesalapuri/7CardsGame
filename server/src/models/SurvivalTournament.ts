import mongoose, { Document, Schema } from "mongoose";

export type SurvivalTier = "beginner" | "pro" | "elite" | "boss_arena";
export type BotPersonality = "safe" | "aggressive" | "bluff" | "smart" | "boss";

export const SURVIVAL_STAGES: Array<{
  stage: number;
  botCount: number;
  personalities: BotPersonality[];
  botNames: string[];
  name: string;
  description: string;
}> = [
  { stage: 1, botCount: 1, personalities: ["safe"],                        botNames: ["Safe Bot"],                               name: "Safe Bot",          description: "1v1 · Defensive AI"          },
  { stage: 2, botCount: 1, personalities: ["aggressive"],                  botNames: ["Aggressive Bot"],                         name: "Aggressive Bot",    description: "1v1 · Aggressive AI"          },
  { stage: 3, botCount: 1, personalities: ["bluff"],                       botNames: ["Bluff Bot"],                              name: "Bluff Bot",         description: "1v1 · Deceptive AI"           },
  { stage: 4, botCount: 2, personalities: ["smart", "aggressive"],         botNames: ["Smart AI", "Aggressive AI"],              name: "Dual AI Challenge", description: "1v2 · Smart + Aggressive AI"  },
  { stage: 5, botCount: 3, personalities: ["boss", "smart", "aggressive"], botNames: ["Boss AI", "Smart AI", "Aggressive AI"],   name: "Final Boss Arena",  description: "1v3 · Boss + Smart + Aggressive AI" },
];

export const TIER_CONFIG: Record<
  SurvivalTier,
  { entryPoints: number; label: string; stageRewards: number[] }
> = {
  beginner: {
    entryPoints: 1000,
    label: "Beginner",
    stageRewards: [100, 200, 300, 450, 700],
  },
  pro: {
    entryPoints: 2000,
    label: "Pro",
    stageRewards: [200, 350, 600, 900, 1500],
  },
  elite: {
    entryPoints: 5000,
    label: "Elite",
    stageRewards: [600, 900, 1400, 2200, 3800],
  },
  boss_arena: {
    entryPoints: 10000,
    label: "Boss Arena",
    stageRewards: [1200, 1800, 2600, 4200, 7600],
  },
};

export interface ISurvivalTournament extends Document {
  userId: string;
  tier: SurvivalTier;
  currentStage: number;
  status: "active" | "won" | "lost" | "abandoned";
  entryPoints: number;
  stageResults: Array<{
    stage: number;
    personality: string;          // primary (lead) bot personality
    playerWon: boolean;
    playerScore: number;
    botScore: number;             // best (lowest) bot score, backward compat
    botScores: number[];          // all bot scores for multi-bot stages
    botNames: string[];           // names of all bots in this stage
    pointsEarned: number;
  }>;
  totalPointsEarned: number;
  roundsPlayed: number;
  currentRoomCode: string | null;
  tiebreakerPending: boolean;
  createdAt: Date;
  completedAt?: Date;
}

const SurvivalTournamentSchema = new Schema<ISurvivalTournament>(
  {
    userId: { type: String, required: true, index: true },
    tier: {
      type: String,
      enum: ["beginner", "pro", "elite", "boss_arena"],
      required: true,
    },
    currentStage: { type: Number, default: 1 },
    status: {
      type: String,
      enum: ["active", "won", "lost", "abandoned"],
      default: "active",
    },
    entryPoints: { type: Number, required: true },
    stageResults: [
      {
        stage:        { type: Number },
        personality:  { type: String },
        playerWon:    { type: Boolean },
        playerScore:  { type: Number },
        botScore:     { type: Number },
        botScores:    [{ type: Number }],
        botNames:     [{ type: String }],
        pointsEarned: { type: Number, default: 0 },
      },
    ],
    totalPointsEarned: { type: Number, default: 0 },
    roundsPlayed: { type: Number, default: 0 },
    currentRoomCode: { type: String, default: null },
    tiebreakerPending: { type: Boolean, default: false },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

export const SurvivalTournament = mongoose.model<ISurvivalTournament>(
  "SurvivalTournament",
  SurvivalTournamentSchema,
);
