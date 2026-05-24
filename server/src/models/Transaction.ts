import mongoose, { Document, Schema } from 'mongoose';

export type TransactionType = 'deposit' | 'withdrawal' | 'winning' | 'entry_fee' | 'refund' | 'bonus';
export type TransactionStatus = 'pending' | 'completed' | 'failed';

export interface ITransaction extends Document {
  userId: string;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  description: string;
  balanceBefore: number;
  balanceAfter: number;
  metadata: {
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    roomCode?: string;
    withdrawalRequestId?: string;
  };
  createdAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    userId:        { type: String, required: true, index: true },
    type:          { type: String, enum: ['deposit', 'withdrawal', 'winning', 'entry_fee', 'refund', 'bonus'], required: true },
    amount:        { type: Number, required: true, min: 0 },
    status:        { type: String, enum: ['pending', 'completed', 'failed'], default: 'completed' },
    description:   { type: String, default: '' },
    balanceBefore: { type: Number, default: 0 },
    balanceAfter:  { type: Number, default: 0 },
    metadata:      { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const Transaction = mongoose.model<ITransaction>('Transaction', TransactionSchema);
