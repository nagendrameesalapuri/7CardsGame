import mongoose, { Document, Schema } from 'mongoose';

export interface IAdminConfig extends Document {
  featureFlags: {
    spectatorModeEnabled: boolean;
    publicRoomsEnabled: boolean;
    tournamentBannerEnabled: boolean;
  };
  gameConfig: {
    minPlayers: number;
    maxPlayers: number;
    minRounds: number;
    maxRounds: number;
    maxSpectators: number;
    maxBots: number;
  };
  updatedAt: Date;
}

const AdminConfigSchema = new Schema<IAdminConfig>(
  {
    featureFlags: {
      spectatorModeEnabled:    { type: Boolean, default: true },
      publicRoomsEnabled:      { type: Boolean, default: true },
      tournamentBannerEnabled: { type: Boolean, default: true },
    },
    gameConfig: {
      minPlayers:    { type: Number, default: 2, min: 2, max: 10 },
      maxPlayers:    { type: Number, default: 5, min: 2, max: 10 },
      minRounds:     { type: Number, default: 1, min: 1, max: 50 },
      maxRounds:     { type: Number, default: 20, min: 1, max: 50 },
      maxSpectators: { type: Number, default: 10, min: 0, max: 50 },
      maxBots:       { type: Number, default: 4, min: 0, max: 9 },
    },
  },
  { timestamps: true }
);

export const AdminConfig = mongoose.model<IAdminConfig>('AdminConfig', AdminConfigSchema);

// Singleton helper — always returns the one config document
export async function getAdminConfig(): Promise<IAdminConfig> {
  let cfg = await AdminConfig.findOne();
  if (!cfg) cfg = await AdminConfig.create({});
  return cfg;
}
