import mongoose, { Document, Schema } from 'mongoose';

export interface INotificationPreference extends Document {
  userId: string;
  tournament: boolean;
  boss_arena: boolean;
  rewards: boolean;
  daily_missions: boolean;
  survival_streak: boolean;
  multiplayer: boolean;
  events: boolean;
  system: boolean;
  // Throttle tracking — last sent per category (ISO string)
  lastSent: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationPreferenceSchema = new Schema<INotificationPreference>(
  {
    userId:          { type: String, required: true, unique: true, index: true },
    tournament:      { type: Boolean, default: true },
    boss_arena:      { type: Boolean, default: true },
    rewards:         { type: Boolean, default: true },
    daily_missions:  { type: Boolean, default: true },
    survival_streak: { type: Boolean, default: true },
    multiplayer:     { type: Boolean, default: true },
    events:          { type: Boolean, default: true },
    system:          { type: Boolean, default: true },
    lastSent:        { type: Map, of: String, default: {} },
  },
  { timestamps: true }
);

export const NotificationPreference = mongoose.model<INotificationPreference>(
  'NotificationPreference',
  NotificationPreferenceSchema
);
