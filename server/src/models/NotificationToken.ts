import mongoose, { Document, Schema } from 'mongoose';

export type DeviceType = 'web' | 'android' | 'ios';

export interface INotificationToken extends Document {
  userId: string;
  fcmToken: string;
  deviceType: DeviceType;
  userAgent?: string;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationTokenSchema = new Schema<INotificationToken>(
  {
    userId:       { type: String, required: true, index: true },
    fcmToken:     { type: String, required: true, unique: true },
    deviceType:   { type: String, enum: ['web', 'android', 'ios'], default: 'web' },
    userAgent:    { type: String },
    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Compound index for fast per-user token lookups
NotificationTokenSchema.index({ userId: 1, fcmToken: 1 });

export const NotificationToken = mongoose.model<INotificationToken>(
  'NotificationToken',
  NotificationTokenSchema
);
