import mongoose, { Document, Schema } from "mongoose";

export type BotPersonality = "safe" | "aggressive" | "bluff" | "smart" | "boss";
export type TeammateType = "ai" | "human";
export type EntryMode = "host_pays" | "split";

// ── Stage configuration ────────────────────────────────────────────────────────

export interface TeamArenaStageConfig {
  stage: number;
  name: string;
  subtitle: string;
  difficulty: string;
  difficultyEmoji: string;
  mainPersonality: BotPersonality;
  secondaryPool: BotPersonality[];
  enemyBotNames: [string, string];
}

export const TEAM_ARENA_STAGES: TeamArenaStageConfig[] = [
  {
    stage: 1,
    name: "Warmup Duel",
    subtitle: "Enter the Arena",
    difficulty: "Easy",
    difficultyEmoji: "🟢",
    mainPersonality: "safe",
    secondaryPool: ["safe", "bluff", "aggressive"],
    enemyBotNames: ["Iron Guard", "Shadow Strike"],
  },
  {
    stage: 2,
    name: "Tactical Pressure",
    subtitle: "Pressure Begins",
    difficulty: "Medium",
    difficultyEmoji: "🟡",
    mainPersonality: "aggressive",
    secondaryPool: ["safe", "bluff", "smart"],
    enemyBotNames: ["Blaze", "Tactician"],
  },
  {
    stage: 3,
    name: "Mind Games",
    subtitle: "Nothing Is What It Seems",
    difficulty: "Hard",
    difficultyEmoji: "🟠",
    mainPersonality: "bluff",
    secondaryPool: ["aggressive", "smart", "bluff"],
    enemyBotNames: ["Phantom", "Mirror"],
  },
  {
    stage: 4,
    name: "Survival Clash",
    subtitle: "Survive the Arena",
    difficulty: "Expert",
    difficultyEmoji: "🔴",
    mainPersonality: "smart",
    secondaryPool: ["aggressive", "bluff", "smart"],
    enemyBotNames: ["Apex", "Crusher"],
  },
  {
    stage: 5,
    name: "Final Arena",
    subtitle: "Master the SHOW",
    difficulty: "Boss",
    difficultyEmoji: "👑",
    mainPersonality: "boss",
    secondaryPool: ["smart", "aggressive", "bluff"],
    enemyBotNames: ["The Overlord", "Nemesis"],
  },
];

// AI teammate personality options shown to the player
export const AI_TEAMMATE_PROFILES = [
  {
    personality: "safe" as BotPersonality,
    name: "Sentinel",
    icon: "🛡",
    playstyle: "Cautious Defender",
    description: "Patient and methodical. Minimises risk, holds out for the perfect SHOW.",
    difficulty: "Easy",
  },
  {
    personality: "aggressive" as BotPersonality,
    name: "Vanguard",
    icon: "⚡",
    playstyle: "Relentless Attacker",
    description: "Maximum pressure. Throws 7s and skips constantly to tire opponents.",
    difficulty: "Hard",
  },
  {
    personality: "bluff" as BotPersonality,
    name: "Mirage",
    icon: "🎭",
    playstyle: "Mind-Game Specialist",
    description: "Unpredictable and deceptive. Opponents can never read Mirage's hand.",
    difficulty: "Hard",
  },
  {
    personality: "smart" as BotPersonality,
    name: "Oracle",
    icon: "🧠",
    playstyle: "Adaptive Strategist",
    description: "Reads the board and adapts. Balances attack, defence, and SHOW timing perfectly.",
    difficulty: "Expert",
  },
];

// Stage rewards (in points, converted to rupees at POINTS_PER_RUPEE = 100)
export const TEAM_ARENA_ENTRY_POINTS = 1000; // base entry per player (beginner default)
export const TEAM_ARENA_STAGE_REWARDS = [150, 300, 550, 900, 1600]; // stages 1-5 (beginner default)

export const TEAM_ARENA_TIERS: Record<string, { entryPoints: number; stageRewards: number[] }> = {
  beginner: { entryPoints: 1000,  stageRewards: [150, 300, 550, 900, 1600]     },
  pro:      { entryPoints: 2000,  stageRewards: [400, 800, 1400, 2400, 5000]   },
  elite:    { entryPoints: 5000,  stageRewards: [1000, 2000, 3500, 6000, 12500] },
  legend:   { entryPoints: 10000, stageRewards: [2000, 4000, 7000, 12000, 25000] },
};

// ── Model types ────────────────────────────────────────────────────────────────

export interface TeamMember {
  userId: string;
  username: string;
  avatar: string;
  isBot: boolean;
}

export interface TeamArenaTeam {
  members: TeamMember[];           // 2 members per team
  seatIndices: number[];           // seat positions in the 4-player game
}

export interface TeamArenaStageResult {
  stage: number;
  mainPersonality: string;
  secondaryPersonality: string;
  enemyBotNames: [string, string];
  teamAScore: number;              // combined score (lower = better)
  teamBScore: number;
  teamAWon: boolean;
  pointsEarned: number;
}

export interface ITeamArenaTournament extends Document {
  hostUserId: string;
  teammateType: TeammateType;
  entryMode: EntryMode;
  teamAiPersonality: BotPersonality | null;  // null if human teammate
  teammateName: string;
  teammateUserId: string | null;             // null if AI teammate
  status: "waiting_teammate" | "active" | "won" | "lost" | "abandoned";
  currentStage: number;
  tier: string;
  entryPoints: number;
  stageRewards: number[];
  teamAScore: number;                        // cumulative
  teamBScore: number;                        // cumulative
  stageResults: TeamArenaStageResult[];
  totalPointsEarned: number;
  roundsPlayed: number;
  currentRoomCode: string | null;
  inviteCode: string;                        // short code for teammate to join
  paidUserIds: string[];                     // tracks who has paid entry
  createdAt: Date;
  completedAt?: Date;
}

const TeamArenaTournamentSchema = new Schema<ITeamArenaTournament>(
  {
    hostUserId:        { type: String, required: true, index: true },
    teammateType:      { type: String, enum: ["ai", "human"], required: true },
    entryMode:         { type: String, enum: ["host_pays", "split"], required: true },
    teamAiPersonality: { type: String, enum: ["safe", "aggressive", "bluff", "smart", "boss"], default: null },
    teammateName:      { type: String, required: true },
    teammateUserId:    { type: String, default: null },
    status: {
      type: String,
      enum: ["waiting_teammate", "active", "won", "lost", "abandoned"],
      default: "waiting_teammate",
    },
    currentStage:      { type: Number, default: 1 },
    tier:              { type: String, default: 'beginner' },
    entryPoints:       { type: Number, required: true },
    stageRewards:      [{ type: Number }],
    teamAScore:        { type: Number, default: 0 },
    teamBScore:        { type: Number, default: 0 },
    stageResults: [
      {
        stage:                { type: Number },
        mainPersonality:      { type: String },
        secondaryPersonality: { type: String },
        enemyBotNames:        [{ type: String }],
        teamAScore:           { type: Number },
        teamBScore:           { type: Number },
        teamAWon:             { type: Boolean },
        pointsEarned:         { type: Number, default: 0 },
      },
    ],
    totalPointsEarned: { type: Number, default: 0 },
    roundsPlayed:      { type: Number, default: 0 },
    currentRoomCode:   { type: String, default: null, index: true },
    inviteCode:        { type: String, required: true, unique: true, index: true },
    paidUserIds:       [{ type: String }],
    completedAt:       { type: Date },
  },
  { timestamps: true },
);

// Index to quickly find active tournaments for a user (host or teammate)
TeamArenaTournamentSchema.index({ hostUserId: 1, status: 1 });
TeamArenaTournamentSchema.index({ teammateUserId: 1, status: 1 });

export const TeamArenaTournament = mongoose.model<ITeamArenaTournament>(
  "TeamArenaTournament",
  TeamArenaTournamentSchema,
);
