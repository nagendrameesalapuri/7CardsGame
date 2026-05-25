/**
 * One-time recovery script: detect and reverse duplicate abandoned_resolution
 * refunds caused by the race condition during rolling deployment on 2026-05-25.
 *
 * Run: npx ts-node src/scripts/recoverDuplicateRefunds.ts
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import mongoose from 'mongoose';
import { User } from '../models/User';
import { Transaction } from '../models/Transaction';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('[Recovery] Connected to MongoDB');

  // Find all abandoned_resolution transactions grouped by (userId, roomCode)
  const txns = await Transaction.find({ type: 'abandoned_resolution', status: 'completed' })
    .sort({ createdAt: 1 })
    .lean();

  // Group by userId + roomCode
  const groups = new Map<string, typeof txns>();
  for (const t of txns) {
    const roomCode = (t.metadata as any)?.roomCode ?? 'unknown';
    const key = `${t.userId}_${roomCode}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  let totalRecovered = 0;
  for (const [key, list] of groups.entries()) {
    if (list.length <= 1) continue; // no duplicate

    const [userId, roomCode] = key.split('_');
    const entryFee = list[0].amount;
    const extraCount = list.length - 1;
    const deductAmount = entryFee * extraCount;

    console.log(`[Recovery] User ${userId}, room ${roomCode}: ${list.length} refunds found — deducting ₹${deductAmount} (${extraCount} extra)`);

    const userBefore = await User.findById(userId).select('walletBalance').lean() as any;
    if (!userBefore) {
      console.error(`  → User not found, skipping`);
      continue;
    }

    // Deduct full amount — wallet may go negative (debt), auto-cleared on next deposit
    const actualDeduct = deductAmount;
    const updated = await User.findByIdAndUpdate(
      userId,
      { $inc: { walletBalance: -actualDeduct } },
      { new: true },
    );
    if (!updated) {
      console.error(`  → Update failed, skipping`);
      continue;
    }
    if (updated.walletBalance < 0) {
      console.log(`  → Wallet went negative (₹${updated.walletBalance}) — debt will auto-clear on next deposit`);
    }

    await Transaction.create({
      userId,
      type: 'system_rollback',
      amount: actualDeduct,
      status: 'completed',
      description: `Correction: reversed ${extraCount} duplicate abandoned_resolution refund(s) for room ${roomCode}`,
      balanceBefore: userBefore.walletBalance,
      balanceAfter: updated.walletBalance,
      heldBefore: 0,
      heldAfter: 0,
      metadata: { roomCode, reason: 'duplicate_refund_recovery', extraCount },
    });

    console.log(`  → Wallet ₹${userBefore.walletBalance} → ₹${updated.walletBalance} ✓`);
    totalRecovered += actualDeduct;
  }

  console.log(`[Recovery] Done. Total recovered: ₹${totalRecovered}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('[Recovery] Failed:', err);
  process.exit(1);
});
