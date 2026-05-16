import mongoose, { Document, Schema } from 'mongoose';

export type WithdrawalStatus = 'pending' | 'approved' | 'delivered' | 'rejected';

export interface IWithdrawalRequest extends Document {
  userId: string;
  username: string;
  amount: number;
  // Legacy bank/UPI fields
  upiId?: string;
  bankDetails?: {
    accountNumber: string;
    ifsc: string;
    accountName: string;
  };
  // New reward redemption fields
  redemptionType: 'bank' | 'voucher';
  voucherBrand?: string;           // preferred delivery brand
  // Admin fills these on delivery
  deliveredVoucherNumber?: string;
  deliveredVoucherPin?: string;
  deliveredVoucherExpiry?: string;
  adminMessage?: string;
  // Status
  status: WithdrawalStatus;
  adminNote?: string;
  processedAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
}

const WithdrawalRequestSchema = new Schema<IWithdrawalRequest>(
  {
    userId:           { type: String, required: true, index: true },
    username:         { type: String, required: true },
    amount:           { type: Number, required: true, min: 1 },
    // Legacy
    upiId:            { type: String },
    bankDetails: {
      accountNumber: { type: String },
      ifsc:          { type: String },
      accountName:   { type: String },
    },
    // Redemption
    redemptionType:           { type: String, enum: ['bank', 'voucher'], default: 'bank' },
    voucherBrand:             { type: String },
    deliveredVoucherNumber:   { type: String },
    deliveredVoucherPin:      { type: String },
    deliveredVoucherExpiry:   { type: String },
    adminMessage:             { type: String },
    // Status
    status:       { type: String, enum: ['pending', 'approved', 'delivered', 'rejected'], default: 'pending' },
    adminNote:    { type: String },
    processedAt:  { type: Date },
    deliveredAt:  { type: Date },
  },
  { timestamps: true }
);

export const WithdrawalRequest = mongoose.model<IWithdrawalRequest>('WithdrawalRequest', WithdrawalRequestSchema);
