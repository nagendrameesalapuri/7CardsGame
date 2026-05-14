import mongoose, { Document, Schema } from 'mongoose';

export interface ITournament extends Document {
  userId: string;
  entryFee: number;
  status: 'active' | 'won' | 'lost' | 'draw' | 'cancelled';
  gamesPlayed: number;
  playerWins: number;
  botWins: number;
  draws: number;
  currentRoomCode: string | null;
  prizeAmount: number;
  gameResults: Array<{
    gameNumber: number;
    playerScore: number;
    botScore: number;
    playerWon: boolean;
    isDraw: boolean;
  }>;
  createdAt: Date;
  completedAt?: Date;
}

const TournamentSchema = new Schema<ITournament>(
  {
    userId:          { type: String, required: true, index: true },
    entryFee:        { type: Number, required: true },
    status:          { type: String, enum: ['active', 'won', 'lost', 'draw', 'cancelled'], default: 'active' },
    gamesPlayed:     { type: Number, default: 0 },
    playerWins:      { type: Number, default: 0 },
    botWins:         { type: Number, default: 0 },
    draws:           { type: Number, default: 0 },
    currentRoomCode: { type: String, default: null },
    prizeAmount:     { type: Number, default: 0 },
    gameResults:     [{
      gameNumber:  { type: Number },
      playerScore: { type: Number },
      botScore:    { type: Number },
      playerWon:   { type: Boolean },
      isDraw:      { type: Boolean, default: false },
    }],
    completedAt: { type: Date },
  },
  { timestamps: true },
);

export const Tournament = mongoose.model<ITournament>('Tournament', TournamentSchema);
