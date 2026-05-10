/**
 * One-time reset script: deletes all Game documents and zeroes all User stats.
 * Run from the server directory:
 *   npx ts-node scripts/reset-data.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI!;

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.');

  const db = mongoose.connection.db!;

  // Delete all game records
  const gamesResult = await db.collection('games').deleteMany({});
  console.log(`Deleted ${gamesResult.deletedCount} game(s).`);

  // Delete all rooms
  const roomsResult = await db.collection('rooms').deleteMany({});
  console.log(`Deleted ${roomsResult.deletedCount} room(s).`);

  // Reset all user stats to zero
  const usersResult = await db.collection('users').updateMany(
    {},
    {
      $set: {
        'stats.gamesPlayed': 0,
        'stats.gamesWon': 0,
        'stats.roundsPlayed': 0,
        'stats.roundsWon': 0,
        'stats.totalPointsEarned': 0,
        'stats.showAttempts': 0,
        'stats.showSuccesses': 0,
      },
    }
  );
  console.log(`Reset stats for ${usersResult.modifiedCount} user(s).`);

  await mongoose.disconnect();
  console.log('Done. All game history cleared, all user stats reset to zero.');
}

main().catch(err => {
  console.error('Reset failed:', err);
  process.exit(1);
});
