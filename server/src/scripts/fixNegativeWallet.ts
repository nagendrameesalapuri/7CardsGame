import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
import mongoose from 'mongoose';
import { User } from '../models/User';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('[Fix] Connected');

  const negativeUsers = await User.find({ walletBalance: { $lt: 0 } }).lean() as any[];
  console.log(`[Fix] Found ${negativeUsers.length} user(s) with negative wallet`);

  for (const u of negativeUsers) {
    await User.findByIdAndUpdate(u._id, { walletBalance: 0 });
    console.log(`[Fix] Reset ${u.username} (${u._id}) wallet: ₹${u.walletBalance} → ₹0`);
  }

  console.log('[Fix] Done');
  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
