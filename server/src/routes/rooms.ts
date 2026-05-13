import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { Room } from '../models/Room';
import { getAdminConfig } from '../models/AdminConfig';
import { getSpectatorCount } from '../socket/handlers/spectatorHandler';
import { getActiveGame } from '../socket/handlers/gameHandler';

const router = Router();

// List public rooms (waiting + playing for spectating)
router.get('/', requireAuth, async (_req: Request, res: Response) => {
  try {
    const cfg = await getAdminConfig();

    if (!cfg.featureFlags.publicRoomsEnabled) {
      return res.json({ rooms: [] });
    }

    const rooms = await Room.find({ 'config.isPrivate': false, status: { $in: ['waiting', 'playing'] } })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // Only show 'playing' rooms that have an active in-memory game.
    // This prevents stale DB entries from appearing after a match ends
    // (Room.findOneAndUpdate is async so DB may lag behind the emit).
    const filteredRooms = rooms.filter(r =>
      r.status === 'waiting' || getActiveGame(r.code) !== undefined
    );

    res.json({
      rooms: filteredRooms.map(r => ({
        id: r._id,
        code: r.code,
        name: r.name,
        playerCount: r.players.length,
        maxPlayers: r.config.maxPlayers,
        roundCount: r.config.roundCount,
        entryFee: (r.config as any).entryFee ?? 0,
        status: r.status,
        spectatorCount: getSpectatorCount(r.code),
        canSpectate: r.status === 'playing' && cfg.featureFlags.spectatorModeEnabled,
        createdAt: r.createdAt,
      })),
      spectatorModeEnabled: cfg.featureFlags.spectatorModeEnabled,
    });
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
