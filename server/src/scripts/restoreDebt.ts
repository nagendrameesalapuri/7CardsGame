import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
import mongoose from 'mongoose';
import { User } from '../models/User';
import { Transaction } from '../models/Transaction';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('[RestoreDebt] Connected');

  // Poornima had ₹94.30, got 3 extra refunds of ₹50 = ₹150 over-credited.
  // She spent it all, so correct balance = 94.30 - 150 = -55.70
  // We wrongly zeroed her wallet — restore the debt.
  const userId = '6a015912f1580c98d3ff378d';
  const user = await User.findById(userId).select('walletBalance username').lean() as any;
  console.log(`Current wallet for ${user?.username}: ₹${user?.walletBalance}`);

  if (user?.walletBalance !== 0) {
    console.log('Wallet is not 0 — skipping (already correct)');
    await mongoose.disconnect();
    return;
  }

  // Set to correct debt amount
  const debtAmount = -55.70;
  const updated = await User.findByIdAndUpdate(userId, { walletBalance: debtAmount }, { new: true });
  await Transaction.create({
    userId,
    type: 'system_rollback',
    amount: 55.70,
    status: 'completed',
    description: 'Debt restoration: wallet corrected to reflect over-refund debt (auto-clears on next deposit)',
    balanceBefore: 0,
    balanceAfter: debtAmount,
    heldBefore: 0,
    heldAfter: 0,
    metadata: { reason: 'debt_restoration', roomCode: '489I9G' },
  });

  console.log(`Wallet set to ₹${updated?.walletBalance} (debt — clears on next deposit) ✓`);
  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
