import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  googleId?: string;
  username: string;
  email?: string;
  avatar: string;
  isGuest: boolean;
  isBanned: boolean;
  guestToken?: string;
  walletBalance: number;
  stats: {
    gamesPlayed: number;
    gamesWon: number;
    roundsPlayed: number;
    roundsWon: number;
    totalPointsEarned: number;
    showAttempts: number;
    showSuccesses: number;
  };
  friends: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    googleId: { type: String, sparse: true, unique: true },
    username: { type: String, required: true, trim: true, minlength: 2, maxlength: 20 },
    email: { type: String, sparse: true, unique: true, lowercase: true },
    avatar: { type: String, default: 'avatar_1' },
    isGuest: { type: Boolean, default: false },
    isBanned: { type: Boolean, default: false },
    guestToken:    { type: String, sparse: true, unique: true },
    walletBalance: { type: Number, default: 0, min: 0 },
    stats: {
      gamesPlayed: { type: Number, default: 0 },
      gamesWon: { type: Number, default: 0 },
      roundsPlayed: { type: Number, default: 0 },
      roundsWon: { type: Number, default: 0 },
      totalPointsEarned: { type: Number, default: 0 },
      showAttempts: { type: Number, default: 0 },
      showSuccesses: { type: Number, default: 0 },
    },
    friends: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

UserSchema.virtual('stats.winRate').get(function () {
  return this.stats.gamesPlayed > 0
    ? Math.round((this.stats.gamesWon / this.stats.gamesPlayed) * 100)
    : 0;
});

UserSchema.virtual('stats.showSuccessRate').get(function () {
  return this.stats.showAttempts > 0
    ? Math.round((this.stats.showSuccesses / this.stats.showAttempts) * 100)
    : 0;
});

export const User = mongoose.model<IUser>('User', UserSchema);
