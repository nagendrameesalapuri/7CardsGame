import mongoose, { Document, Schema } from 'mongoose';

export type AnnouncementType = 'banner' | 'marquee' | 'popup';

export interface IAnnouncement extends Document {
  message: string;
  type: AnnouncementType;
  active: boolean;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AnnouncementSchema = new Schema<IAnnouncement>(
  {
    message:   { type: String, required: true, maxlength: 500 },
    type:      { type: String, enum: ['banner', 'marquee', 'popup'], default: 'banner' },
    active:    { type: Boolean, default: true },
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

AnnouncementSchema.index({ active: 1, createdAt: -1 });

export const Announcement = mongoose.model<IAnnouncement>('Announcement', AnnouncementSchema);
