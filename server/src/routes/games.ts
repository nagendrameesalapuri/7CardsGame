import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { Game } from '../models/Game';
import { Transaction } from '../models/Transaction';

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
      isAiGame: g.players.some(p => p.isBot),
      myResult: g.players.find(p => p.userId === userId) ?? null,
      players: g.players.map(p => ({
        userId: p.userId,
        username: p.username,
        avatar: p.avatar,
        totalScore: p.totalScore,
        isBot: p.isBot,
        isWinner: p.userId === g.winnerId,
      })),
      rounds: g.rounds.map(r => ({
        roundNumber: r.roundNumber,
        jokerRank: r.jokerRank,
        showPlayerWon: r.showPlayerWon,
        playerResults: r.playerResults.map((pr: any) => ({
          playerId: pr.playerId,
          username: pr.username,
          roundPoints: pr.roundPoints,
          totalScore: pr.totalScore,
        })),
      })),
      entryFee: (g as any).entryFee ?? 0,
      roundsPlayed: g.rounds.length,
      startedAt: g.startedAt,
      endedAt: g.endedAt,
    }));

    res.json({ games: formatted });
  } catch {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// GET /api/games/multiplayer-stats — free vs wager breakdown (human-only games, no bots)
router.get('/multiplayer-stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Exclude any game that has a bot player — those are AI games, not multiplayer
    const [allGames, winTxns] = await Promise.all([
      Game.find({
        'players.userId': userId,
        status: 'finished',
        players: { $not: { $elemMatch: { isBot: true } } },
      })
        .select('roomId winnerId entryFee rounds')
        .lean(),
      Transaction.find({ userId, type: 'winning' }).lean(),
    ]);

    const freeGames  = allGames.filter(g => !g.entryFee || g.entryFee === 0);
    const wagerGames = allGames.filter(g => g.entryFee && g.entryFee > 0);

    const calcStats = (games: typeof allGames) => {
      const played     = games.length;
      const won        = games.filter(g => g.winnerId === userId).length;
      const roundsPlayed = games.reduce((s, g) => s + (g.rounds?.length ?? 0), 0);
      const roundsWon    = games.reduce((s, g) => s + (g.rounds?.filter(r => r.winnerId === userId).length ?? 0), 0);
      return {
        played,
        won,
        winRate:      played > 0       ? Math.round((won       / played)       * 100) : 0,
        roundsPlayed,
        roundsWon,
        roundWinRate: roundsPlayed > 0 ? Math.round((roundsWon / roundsPlayed) * 100) : 0,
      };
    };

    const wagerRoomCodes = new Set(wagerGames.map(g => g.roomId));
    const wagerWinTxns   = winTxns.filter(t => wagerRoomCodes.has((t as any).metadata?.roomCode));
    const totalEarned    = wagerWinTxns.reduce((s, t) => s + t.amount, 0);
    const totalSpent     = wagerGames.reduce((s, g) => s + (g.entryFee ?? 0), 0);

    res.json({
      free:  calcStats(freeGames),
      wager: {
        ...calcStats(wagerGames),
        totalSpent,
        totalEarned,
        netProfit: totalEarned - totalSpent,
      },
    });
  } catch {
    res.status(500).json({ error: 'Failed to load multiplayer stats' });
  }
});

export default router;
