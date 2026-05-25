import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
import mongoose from 'mongoose';
import { User } from '../models/User';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const users = await User.find({
    _id: { $in: ['6a015912f1580c98d3ff378d', '6a00554106c920bf82ee076e'] }
  }).select('username walletBalance').lean() as any[];
  users.forEach(u => console.log(`${u.username}: ₹${u.walletBalance}`));
  await mongoose.disconnect();
}
run().catch(console.error);
