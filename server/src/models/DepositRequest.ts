import mongoose, { Document, Schema } from 'mongoose';

export type DepositStatus = 'pending' | 'approved' | 'rejected';

export interface IDepositRequest extends Document {
  userId: string;
  username: string;
  amount: number;
  // Legacy UTR flow
  utrNumber?: string;
  // New voucher flow
  voucherBrand?: string;
  voucherNumber?: string;        // full number stored, displayed masked
  voucherPin?: string;           // stored as plain (admin sees it)
  voucherHash?: string;          // sha256(brand+number+pin) for dedup
  voucherExpiry?: string;        // MM/YY string
  screenshotUrl?: string;
  submissionType: 'utr' | 'voucher';
  status: DepositStatus;
  adminNote?: string;
  processedAt?: Date;
  createdAt: Date;
}

const DepositRequestSchema = new Schema<IDepositRequest>(
  {
    userId:          { type: String, required: true, index: true },
    username:        { type: String, required: true },
    amount:          { type: Number, required: true, min: 1 },
    // Legacy
    utrNumber:       { type: String },
    // Voucher fields
    voucherBrand:    { type: String },
    voucherNumber:   { type: String },
    voucherPin:      { type: String },
    voucherHash:     { type: String, index: true, sparse: true },
    voucherExpiry:   { type: String },
    screenshotUrl:   { type: String },
    submissionType:  { type: String, enum: ['utr', 'voucher'], default: 'utr' },
    // Status
    status:          { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    adminNote:       { type: String },
    processedAt:     { type: Date },
  },
  { timestamps: true }
);

export const DepositRequest = mongoose.model<IDepositRequest>('DepositRequest', DepositRequestSchema);
