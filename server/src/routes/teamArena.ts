import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { TeamArenaTournament, TEAM_ARENA_STAGES, AI_TEAMMATE_PROFILES, TEAM_ARENA_ENTRY_POINTS, TEAM_ARENA_STAGE_REWARDS } from "../models/TeamArenaTournament";

const router = Router();

// Active tournament for the current user
router.get("/status", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const t = await TeamArenaTournament.findOne({
      $or: [{ hostUserId: userId }, { teammateUserId: userId }],
      status: { $in: ["waiting_teammate", "active"] },
    }).lean();

    res.json({ tournament: t ?? null });
  } catch {
    res.status(500).json({ error: "Failed to load team arena status" });
  }
});

// Tournament history
router.get("/history", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(String(req.query.page ?? "1"), 10);
    const limit = Math.min(parseInt(String(req.query.limit ?? "10"), 10), 50);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      TeamArenaTournament.find({
        $or: [{ hostUserId: userId }, { teammateUserId: userId }],
        status: { $in: ["won", "lost", "abandoned"] },
      }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      TeamArenaTournament.countDocuments({
        $or: [{ hostUserId: userId }, { teammateUserId: userId }],
        status: { $in: ["won", "lost", "abandoned"] },
      }),
    ]);

    res.json({ history: items, total, page, pages: Math.ceil(total / limit) });
  } catch {
    res.status(500).json({ error: "Failed to load history" });
  }
});

// Aggregate stats for the current user
router.get("/stats", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const [wins, losses, all] = await Promise.all([
      TeamArenaTournament.countDocuments({
        $or: [{ hostUserId: userId }, { teammateUserId: userId }],
        status: "won",
      }),
      TeamArenaTournament.countDocuments({
        $or: [{ hostUserId: userId }, { teammateUserId: userId }],
        status: "lost",
      }),
      TeamArenaTournament.find({
        $or: [{ hostUserId: userId }, { teammateUserId: userId }],
        status: { $in: ["won", "lost"] },
      }).select("totalPointsEarned stageResults teammateName teammateType").lean(),
    ]);

    const totalPointsEarned = all.reduce((s, t) => s + (t.totalPointsEarned ?? 0), 0);
    const bossClears = all.filter((t) => t.stageResults.some((r) => r.stage === 5 && r.teamAWon)).length;
    const aiRuns = all.filter((t) => t.teammateType === "ai").length;
    const humanRuns = all.filter((t) => t.teammateType === "human").length;

    res.json({ wins, losses, totalPointsEarned, bossClears, aiRuns, humanRuns });
  } catch {
    res.status(500).json({ error: "Failed to load stats" });
  }
});

// Meta — stages config and AI teammate profiles for the lobby UI
router.get("/meta", (_req, res) => {
  res.json({
    stages: TEAM_ARENA_STAGES,
    aiTeammateProfiles: AI_TEAMMATE_PROFILES,
    entryPoints: TEAM_ARENA_ENTRY_POINTS,
    stageRewards: TEAM_ARENA_STAGE_REWARDS,
  });
});

export default router;
