/**
 * One-off script: manually credit Poornima Panjagalla the prize she should have
 * received from the wager match in room FS0F0A (bug: room deleted before prize paid).
 *
 * Run from the server directory:
 *   npx ts-node scripts/credit-prize.ts
 *
 * Set PRIZE_AMOUNT env var to override (default ₹40 = 2 players × ₹20 entry fee):
 *   PRIZE_AMOUNT=40 npx ts-node scripts/credit-prize.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI!;
const PRIZE_AMOUNT = parseFloat(process.env.PRIZE_AMOUNT ?? '40');
const ROOM_CODE = 'FS0F0A';
const WINNER_USERNAME = 'Poornima Panjagalla';

const UserSchema = new mongoose.Schema({
  username: String,
  walletBalance: Number,
  isGuest: Boolean,
});

const TransactionSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  type: String,
  amount: Number,
  status: String,
  description: String,
  metadata: Object,
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model('User', UserSchema);
const Transaction = mongoose.model('Transaction', TransactionSchema);

async function main() {
  console.log('Connecting to MongoDB…');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.');

  const user = await User.findOne({ username: new RegExp(`^${WINNER_USERNAME}$`, 'i') });
  if (!user) {
    // Try partial match
    const users = await User.find({ username: new RegExp('Poornima', 'i') });
    if (users.length === 0) {
      console.error('❌  User not found. Check the username in the script.');
      process.exit(1);
    }
    console.log('Found possible matches:');
    users.forEach(u => console.log(`  - "${u.username}"  id=${u._id}  balance=₹${u.walletBalance}`));
    console.error('❌  Update WINNER_USERNAME in the script to one of the above and re-run.');
    process.exit(1);
  }

  const balanceBefore = user.walletBalance ?? 0;
  console.log(`Found: "${user.username}"  balance before = ₹${balanceBefore}`);

  // Check if prize was already credited to avoid double-pay
  const existing = await Transaction.findOne({
    userId: user._id,
    type: 'winning',
    'metadata.roomCode': ROOM_CODE,
  });
  if (existing) {
    console.warn('⚠️   A "winning" transaction for this room already exists — skipping to avoid double credit.');
    console.warn(`    Existing transaction: ₹${existing.amount} on ${existing.createdAt}`);
    await mongoose.disconnect();
    return;
  }

  const updated = await User.findByIdAndUpdate(
    user._id,
    { $inc: { walletBalance: PRIZE_AMOUNT } },
    { new: true },
  );

  await Transaction.create({
    userId: user._id,
    type: 'winning',
    amount: PRIZE_AMOUNT,
    status: 'completed',
    description: `Prize won — room ${ROOM_CODE} (manual credit — bug fix)`,
    metadata: { roomCode: ROOM_CODE, manualCredit: true },
  });

  console.log(`✅  Credited ₹${PRIZE_AMOUNT} to "${user.username}"`);
  console.log(`    Balance: ₹${balanceBefore} → ₹${updated?.walletBalance}`);

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
