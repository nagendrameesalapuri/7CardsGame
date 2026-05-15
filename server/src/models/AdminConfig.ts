import mongoose, { Document, Schema } from "mongoose";

interface SurvivalTierCfg { entryPoints: number; stageRewards: number[]; }

export interface IAdminConfig extends Document {
  featureFlags: {
    spectatorModeEnabled: boolean;
    publicRoomsEnabled: boolean;
    tournamentBannerEnabled: boolean;
    survivalTiers: { beginner: boolean; pro: boolean; elite: boolean; boss_arena: boolean; };
  };
  survivalConfig: {
    beginner:   SurvivalTierCfg;
    pro:        SurvivalTierCfg;
    elite:      SurvivalTierCfg;
    boss_arena: SurvivalTierCfg;
  };
  gameConfig: {
    minPlayers: number;
    maxPlayers: number;
    minRounds: number;
    maxRounds: number;
    maxSpectators: number;
    maxBots: number;
  };
  walletConfig: {
    depositEnabled: boolean;
    withdrawEnabled: boolean;
    upiId: string;
    upiName: string;
    qrEnabled: boolean;
    qrCodeUrl: string;
  };
  updatedAt: Date;
}

const AdminConfigSchema = new Schema<IAdminConfig>(
  {
    featureFlags: {
      spectatorModeEnabled: { type: Boolean, default: true },
      publicRoomsEnabled: { type: Boolean, default: true },
      tournamentBannerEnabled: { type: Boolean, default: true },
      survivalEnabled: { type: Boolean, default: true },
      survivalTiers: {
        beginner:  { type: Boolean, default: true },
        pro:       { type: Boolean, default: true },
        elite:     { type: Boolean, default: true },
        boss_arena:{ type: Boolean, default: true },
      },
    },
    gameConfig: {
      minPlayers: { type: Number, default: 2, min: 2, max: 10 },
      maxPlayers: { type: Number, default: 5, min: 2, max: 10 },
      minRounds: { type: Number, default: 1, min: 1, max: 50 },
      maxRounds: { type: Number, default: 20, min: 1, max: 50 },
      maxSpectators: { type: Number, default: 10, min: 0, max: 50 },
      maxBots: { type: Number, default: 4, min: 0, max: 9 },
    },
    survivalConfig: {
      beginner:   { entryPoints: { type: Number, default: 1000  }, stageRewards: { type: [Number], default: [200,  400,  700,   1200,  2500]  } },
      pro:        { entryPoints: { type: Number, default: 2000  }, stageRewards: { type: [Number], default: [400,  800,  1400,  2400,  5000]  } },
      elite:      { entryPoints: { type: Number, default: 5000  }, stageRewards: { type: [Number], default: [1000, 2000, 3500,  6000,  12500] } },
      boss_arena: { entryPoints: { type: Number, default: 10000 }, stageRewards: { type: [Number], default: [2000, 4000, 7000,  12000, 25000] } },
    },
    walletConfig: {
      depositEnabled: { type: Boolean, default: true },
      withdrawEnabled: { type: Boolean, default: true },
      upiId: { type: String, default: "paytmqr5p0dyv@ptys" },
      upiName: { type: String, default: "7Cards Game" },
      qrEnabled: { type: Boolean, default: true },
      qrCodeUrl: { type: String, default: "" },
    },
  },
  { timestamps: true },
);

export const AdminConfig = mongoose.model<IAdminConfig>(
  "AdminConfig",
  AdminConfigSchema,
);

// Singleton helper — always returns the one config document
export async function getAdminConfig(): Promise<IAdminConfig> {
  let cfg = await AdminConfig.findOne();
  if (!cfg) cfg = await AdminConfig.create({});
  return cfg;
}
