/**
 * Seed 100 dummy users into the users collection.
 * Safe to run multiple times — uses upsert on username so existing dummies
 * are updated rather than duplicated.
 *
 * Run from the server directory:
 *   npx ts-node scripts/seed-users.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI!;

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  console.log('Connecting to MongoDB…');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.\n');

  const col = mongoose.connection.db!.collection('users');

  let upserted = 0;
  let updated = 0;

  const avatars = Array.from({ length: 10 }, (_, i) => `avatar_${i}`);

  const FIRST_NAMES = [
    'Aarav','Arjun','Rohan','Vikas','Raj','Amit','Karan','Vikram','Ravi','Sahil',
    'Anil','Sunil','Deepak','Sandeep','Rohit','Akash','Gautam','Kunal','Nikhil','Harsh',
    'Priya','Ananya','Neha','Deepika','Kavya','Meenakshi','Shreya','Ritu','Sneha','Pooja',
    'Lakshmi','Sonia','Simran','Isha','Divya','Pallavi','Tanvi','Mihika','Aisha','Tanya'
  ];

  const LAST_NAMES = [
    'Sharma','Patel','Singh','Reddy','Kumar','Mehta','Gupta','Iyer','Das','Pillai',
    'Joshi','Bhatia','Chandra','Khan','Kapoor','Nair','Rao','Kulkarni','Mishra','Verma',
    'Tiwari','Srivastava','Saxena','Sinha','Bose','Ghosh','Roy','Chopra','Malhotra','Trivedi'
  ];

  const used = new Set<string>();

  function makeUsername() {
    for (let attempts = 0; attempts < 20; attempts++) {
      const f = FIRST_NAMES[randInt(0, FIRST_NAMES.length - 1)];
      const l = LAST_NAMES[randInt(0, LAST_NAMES.length - 1)];
      const name = `${f}${l}`;
      if (!used.has(name)) {
        used.add(name);
        return name;
      }
    }
    // fallback: append random number until unique
    let base = `User${randInt(1000, 9999)}`;
    while (used.has(base)) base = `User${randInt(1000, 9999)}`;
    used.add(base);
    return base;
  }

  for (let i = 1; i <= 100; i++) {
    const username = makeUsername();
    const avatar = avatars[i % avatars.length];
    const wins = randInt(0, 150);
    const played = wins + randInt(0, 100);
    const rp = played * randInt(5, 15);
    const rw = Math.min(rp, Math.max(0, Math.floor(rp * (0.3 + Math.random() * 0.5))));

    const doc = {
      avatar,
      isGuest: false,
      isBanned: false,
      walletBalance: randInt(0, 500),
      stats: {
        gamesPlayed: played,
        gamesWon: wins,
        roundsPlayed: rp,
        roundsWon: rw,
        totalPointsEarned: rw * 10,
        showAttempts: randInt(0, 30),
        showSuccesses: randInt(0, 20),
      },
    };

    const result = await col.updateOne(
      { username, isGuest: false },
      {
        $set: doc,
        $setOnInsert: { friends: [], createdAt: new Date() },
      },
      { upsert: true },
    );

    if (result.upsertedCount > 0) {
      upserted++;
      console.log(`  ✅ Created  ${username}`);
    } else {
      updated++;
      console.log(`  🔄 Updated  ${username}`);
    }
  }

  console.log(`\nDone. Created: ${upserted}  Updated: ${updated}`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
