import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IRegistration {
  userId: Types.ObjectId;
  username: string;
  avatar: string;
  registeredAt: Date;
  score: number;
  prizeWon: number;
  rank: number;
  eliminated: boolean;
  eliminatedAt?: Date;
  timeoutCount: number;
  isBot: boolean;
}

export interface IPrizeBreakdown {
  rank: number;
  percentage: number;
  label: string;
}

export type TournamentStatus = 'upcoming' | 'live' | 'completed' | 'cancelled';
export type TournamentMode = 'timed' | 'elimination';

export interface IScheduledTournament extends Document {
  name: string;
  description: string;
  bannerColor: string;
  startTime: Date;
  endTime: Date;
  entryFee: number;
  prizePool: number;
  prizeBreakdown: IPrizeBreakdown[];
  maxPlayers: number;
  registrations: IRegistration[];
  status: TournamentStatus;
  mode: TournamentMode;
  eliminationTarget: number;
  winnersCount: number;
  currentRound: number;
  activeRoomCode?: string;
  completedAt?: Date;
  cancelledAt?: Date;
  cancelReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RegistrationSchema = new Schema<IRegistration>(
  {
    userId:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
    username:     { type: String, required: true },
    avatar:       { type: String, default: 'avatar_1' },
    registeredAt: { type: Date, default: Date.now },
    score:        { type: Number, default: 0 },
    prizeWon:     { type: Number, default: 0 },
    rank:         { type: Number, default: 0 },
    eliminated:    { type: Boolean, default: false },
    eliminatedAt:  { type: Date },
    timeoutCount:  { type: Number, default: 0 },
    isBot:         { type: Boolean, default: false },
  },
  { _id: false }
);

const PrizeBreakdownSchema = new Schema<IPrizeBreakdown>(
  {
    rank:       { type: Number, required: true },
    percentage: { type: Number, required: true },
    label:      { type: String, default: '' },
  },
  { _id: false }
);

const ScheduledTournamentSchema = new Schema<IScheduledTournament>(
  {
    name:          { type: String, required: true, trim: true },
    description:   { type: String, default: '' },
    bannerColor:   { type: String, default: 'purple' },
    startTime:     { type: Date, required: true, index: true },
    endTime:       { type: Date, required: true },
    entryFee:      { type: Number, default: 0, min: 0 },
    prizePool:     { type: Number, required: true, min: 0 },
    prizeBreakdown: { type: [PrizeBreakdownSchema], default: [
      { rank: 1, percentage: 50, label: '🥇 Champion' },
      { rank: 2, percentage: 30, label: '🥈 Runner-up' },
      { rank: 3, percentage: 20, label: '🥉 Third Place' },
    ]},
    maxPlayers:        { type: Number, default: 0 },
    registrations:     { type: [RegistrationSchema], default: [] },
    status:            { type: String, enum: ['upcoming', 'live', 'completed', 'cancelled'], default: 'upcoming', index: true },
    mode:              { type: String, enum: ['timed', 'elimination'], default: 'timed' },
    eliminationTarget: { type: Number, default: 201 },
    winnersCount:      { type: Number, default: 1 },
    currentRound:  { type: Number, default: 0 },
    activeRoomCode:{ type: String },
    completedAt:   { type: Date },
    cancelledAt:   { type: Date },
    cancelReason:  { type: String },
  },
  { timestamps: true }
);

export const ScheduledTournament = mongoose.model<IScheduledTournament>('ScheduledTournament', ScheduledTournamentSchema);
