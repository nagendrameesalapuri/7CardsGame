/**
 * Seed 20 dummy players into the leaderboard for demo/showcase purposes.
 * Safe to run multiple times — uses upsert on username so existing dummies
 * are updated rather than duplicated.
 *
 * Run from the server directory:
 *   npx ts-node scripts/seed-leaderboard.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI!;

// 20 dummy players: name, avatar index (0-9), wins, played, roundsPlayed, roundsWon, shows, showWins
const PLAYERS = [
  // ── Top tier ─────────────────────────────────────────────────────────────
  { username: 'RajeshKumar',    avatar: 'avatar_1', wins: 184, played: 230, rp: 1840, rw: 1380, sa: 92, sw: 71 },
  { username: 'PriyaSharma',    avatar: 'avatar_4', wins: 152, played: 198, rp: 1584, rw: 1140, sa: 76, sw: 58 },
  { username: 'ArjunReddy',     avatar: 'avatar_2', wins: 127, played: 171, rp: 1270, rw: 889,  sa: 63, sw: 47 },

  // ── Mid tier ─────────────────────────────────────────────────────────────
  { username: 'SunitaVerma',    avatar: 'avatar_6', wins: 98,  played: 152, rp: 912,  rw: 638,  sa: 49, sw: 34 },
  { username: 'VikramSingh',    avatar: 'avatar_0', wins: 87,  played: 140, rp: 870,  rw: 609,  sa: 43, sw: 30 },
  { username: 'DeepikaNair',    avatar: 'avatar_8', wins: 76,  played: 130, rp: 760,  rw: 532,  sa: 38, sw: 26 },
  { username: 'AmitPatel',      avatar: 'avatar_3', wins: 71,  played: 120, rp: 710,  rw: 497,  sa: 35, sw: 24 },
  { username: 'KavyaMenon',     avatar: 'avatar_7', wins: 65,  played: 112, rp: 650,  rw: 455,  sa: 32, sw: 21 },
  { username: 'SandeepRao',     avatar: 'avatar_5', wins: 59,  played: 105, rp: 590,  rw: 413,  sa: 29, sw: 19 },
  { username: 'MeenakshiIyer',  avatar: 'avatar_9', wins: 52,  played:  98, rp: 520,  rw: 364,  sa: 26, sw: 17 },

  // ── Lower-mid tier ───────────────────────────────────────────────────────
  { username: 'RohitMishra',    avatar: 'avatar_2', wins: 44,  played:  90, rp: 440,  rw: 308,  sa: 22, sw: 14 },
  { username: 'AnanyaDas',      avatar: 'avatar_6', wins: 39,  played:  82, rp: 390,  rw: 273,  sa: 19, sw: 12 },
  { username: 'SureshGupta',    avatar: 'avatar_0', wins: 33,  played:  75, rp: 330,  rw: 231,  sa: 16, sw: 10 },
  { username: 'LakshmiPillai',  avatar: 'avatar_4', wins: 28,  played:  68, rp: 280,  rw: 196,  sa: 14, sw:  8 },
  { username: 'ManojTiwari',    avatar: 'avatar_1', wins: 23,  played:  60, rp: 230,  rw: 161,  sa: 11, sw:  7 },

  // ── Casual tier ──────────────────────────────────────────────────────────
  { username: 'NehaBhatia',     avatar: 'avatar_8', wins: 18,  played:  52, rp: 180,  rw: 126,  sa:  9, sw:  5 },
  { username: 'GautamJoshi',    avatar: 'avatar_3', wins: 14,  played:  44, rp: 140,  rw:  98,  sa:  7, sw:  4 },
  { username: 'RituChandra',    avatar: 'avatar_7', wins:  9,  played:  35, rp:  90,  rw:  63,  sa:  4, sw:  2 },
  { username: 'AkashMehta',     avatar: 'avatar_5', wins:  5,  played:  25, rp:  50,  rw:  35,  sa:  2, sw:  1 },
  { username: 'ShreyaKulkarni', avatar: 'avatar_9', wins:  3,  played:  18, rp:  30,  rw:  21,  sa:  1, sw:  0 },
];

async function main() {
  console.log('Connecting to MongoDB…');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.\n');

  const col = mongoose.connection.db!.collection('users');

  let upserted = 0;
  let updated  = 0;

  for (const p of PLAYERS) {
    const result = await col.updateOne(
      { username: p.username, isGuest: false },
      {
        $set: {
          avatar:        p.avatar,
          isGuest:       false,
          isBanned:      false,
          walletBalance: 0,
          'stats.gamesPlayed':       p.played,
          'stats.gamesWon':          p.wins,
          'stats.roundsPlayed':      p.rp,
          'stats.roundsWon':         p.rw,
          'stats.totalPointsEarned': p.rw * 10,
          'stats.showAttempts':      p.sa,
          'stats.showSuccesses':     p.sw,
        },
        $setOnInsert: {
          friends:   [],
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );

    if (result.upsertedCount > 0) {
      console.log(`  ✅ Created  ${p.username.padEnd(20)} — ${p.wins} wins / ${p.played} played`);
      upserted++;
    } else {
      console.log(`  🔄 Updated  ${p.username.padEnd(20)} — ${p.wins} wins / ${p.played} played`);
      updated++;
    }
  }

  console.log(`\nDone. Created: ${upserted}  Updated: ${updated}`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
