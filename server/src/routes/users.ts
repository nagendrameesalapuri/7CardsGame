import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { User } from '../models/User';
import { Game } from '../models/Game';
import { Transaction } from '../models/Transaction';
import { DepositRequest } from '../models/DepositRequest';
import { generateUniqueReferralCode } from '../utils/referral';
import { getOnlineUserIds } from '../socket';

const router = Router();

// Admin: reset all user stats (clears leaderboard)
// Call: POST /api/users/admin/reset-stats  with header  x-admin-key: <ADMIN_SECRET env var>
router.post('/admin/reset-stats', async (req: Request, res: Response) => {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.headers['x-admin-key'] !== secret) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const result = await User.updateMany({}, {
      $set: {
        'stats.gamesPlayed': 0,
        'stats.gamesWon': 0,
        'stats.roundsPlayed': 0,
        'stats.roundsWon': 0,
        'stats.totalPointsEarned': 0,
        'stats.showAttempts': 0,
        'stats.showSuccesses': 0,
      },
    });
    res.json({ message: `Cleared stats for ${result.modifiedCount} users` });
  } catch {
    res.status(500).json({ error: 'Failed to reset stats' });
  }
});

// Search users by username (for invite-to-room feature)
router.get('/search', requireAuth, async (req: Request, res: Response) => {
  try {
    const q     = String(req.query.q ?? '').trim();
    const limit = Math.min(30, parseInt(String(req.query.limit ?? '20'), 10));

    const filter: Record<string, any> = {
      isGuest: false,
      _id: { $ne: req.user!.id },
    };
    if (q) filter.username = { $regex: q, $options: 'i' };

    const users = await User.find(filter)
      .select('_id username avatar')
      .sort({ username: 1 })
      .limit(limit)
      .lean();

    res.json({ users: users.map(u => ({ id: u._id, username: u.username, avatar: u.avatar })) });
  } catch {
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Leaderboard
router.get('/leaderboard', async (_req: Request, res: Response) => {
  try {
    const users = await User.find({ 'stats.gamesPlayed': { $gt: 0 } })
      .select('username avatar stats isGuest')
      .sort({ 'stats.gamesWon': -1, 'stats.gamesPlayed': -1 })
      .limit(50)
      .lean();

    res.json({ leaderboard: users.map((u, i) => ({
      rank: i + 1,
      id: u._id,
      username: u.username,
      avatar: u.avatar,
      isGuest: u.isGuest,
      gamesWon: u.stats.gamesWon,
      gamesPlayed: u.stats.gamesPlayed,
      winRate: u.stats.gamesPlayed > 0
        ? Math.round((u.stats.gamesWon / u.stats.gamesPlayed) * 100)
        : 0,
    })) });
  } catch {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Public profile
router.get('/:id/profile', async (req: Request, res: Response) => {
  try {
    const uid = req.params.id;
    const user = await User.findById(uid).select('-guestToken -googleId').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Fetch all finished games for this player to compute accurate per-round stats
    const allGames = await Game.find({ 'players.userId': uid, status: 'finished' })
      .select('rounds roundCount winnerId players startedAt endedAt entryFee')
      .sort({ endedAt: -1 })
      .lean();

    // Compute stats missing from User.stats (showAttempts, showSuccesses, roundsWon)
    let roundsWon = 0, showAttempts = 0, showSuccesses = 0;
    for (const g of allGames) {
      for (const r of (g.rounds ?? [])) {
        if ((r as any).winnerId === uid) roundsWon++;
        if ((r as any).showPlayerId === uid) {
          showAttempts++;
          if ((r as any).showPlayerWon) showSuccesses++;
        }
      }
    }

    const recentGames = allGames.slice(0, 10);
    const isOnline = getOnlineUserIds().has(uid);

    res.json({
      user: {
        ...user,
        isOnline,
        stats: {
          ...(user as any).stats,
          roundsWon,
          showAttempts,
          showSuccesses,
        },
      },
      recentGames,
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Get own favorites list (enriched with lastSeenAt + isOnline)
router.get('/favorites', requireAuth, async (req: Request, res: Response) => {
  try {
    const me = await User.findById(req.user!.id).select('favorites').lean();
    if (!me) return res.status(404).json({ error: 'User not found' });
    const favs: any[] = (me as any).favorites ?? [];
    if (favs.length === 0) return res.json({ favorites: [] });

    const onlineIds = getOnlineUserIds();
    const ids = favs.map((f: any) => f.userId);
    const users = await User.find({ _id: { $in: ids } }).select('_id lastSeenAt').lean() as any[];
    const userMap = new Map(users.map((u: any) => [u._id.toString(), u]));

    const enriched = favs.map((f: any) => {
      const uid = f.userId?.toString();
      const u = userMap.get(uid);
      return {
        userId: f.userId,
        username: f.username,
        avatar: f.avatar,
        addedAt: f.addedAt,
        lastSeenAt: u?.lastSeenAt ?? null,
        isOnline: onlineIds.has(uid),
      };
    });

    res.json({ favorites: enriched });
  } catch {
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

// Add a player to favorites
router.post('/favorites/:targetId', requireAuth, async (req: Request, res: Response) => {
  try {
    const me = req.user!.id;
    const targetId = req.params.targetId;
    if (me === targetId) return res.status(400).json({ error: 'Cannot favorite yourself' });

    const target = await User.findById(targetId).select('username avatar isGuest').lean();
    if (!target) return res.status(404).json({ error: 'Player not found' });

    // $addToSet prevents duplicates by userId
    await User.updateOne(
      { _id: me, 'favorites.userId': { $ne: targetId } },
      { $push: { favorites: { userId: targetId, username: target.username, avatar: target.avatar, addedAt: new Date() } } }
    );

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to add favorite' });
  }
});

// Remove a player from favorites
router.delete('/favorites/:targetId', requireAuth, async (req: Request, res: Response) => {
  try {
    await User.updateOne(
      { _id: req.user!.id },
      { $pull: { favorites: { userId: req.params.targetId } } }
    );
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
});

// Update own profile
router.patch('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const { username, avatar, selectedBadgeId } = req.body as {
      username?: string;
      avatar?: string;
      selectedBadgeId?: string | null;
    };
    const updates: Record<string, unknown> = {};

    if (username) {
      if (username.length < 2 || username.length > 20) {
        return res.status(400).json({ error: 'Username must be 2–20 characters' });
      }
      updates.username = username.trim();
    }

    if (avatar) updates.avatar = avatar;

    if (selectedBadgeId !== undefined) {
      updates.selectedBadgeId = selectedBadgeId ?? null;
    }

    const user = await User.findByIdAndUpdate(req.user!.id, updates, { new: true })
      .select('-guestToken');

    res.json({ user });
  } catch {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ── GET /api/users/referral — own referral info ───────────────────────────────
router.get('/referral', requireAuth, async (req: Request, res: Response) => {
  try {
    if (req.user!.isGuest) return res.status(403).json({ error: 'Guests cannot use referrals' });

    let user = await User.findById(req.user!.id)
      .select('referralCode referredBy referralRewardPaid referralCount')
      .lean() as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Backfill code for existing users who signed up before this feature
    if (!user.referralCode) {
      const code = await generateUniqueReferralCode();
      await User.updateOne({ _id: req.user!.id }, { $set: { referralCode: code } });
      user.referralCode = code;
    }

    const baseUrl = process.env.CLIENT_URL ?? 'https://arenaofsevens.com';
    res.json({
      referralCode:       user.referralCode,
      referralLink:       `${baseUrl}/?ref=${user.referralCode}`,
      referralCount:      user.referralCount  ?? 0,
      referralRewardPaid: user.referralRewardPaid ?? false,
      referredBy:         user.referredBy ?? null,
    });
  } catch (err) {
    console.error('[Referral] get error:', err);
    res.status(500).json({ error: 'Failed to load referral info' });
  }
});

// ── POST /api/users/referral/apply — apply a referral code ───────────────────
router.post('/referral/apply', requireAuth, async (req: Request, res: Response) => {
  try {
    if (req.user!.isGuest) return res.status(403).json({ error: 'Guests cannot use referral codes' });

    const { code } = req.body as { code?: string };
    if (!code || code.trim().length < 4) {
      return res.status(400).json({ error: 'Enter a valid referral code' });
    }
    const normalizedCode = code.trim().toUpperCase();

    const me = await User.findById(req.user!.id)
      .select('referredBy referralCode')
      .lean() as any;
    if (!me) return res.status(404).json({ error: 'User not found' });
    if (me.referredBy) return res.status(400).json({ error: 'You have already applied a referral code' });
    if (me.referralCode === normalizedCode) return res.status(400).json({ error: 'You cannot use your own referral code' });

    // Verify the code belongs to a real user
    const referrer = await User.findOne({ referralCode: normalizedCode }).select('_id username').lean();
    if (!referrer) return res.status(404).json({ error: 'Invalid referral code — double-check and try again' });

    // Only allow before first successful deposit (prevent gaming the system)
    const hasDeposit = await Transaction.findOne({
      userId: String(me._id),
      type: 'deposit',
      status: 'completed',
    }).select('_id').lean();
    if (hasDeposit) {
      return res.status(400).json({ error: 'Referral codes can only be applied before your first deposit' });
    }

    await User.updateOne({ _id: req.user!.id }, { $set: { referredBy: normalizedCode } });

    res.json({
      success: true,
      message: `Code applied! You'll both earn rewards when you make your first deposit.`,
      referrerUsername: (referrer as any).username,
    });
  } catch (err) {
    console.error('[Referral] apply error:', err);
    res.status(500).json({ error: 'Failed to apply referral code' });
  }
});

export default router;
