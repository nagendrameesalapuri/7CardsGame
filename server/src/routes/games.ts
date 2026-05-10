import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { Game } from '../models/Game';

const router = Router();

// GET /api/games/history — current user's game history
router.get('/history', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const games = await Game.find({
      'players.userId': userId,
      status: 'finished',
    })
      .sort({ endedAt: -1 })
      .limit(30)
      .lean();

    const formatted = games.map(g => ({
      id: g._id,
      roomId: g.roomId,
      roundCount: g.roundCount,
      winnerId: g.winnerId,
      winnerUsername: g.winnerUsername,
      myResult: g.players.find(p => p.userId === userId) ?? null,
      players: g.players.map(p => ({
        userId: p.userId,
        username: p.username,
        avatar: p.avatar,
        totalScore: p.totalScore,
        isBot: p.isBot,
        isWinner: p.userId === g.winnerId,
      })),
      roundsPlayed: g.rounds.length,
      startedAt: g.startedAt,
      endedAt: g.endedAt,
    }));

    res.json({ games: formatted });
  } catch {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

export default router;
