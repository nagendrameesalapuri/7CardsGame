import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Tournament } from '../models/Tournament';
import { User } from '../models/User';

const router = Router();

// ── Auth middleware ──────────────────────────────────────────────────────────
function requireAuth(req: Request, res: Response, next: Function) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(auth.slice(7), process.env.JWT_SECRET!) as { userId: string };
    (req as any).userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// GET /api/tournaments — current user's tournament history
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const tournaments = await Tournament.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({
      tournaments: tournaments.map(t => ({
        id: t._id,
        entryFee:    t.entryFee,
        prizeAmount: t.prizeAmount,
        status:      t.status,
        gamesPlayed: t.gamesPlayed,
        playerWins:  t.playerWins,
        botWins:     t.botWins,
        draws:       (t as any).draws ?? 0,
        gameResults: t.gameResults,
        createdAt:   t.createdAt,
        completedAt: (t as any).completedAt ?? null,
      })),
    });
  } catch {
    res.status(500).json({ error: 'Failed to load tournament history' });
  }
});

export default router;
