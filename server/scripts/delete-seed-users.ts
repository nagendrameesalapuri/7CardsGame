/**
 * Deletes all seeded dummy users (avatar_0 … avatar_9, no googleId/guestToken).
 * Run: npx ts-node scripts/delete-seed-users.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected.');

  const col = mongoose.connection.db!.collection('users');

  // Seed users: avatar matches avatar_0..avatar_9, no Google/guest login
  const result = await col.deleteMany({
    avatar: { $regex: /^avatar_\d+$/ },
    googleId: { $exists: false },
    guestToken: { $exists: false },
  });

  console.log(`Deleted ${result.deletedCount} seeded users.`);
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
