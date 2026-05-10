import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { Room } from '../models/Room';

const router = Router();

// List public rooms
router.get('/', requireAuth, async (_req: Request, res: Response) => {
  try {
    const rooms = await Room.find({ status: 'waiting', 'config.isPrivate': false })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json({ rooms: rooms.map(r => ({
      id: r._id,
      code: r.code,
      name: r.name,
      playerCount: r.players.length,
      maxPlayers: r.config.maxPlayers,
      roundCount: r.config.roundCount,
      createdAt: r.createdAt,
    })) });
  } catch {
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// Get room by code
router.get('/:code', requireAuth, async (req: Request, res: Response) => {
  try {
    const room = await Room.findOne({ code: req.params.code.toUpperCase() }).lean();
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json({ room });
  } catch {
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

export default router;
