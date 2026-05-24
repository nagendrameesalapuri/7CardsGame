import mongoose, { Document, Schema } from 'mongoose';

export type PlayerNoteType = 'info' | 'warning' | 'fraud_flag' | 'support' | 'investigation' | 'cleared';
export type PlayerRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface IPlayerNote extends Document {
  userId:     string;
  adminId:    string;
  adminName:  string;
  type:       PlayerNoteType;
  content:    string;
  createdAt:  Date;
}

export interface IPlayerFlag extends Document {
  userId:       string;
  riskLevel:    PlayerRiskLevel;
  riskScore:    number;          // 0–100
  fraudFlags:   string[];        // e.g. ['tie_farming', 'rapid_reconnect']
  isWatched:    boolean;
  isSuspended:  boolean;
  suspendedAt?: Date;
  suspendedBy?: string;
  suspendReason?: string;
  updatedAt:    Date;
}

const PlayerNoteSchema = new Schema<IPlayerNote>(
  {
    userId:    { type: String, required: true, index: true },
    adminId:   { type: String, required: true },
    adminName: { type: String, required: true },
    type:      { type: String, enum: ['info', 'warning', 'fraud_flag', 'support', 'investigation', 'cleared'], default: 'info' },
    content:   { type: String, required: true, maxlength: 2000 },
  },
  { timestamps: true },
);

const PlayerFlagSchema = new Schema<IPlayerFlag>(
  {
    userId:        { type: String, required: true, unique: true, index: true },
    riskLevel:     { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'low' },
    riskScore:     { type: Number, default: 0, min: 0, max: 100 },
    fraudFlags:    { type: [String], default: [] },
    isWatched:     { type: Boolean, default: false },
    isSuspended:   { type: Boolean, default: false },
    suspendedAt:   { type: Date },
    suspendedBy:   { type: String },
    suspendReason: { type: String },
  },
  { timestamps: true },
);

export const PlayerNote = mongoose.model<IPlayerNote>('PlayerNote', PlayerNoteSchema);
export const PlayerFlag = mongoose.model<IPlayerFlag>('PlayerFlag', PlayerFlagSchema);
