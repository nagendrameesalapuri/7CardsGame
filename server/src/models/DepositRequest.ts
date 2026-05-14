import mongoose, { Document, Schema } from 'mongoose';

export type DepositStatus = 'pending' | 'approved' | 'rejected';

export interface IDepositRequest extends Document {
  userId: string;
  username: string;
  amount: number;
  utrNumber: string;
  status: DepositStatus;
  adminNote?: string;
  processedAt?: Date;
  createdAt: Date;
}

const DepositRequestSchema = new Schema<IDepositRequest>(
  {
    userId:      { type: String, required: true, index: true },
    username:    { type: String, required: true },
    amount:      { type: Number, required: true, min: 1 },
    utrNumber:   { type: String, required: true },
    status:      { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    adminNote:   { type: String },
    processedAt: { type: Date },
  },
  { timestamps: true }
);

export const DepositRequest = mongoose.model<IDepositRequest>('DepositRequest', DepositRequestSchema);
