import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { User } from '../models/User';
import { Game } from '../models/Game';

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
    const user = await User.findById(req.params.id).select('-guestToken -googleId').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const recentGames = await Game.find({ 'players.userId': req.params.id, status: 'finished' })
      .sort({ endedAt: -1 })
      .limit(10)
      .lean();

    res.json({ user, recentGames });
  } catch {
    res.status(500).json({ error: 'Failed to fetch profile' });
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

export default router;
