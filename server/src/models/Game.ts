import mongoose, { Document, Schema } from 'mongoose';
import { RoundResult } from '../../../shared/src/types';

export interface IGame extends Document {
  roomId: string;
  players: Array<{
    userId: string;
    username: string;
    avatar: string;
    totalScore: number;
    isBot: boolean;
  }>;
  winnerId: string | null;
  winnerUsername: string | null;
  roundCount: number;
  rounds: Array<{
    roundNumber: number;
    jokerRank: string;
    showPlayerId: string;
    showPlayerWon: boolean;
    winnerId: string;
    playerResults: RoundResult['playerResults'];
    endedAt: Date;
  }>;
  status: 'playing' | 'finished';
  startedAt: Date;
  endedAt?: Date;
}

const GameSchema = new Schema<IGame>({
  roomId: { type: String, required: true, index: true },
  players: [{
    userId: String,
    username: String,
    avatar: String,
    totalScore: { type: Number, default: 0 },
    isBot: { type: Boolean, default: false },
    _id: false,
  }],
  winnerId: { type: String, default: null },
  winnerUsername: { type: String, default: null },
  roundCount: { type: Number, default: 5 },
  rounds: [{
    roundNumber: Number,
    jokerRank: String,
    showPlayerId: String,
    showPlayerWon: Boolean,
    winnerId: String,
    playerResults: Schema.Types.Mixed,
    endedAt: Date,
    _id: false,
  }],
  status: { type: String, enum: ['playing', 'finished'], default: 'playing' },
  startedAt: { type: Date, default: Date.now },
  endedAt: Date,
});

export const Game = mongoose.model<IGame>('Game', GameSchema);
