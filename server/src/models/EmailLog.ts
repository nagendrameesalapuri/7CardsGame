import { Schema, model, Document } from 'mongoose';

export interface IEmailLog extends Document {
  campaignId: string;
  trackingId: string;
  to: string;
  username: string;
  templateId: string;
  subject: string;
  target: string;
  sentAt: Date;
  opened: boolean;
  openedAt?: Date;
}

const emailLogSchema = new Schema<IEmailLog>({
  campaignId: { type: String, required: true, index: true },
  trackingId:  { type: String, required: true, unique: true, index: true },
  to:          { type: String, required: true },
  username:    { type: String, required: true },
  templateId:  { type: String, required: true },
  subject:     { type: String, required: true },
  target:      { type: String, required: true },
  sentAt:      { type: Date, default: Date.now },
  opened:      { type: Boolean, default: false },
  openedAt:    { type: Date },
});

export const EmailLog = model<IEmailLog>('EmailLog', emailLogSchema);
