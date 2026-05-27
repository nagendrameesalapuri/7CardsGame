import mongoose, { Document, Schema } from 'mongoose';

export interface IFavorite {
  userId: mongoose.Types.ObjectId;
  username: string;
  avatar: string;
  addedAt: Date;
}

export interface IUser extends Document {
  googleId?: string;
  username: string;
  email?: string;
  avatar: string;
  selectedBadgeId?: string;
  isGuest: boolean;
  isBanned: boolean;
  isAdmin: boolean;
  guestToken?: string;
  walletBalance: number;
  heldBalance: number;
  aiPoints: number;
  bonusSpins: number;
  launchBonusClaimed: boolean;
  spinLastDate?: string;
  spinDailyCount: number;
  pointsSpinLastDate?: string;
  pointsSpinDailyCount: number;
  referralCode?: string;
  referredBy?: string;
  referralRewardPaid: boolean;
  referralCount: number;
  favorites: IFavorite[];
  stats: {
    gamesPlayed: number;
    gamesWon: number;
    roundsPlayed: number;
    roundsWon: number;
    totalPointsEarned: number;
    showAttempts: number;
    showSuccesses: number;
  };
  lastSeenAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    googleId: { type: String, sparse: true, unique: true },
    username: { type: String, required: true, trim: true, minlength: 2, maxlength: 20 },
    email: { type: String, sparse: true, unique: true, lowercase: true },
    avatar: { type: String, default: 'avatar_1' },
    selectedBadgeId: { type: String, default: null },
    isGuest: { type: Boolean, default: false },
    isBanned: { type: Boolean, default: false },
    isAdmin: { type: Boolean, default: false },
    guestToken:    { type: String, sparse: true, unique: true },
    walletBalance:   { type: Number, default: 0 },
    heldBalance:     { type: Number, default: 0, min: 0 },
    aiPoints:             { type: Number, default: 0 },
    bonusSpins:           { type: Number, default: 0 },
    launchBonusClaimed:   { type: Boolean, default: false },
    spinLastDate:         { type: String },
    spinDailyCount:       { type: Number, default: 0 },
    pointsSpinLastDate:   { type: String },
    pointsSpinDailyCount: { type: Number, default: 0 },
    referralCode:         { type: String, sparse: true, unique: true, uppercase: true },
    referredBy:           { type: String, default: null },
    referralRewardPaid:   { type: Boolean, default: false },
    referralCount:        { type: Number, default: 0 },
    stats: {
      gamesPlayed: { type: Number, default: 0 },
      gamesWon: { type: Number, default: 0 },
      roundsPlayed: { type: Number, default: 0 },
      roundsWon: { type: Number, default: 0 },
      totalPointsEarned: { type: Number, default: 0 },
      showAttempts: { type: Number, default: 0 },
      showSuccesses: { type: Number, default: 0 },
    },
    favorites: [{
      userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      username: { type: String, required: true },
      avatar: { type: String, default: 'avatar_1' },
      addedAt: { type: Date, default: Date.now },
    }],
    lastSeenAt: { type: Date },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

UserSchema.virtual('availableBalance').get(function () {
  return Math.max(0, this.walletBalance - this.heldBalance);
});

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
