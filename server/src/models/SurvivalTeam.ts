import mongoose, { Document, Schema } from 'mongoose';
import { SurvivalTier } from './SurvivalTournament';

export interface ITeamMember {
  userId: string;
  username: string;
  avatar: string;
  walletDeducted: boolean;
  isBot?: boolean;
  personality?: string;
}

export interface ITeamStageResult {
  stage: number;
  teamScore: number;
  botTotalScore: number;
  botScores: number[];
  botNames: string[];
  teamWon: boolean;
  pointsEarned: number; // per member
}

export interface ISurvivalTeam extends Document {
  teamCode: string;
  hostId: string;
  tier: SurvivalTier;
  entryFeeMode: 'split' | 'host_pays';
  maxSize: number;
  members: ITeamMember[];
  status: 'forming' | 'playing' | 'completed' | 'abandoned';
  currentStage: number;
  currentRoomCode: string | null;
  stageResults: ITeamStageResult[];
  totalPointsEarned: number;
  entryPoints: number;
  createdAt: Date;
  completedAt?: Date;
}

const SurvivalTeamSchema = new Schema<ISurvivalTeam>(
  {
    teamCode:   { type: String, required: true, index: true },
    hostId:     { type: String, required: true },
    tier:       { type: String, enum: ['beginner', 'pro', 'elite', 'boss_arena'], required: true },
    entryFeeMode: { type: String, enum: ['split', 'host_pays'], required: true },
    maxSize:    { type: Number, required: true },
    members: [{
      userId:         { type: String, required: true },
      username:       { type: String, required: true },
      avatar:         { type: String, default: '' },
      walletDeducted: { type: Boolean, default: false },
      isBot:          { type: Boolean, default: false },
      personality:    { type: String, default: 'smart' },
    }],
    status: {
      type: String,
      enum: ['forming', 'playing', 'completed', 'abandoned'],
      default: 'forming',
    },
    currentStage:      { type: Number, default: 1 },
    currentRoomCode:   { type: String, default: null },
    stageResults: [{
      stage:         { type: Number },
      teamScore:     { type: Number },
      botTotalScore: { type: Number },
      botScores:     [{ type: Number }],
      botNames:      [{ type: String }],
      teamWon:       { type: Boolean },
      pointsEarned:  { type: Number, default: 0 },
    }],
    totalPointsEarned: { type: Number, default: 0 },
    entryPoints:       { type: Number, required: true },
    completedAt:       { type: Date },
  },
  { timestamps: true },
);

export const SurvivalTeam = mongoose.model<ISurvivalTeam>('SurvivalTeam', SurvivalTeamSchema);
