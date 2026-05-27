import { User } from '../models/User';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I ambiguity

export async function generateUniqueReferralCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)];
    const exists = await User.findOne({ referralCode: code }).select('_id').lean();
    if (!exists) return code;
  }
  // Fallback: timestamp-based, guaranteed unique enough
  return Date.now().toString(36).slice(-6).toUpperCase();
}

export const REFERRAL_REWARD_REFERRER = 50; // ₹ for the person who shared the code
export const REFERRAL_REWARD_REFERRED = 30; // ₹ bonus for the new user
