import { v4 as uuidv4 } from 'uuid';
import { User } from '../models/User';
import { Transaction } from '../models/Transaction';
import { sendReengagementEmail } from '../services/mailer';

const COMEBACK_BONUS = 30;
const INACTIVE_DAYS = 7;
const EMAIL_COOLDOWN_DAYS = 7; // don't email same user more than once per week

async function runReengagementJob(): Promise<void> {
  const now = new Date();
  const inactiveCutoff = new Date(now.getTime() - INACTIVE_DAYS * 24 * 60 * 60 * 1000);
  const emailCooloff   = new Date(now.getTime() - EMAIL_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);

  // Find non-guest users with email who haven't played in 7+ days
  // and haven't received a re-engagement email in the last 7 days
  const inactiveUsers = await User.find({
    isGuest: false,
    isBanned: false,
    email: { $exists: true, $ne: null },
    emailUnsubscribed: { $ne: true },
    lastSeenAt: { $lte: inactiveCutoff },
    $or: [
      { lastReengagementEmailAt: { $exists: false } },
      { lastReengagementEmailAt: { $lte: emailCooloff } },
    ],
  }).select('_id email username walletBalance stats lastSeenAt unsubscribeToken').lean();

  if (inactiveUsers.length === 0) {
    console.log('[Reengagement] No inactive users to email.');
    return;
  }

  console.log(`[Reengagement] Found ${inactiveUsers.length} inactive users — sending emails...`);

  let sent = 0;
  let failed = 0;

  for (const user of inactiveUsers) {
    try {
      const daysSinceLastSeen = user.lastSeenAt
        ? Math.floor((now.getTime() - new Date(user.lastSeenAt).getTime()) / (1000 * 60 * 60 * 24))
        : INACTIVE_DAYS;

      // Get total wallet winnings from winning transactions
      const winningTxns = await Transaction.aggregate([
        { $match: { userId: String(user._id), type: { $in: ['winning', 'match_settlement', 'tournament_prize'] }, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);
      const totalWinnings = winningTxns[0]?.total ?? 0;

      // Ensure user has an unsubscribe token (lazy generation)
      let unsubToken = (user as any).unsubscribeToken as string | undefined;
      if (!unsubToken) {
        unsubToken = uuidv4();
        await User.findByIdAndUpdate(user._id, { unsubscribeToken: unsubToken });
      }

      await sendReengagementEmail({
        email:             user.email!,
        username:          user.username,
        daysSinceLastSeen,
        totalWinnings,
        gamesWon:          user.stats?.gamesWon   ?? 0,
        gamesPlayed:       user.stats?.gamesPlayed ?? 0,
        comebackBonus:     COMEBACK_BONUS,
        unsubscribeToken:  unsubToken,
        upcomingTournament: null,
      });

      // Mark email sent so we don't spam
      await User.findByIdAndUpdate(user._id, { lastReengagementEmailAt: now });
      sent++;
    } catch (err) {
      console.error(`[Reengagement] Failed to email ${user.email}:`, err);
      failed++;
    }
  }

  console.log(`[Reengagement] Done — ${sent} sent, ${failed} failed.`);
}

export function startReengagementScheduler(): void {
  // Run once at startup (after 1 min delay to let DB settle)
  setTimeout(() => {
    runReengagementJob().catch(err => console.error('[Reengagement] startup run error:', err));
  }, 60_000);

  // Then run every 24 hours
  setInterval(() => {
    runReengagementJob().catch(err => console.error('[Reengagement] scheduled run error:', err));
  }, 24 * 60 * 60 * 1000);
}
