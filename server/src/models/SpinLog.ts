import mongoose, { Document, Schema } from 'mongoose';

export interface ISpinLog extends Document {
  userId: string;
  username: string;
  spinType: 'money' | 'points';
  isFree: boolean;
  costRupees: number;
  costPoints: number;
  prizeType: 'cash' | 'points' | 'xp' | 'none';
  prizeAmount: number;
  prizeLabel: string;
  prizeIcon: string;
  createdAt: Date;
}

const SpinLogSchema = new Schema<ISpinLog>(
  {
    userId:      { type: String, required: true, index: true },
    username:    { type: String, default: '' },
    spinType:    { type: String, enum: ['money', 'points'], required: true },
    isFree:      { type: Boolean, default: false },
    costRupees:  { type: Number, default: 0 },
    costPoints:  { type: Number, default: 0 },
    prizeType:   { type: String, enum: ['cash', 'points', 'xp', 'none'], default: 'none' },
    prizeAmount: { type: Number, default: 0 },
    prizeLabel:  { type: String, default: '' },
    prizeIcon:   { type: String, default: '' },
  },
  { timestamps: true }
);

SpinLogSchema.index({ userId: 1, createdAt: -1 });
SpinLogSchema.index({ spinType: 1, createdAt: -1 });

export const SpinLog = mongoose.model<ISpinLog>('SpinLog', SpinLogSchema);
