import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { User } from '../models/User';
import { Game } from '../models/Game';

const router = Router();

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
    const { username, avatar } = req.body as { username?: string; avatar?: string };
    const updates: Record<string, string> = {};

    if (username) {
      if (username.length < 2 || username.length > 20) {
        return res.status(400).json({ error: 'Username must be 2–20 characters' });
      }
      updates.username = username.trim();
    }

    if (avatar) updates.avatar = avatar;

    const user = await User.findByIdAndUpdate(req.user!.id, updates, { new: true })
      .select('-guestToken');

    res.json({ user });
  } catch {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
