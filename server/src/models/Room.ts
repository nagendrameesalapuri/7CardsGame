import mongoose, { Document, Schema } from 'mongoose';
import { RoomConfig } from '../../../shared/src/types';

export interface IRoomPlayer {
  userId: string;
  username: string;
  avatar: string;
  isReady: boolean;
  isHost: boolean;
  isBot: boolean;
  socketId?: string;
}

export interface IRoom extends Document {
  code: string;
  name: string;
  hostId: string;
  players: IRoomPlayer[];
  config: RoomConfig;
  status: 'waiting' | 'playing' | 'finished';
  gameId: string | null;
  paidPlayerIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

const RoomPlayerSchema = new Schema<IRoomPlayer>({
  userId: { type: String, required: true },
  username: { type: String, required: true },
  avatar: { type: String, default: 'avatar_1' },
  isReady: { type: Boolean, default: false },
  isHost: { type: Boolean, default: false },
  isBot: { type: Boolean, default: false },
  socketId: { type: String },
}, { _id: false });

const RoomConfigSchema = new Schema<RoomConfig>({
  maxPlayers: { type: Number, default: 4, min: 2, max: 10 },
  roundCount: { type: Number, default: 5, min: 1, max: 50 },
  isPrivate: { type: Boolean, default: false },
  turnTimeLimit: { type: Number, default: 30, min: 15, max: 60 },
  allowBots: { type: Boolean, default: true },
  botCount:  { type: Number, default: 0, min: 0, max: 9 },
  entryFee:  { type: Number, default: 0, min: 0, max: 10000 },
  botPersonality:    { type: String, default: 'smart' },
  botPersonalities:  [{ type: String }],
  botNames:          [{ type: String }],
}, { _id: false });

const RoomSchema = new Schema<IRoom>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, length: 6 },
    name: { type: String, required: true, maxlength: 30 },
    hostId: { type: String, required: true },
    players: [RoomPlayerSchema],
    config: { type: RoomConfigSchema, default: () => ({}) },
    status:         { type: String, enum: ['waiting', 'playing', 'finished'], default: 'waiting' },
    gameId:         { type: String, default: null },
    paidPlayerIds:  [{ type: String }],
  },
  { timestamps: true }
);

// Auto-cleanup stale rooms after 2 hours
RoomSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7200 });

export const Room = mongoose.model<IRoom>('Room', RoomSchema);
