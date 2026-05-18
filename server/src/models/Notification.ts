import mongoose, { Document, Schema } from 'mongoose';

export type NotificationCategory =
  | 'tournament'
  | 'boss_arena'
  | 'rewards'
  | 'daily_missions'
  | 'multiplayer'
  | 'survival_streak'
  | 'events'
  | 'system';

export interface INotification extends Document {
  userId: string;
  title: string;
  message: string;
  category: NotificationCategory;
  type: 'info' | 'warning' | 'success';
  actionUrl?: string;
  read: boolean;
  sentViaFCM: boolean;
  broadcastId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId:     { type: String, required: true, index: true },
    title:      { type: String, required: true },
    message:    { type: String, required: true },
    category:   {
      type: String,
      enum: ['tournament', 'boss_arena', 'rewards', 'daily_missions', 'multiplayer', 'survival_streak', 'events', 'system'],
      required: true,
    },
    type:       { type: String, enum: ['info', 'warning', 'success'], default: 'info' },
    actionUrl:  { type: String },
    read:        { type: Boolean, default: false },
    sentViaFCM:  { type: Boolean, default: false },
    broadcastId: { type: String, index: true },
  },
  { timestamps: true }
);

// Auto-expire notifications older than 30 days
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
