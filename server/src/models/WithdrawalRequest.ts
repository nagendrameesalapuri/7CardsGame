import mongoose, { Document, Schema } from 'mongoose';

export type WithdrawalStatus = 'pending' | 'approved' | 'rejected';

export interface IWithdrawalRequest extends Document {
  userId: string;
  username: string;
  amount: number;
  upiId?: string;
  bankDetails?: {
    accountNumber: string;
    ifsc: string;
    accountName: string;
  };
  status: WithdrawalStatus;
  adminNote?: string;
  processedAt?: Date;
  razorpayPayoutId?: string;
  payoutStatus?: 'queued' | 'processing' | 'processed' | 'failed';
  createdAt: Date;
}

const WithdrawalRequestSchema = new Schema<IWithdrawalRequest>(
  {
    userId:           { type: String, required: true, index: true },
    username:         { type: String, required: true },
    amount:           { type: Number, required: true, min: 1 },
    upiId:            { type: String },
    bankDetails: {
      accountNumber:  { type: String },
      ifsc:           { type: String },
      accountName:    { type: String },
    },
    status:           { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    adminNote:        { type: String },
    processedAt:      { type: Date },
    razorpayPayoutId: { type: String },
    payoutStatus:     { type: String, enum: ['queued', 'processing', 'processed', 'failed'] },
  },
  { timestamps: true }
);

export const WithdrawalRequest = mongoose.model<IWithdrawalRequest>('WithdrawalRequest', WithdrawalRequestSchema);
