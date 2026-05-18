import mongoose, { Document, Schema } from 'mongoose';

export interface INotificationBroadcast extends Document {
  title: string;
  message: string;
  category: string;
  type: string;
  actionUrl?: string;
  targetType: 'global' | 'targeted' | 'inactive';
  intendedCount: number;
  deliveredCount: number;
  readCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationBroadcastSchema = new Schema<INotificationBroadcast>(
  {
    title:          { type: String, required: true },
    message:        { type: String, required: true },
    category:       { type: String, default: 'system' },
    type:           { type: String, enum: ['info', 'warning', 'success'], default: 'info' },
    actionUrl:      { type: String },
    targetType:     { type: String, enum: ['global', 'targeted', 'inactive'], required: true },
    intendedCount:  { type: Number, default: 0 },
    deliveredCount: { type: Number, default: 0 },
    readCount:      { type: Number, default: 0 },
  },
  { timestamps: true }
);

NotificationBroadcastSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const NotificationBroadcast = mongoose.model<INotificationBroadcast>(
  'NotificationBroadcast',
  NotificationBroadcastSchema
);
