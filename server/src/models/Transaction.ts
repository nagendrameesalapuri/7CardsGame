import mongoose, { Document, Schema } from 'mongoose';

export type TransactionType =
  | 'deposit' | 'withdrawal' | 'winning' | 'entry_fee' | 'refund' | 'bonus'
  // New hold-system types
  | 'entry_hold'          // Entry fee placed on hold (no wallet deduction yet)
  | 'entry_released'      // Hold cancelled before game went LIVE (no balance change)
  | 'entry_locked'        // Hold converted to locked entry when game went LIVE
  | 'match_settlement'    // Prize credited after match completion
  | 'abandoned_resolution'// Match abandoned — holds released, noted in history
  | 'system_rollback';    // Admin/system rollback entry

export type TransactionStatus = 'pending' | 'completed' | 'failed';

export interface ITransaction extends Document {
  userId: string;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  description: string;
  balanceBefore: number;
  balanceAfter: number;
  heldBefore: number;
  heldAfter: number;
  metadata: {
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    roomCode?: string;
    withdrawalRequestId?: string;
    survivalTournamentId?: string;
    teamId?: string;
    matchState?: string;
    failReason?: string;
    releaseReason?: string;
    adminNote?: string;
    rollbackId?: string;
    linkedTransactionId?: string;
    exploitFlag?: boolean;
  };
  createdAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    userId:      { type: String, required: true, index: true },
    type:        {
      type: String,
      enum: [
        'deposit', 'withdrawal', 'winning', 'entry_fee', 'refund', 'bonus',
        'entry_hold', 'entry_released', 'entry_locked', 'match_settlement',
        'abandoned_resolution', 'system_rollback',
      ],
      required: true,
    },
    amount:      { type: Number, required: true, min: 0 },
    status:      { type: String, enum: ['pending', 'completed', 'failed'], default: 'completed' },
    description: { type: String, default: '' },
    balanceBefore: { type: Number, default: 0 },
    balanceAfter:  { type: Number, default: 0 },
    heldBefore:    { type: Number, default: 0 },
    heldAfter:     { type: Number, default: 0 },
    metadata:      { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const Transaction = mongoose.model<ITransaction>('Transaction', TransactionSchema);
