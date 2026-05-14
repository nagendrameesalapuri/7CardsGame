import mongoose, { Document, Schema } from 'mongoose';

export interface ISupportTicket extends Document {
  userId: string;
  username: string;
  category: 'payment' | 'game' | 'account' | 'bug' | 'other';
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved';
  adminNote: string;
  adminReply: string;
  createdAt: Date;
  updatedAt: Date;
}

const SupportTicketSchema = new Schema<ISupportTicket>({
  userId:     { type: String, required: true, index: true },
  username:   { type: String, required: true },
  category:   { type: String, enum: ['payment', 'game', 'account', 'bug', 'other'], default: 'other' },
  subject:    { type: String, required: true, maxlength: 120 },
  message:    { type: String, required: true, maxlength: 2000 },
  status:     { type: String, enum: ['open', 'in_progress', 'resolved'], default: 'open' },
  adminNote:  { type: String, default: '' },
  adminReply: { type: String, default: '' },
}, { timestamps: true });

export const SupportTicket = mongoose.model<ISupportTicket>('SupportTicket', SupportTicketSchema);
