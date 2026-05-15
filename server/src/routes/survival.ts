import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { SurvivalTournament, TIER_CONFIG } from '../models/SurvivalTournament';
import { getActiveGame } from '../socket/handlers/gameHandler';

const router = Router();

// Active survival for the logged-in user (used for initial page load — no socket timing issues)
router.get('/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const s = await SurvivalTournament.findOne({ userId, status: 'active' }).lean();
    if (!s) return res.json({ survival: null });
    const activeGame = (s as any).currentRoomCode ? getActiveGame((s as any).currentRoomCode) : null;
    const hasPlayedRounds = ((s as any).roundsPlayed ?? 0) > 0
      || (s as any).stageResults.length > 0
      || !!(activeGame && activeGame.roundNumber > 1);
    res.json({
      survival: {
        survivalId:        (s as any)._id,
        tier:              s.tier,
        tierLabel:         TIER_CONFIG[s.tier]?.label ?? s.tier,
        currentStage:      s.currentStage,
        totalStages:       5,
        entryPoints:       s.entryPoints,
        totalPointsEarned: s.totalPointsEarned,
        stageResults:      s.stageResults,
        currentRoomCode:   s.currentRoomCode,
        hasPlayedRounds,
      },
    });
  } catch {
    res.status(500).json({ error: 'Failed to load survival status' });
  }
});

router.get('/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const records = await SurvivalTournament.find({ userId }).lean();

    const runsPlayed    = records.length;
    const runsWon       = records.filter(r => r.status === 'won').length;
    const runsLost      = records.filter(r => r.status === 'lost').length;
    const runsAbandoned = records.filter(r => r.status === 'abandoned').length;

    let stagesWon = 0;
    let stagesPlayed = 0;
    let totalEarned = 0;
    let totalSpent = 0;
    let bestStage = 0;

    for (const r of records) {
      stagesPlayed += r.stageResults.length;
      stagesWon    += r.stageResults.filter((s: any) => s.playerWon).length;
      totalEarned  += r.totalPointsEarned;
      if (r.status !== 'abandoned' || r.stageResults.length > 0) totalSpent += r.entryPoints;
      const reached = r.stageResults.length > 0 ? Math.max(...r.stageResults.map((s: any) => s.stage)) : 0;
      if (reached > bestStage) bestStage = reached;
      if (r.status === 'won') bestStage = 5;
    }

    const stageWinRate = stagesPlayed > 0 ? Math.round((stagesWon / stagesPlayed) * 100) : 0;
    const runWinRate   = runsPlayed   > 0 ? Math.round((runsWon   / runsPlayed)   * 100) : 0;

    res.json({
      runsPlayed, runsWon, runsLost, runsAbandoned,
      stagesPlayed, stagesWon, stageWinRate,
      runWinRate, bestStage,
      totalEarned, totalSpent,
      netPoints: totalEarned - totalSpent,
    });
  } catch {
    res.status(500).json({ error: 'Failed to load survival stats' });
  }
});

router.get('/history', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const page   = Math.max(1, parseInt((req.query.page as string) ?? '1'));
    const limit  = 20;
    const [records, total] = await Promise.all([
      SurvivalTournament.find({ userId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      SurvivalTournament.countDocuments({ userId }),
    ]);
    res.json({
      records: records.map(r => ({
        id:                r._id,
        tier:              r.tier,
        tierLabel:         TIER_CONFIG[r.tier]?.label ?? r.tier,
        currentStage:      r.currentStage,
        status:            r.status,
        entryPoints:       r.entryPoints,
        totalPointsEarned: r.totalPointsEarned,
        stageResults:      r.stageResults,
        createdAt:         r.createdAt,
        completedAt:       (r as any).completedAt ?? null,
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch {
    res.status(500).json({ error: 'Failed to load history' });
  }
});

export default router;
