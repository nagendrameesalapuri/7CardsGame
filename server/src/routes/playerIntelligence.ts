/**
 * Player Intelligence & Audit System
 * Admin-only routes for deep player investigation, wallet auditing,
 * fraud detection, and tournament analytics.
 * All routes require requireAdmin middleware (enforced in admin.ts).
 */

import { Router, Request, Response } from 'express';
import { User } from '../models/User';
import { Transaction } from '../models/Transaction';
import { Game } from '../models/Game';
import { Room } from '../models/Room';
import { SurvivalTournament } from '../models/SurvivalTournament';
import { SurvivalTeam } from '../models/SurvivalTeam';
import { PlayerProgress } from '../models/PlayerProgress';
import { PlayerNote, PlayerFlag } from '../models/PlayerNote';
import { WithdrawalRequest } from '../models/WithdrawalRequest';
import { DepositRequest } from '../models/DepositRequest';

const POINTS_PER_RUPEE = 100;

// ─────────────────────────────────────────────────────────────────────────────
// Risk Engine — computes a 0–100 risk score from behavioral signals
// ─────────────────────────────────────────────────────────────────────────────

async function computeRiskProfile(userId: string) {
  const [
    transactions,
    games,
    soloTournaments,
    teamTournaments,
    flag,
  ] = await Promise.all([
    Transaction.find({ userId }).sort({ createdAt: -1 }).limit(200).lean(),
    Game.find({ 'players.userId': userId, status: 'finished' }).sort({ startedAt: -1 }).limit(100).lean(),
    SurvivalTournament.find({ userId }).sort({ createdAt: -1 }).limit(50).lean(),
    SurvivalTeam.find({ 'members.userId': userId }).sort({ createdAt: -1 }).limit(50).lean(),
    PlayerFlag.findOne({ userId }).lean(),
  ]);

  const flags: string[] = [];
  let score = 0;

  // ── Refund abuse ──────────────────────────────────────────────────────────
  const refunds = transactions.filter(t => t.type === 'refund');
  const deposits = transactions.filter(t => t.type === 'deposit');
  if (refunds.length >= 5) { flags.push('frequent_refunds'); score += 15; }
  if (deposits.length > 0 && refunds.length / deposits.length > 0.5) {
    flags.push('high_refund_ratio'); score += 20;
  }

  // ── Rapid reconnect / abandon abuse ───────────────────────────────────────
  const abandonedSolo = soloTournaments.filter(t => t.status === 'abandoned').length;
  const abandonedTeam = teamTournaments.filter(t => t.status === 'abandoned').length;
  const totalTournaments = soloTournaments.length + teamTournaments.length;
  if (totalTournaments > 5 && (abandonedSolo + abandonedTeam) / totalTournaments > 0.5) {
    flags.push('high_abandon_rate'); score += 15;
  }

  // ── Tie farming detection ─────────────────────────────────────────────────
  const tieWins = transactions.filter(t => t.description?.toLowerCase().includes('tie') && t.type === 'winning');
  if (tieWins.length >= 4) { flags.push('tie_farming'); score += 25; }

  // ── Unusual win streak ────────────────────────────────────────────────────
  const winTransactions = transactions.filter(t => t.type === 'winning');
  if (winTransactions.length >= 15) {
    const totalAmount = winTransactions.reduce((s, t) => s + t.amount, 0);
    const avgWin = totalAmount / winTransactions.length;
    if (avgWin > 200) { flags.push('abnormal_win_rate'); score += 20; }
  }

  // ── Wallet anomaly: rapid deposit then immediate withdraw ─────────────────
  for (let i = 0; i < Math.min(deposits.length, 20); i++) {
    const dep = deposits[i];
    const nextWithdraw = transactions.find(
      t => t.type === 'withdrawal' &&
        new Date(t.createdAt).getTime() - new Date(dep.createdAt).getTime() < 10 * 60 * 1000,
    );
    if (nextWithdraw) { flags.push('rapid_deposit_withdraw'); score += 30; break; }
  }

  // ── Bot game farming ──────────────────────────────────────────────────────
  const botGames = games.filter(g =>
    g.players.some(p => p.userId === userId) &&
    g.players.filter(p => !p.isBot).length <= 1,
  );
  if (botGames.length > games.length * 0.7 && games.length > 10) {
    flags.push('bot_farming'); score += 15;
  }

  // ── Clamp and classify ────────────────────────────────────────────────────
  score = Math.min(100, score);
  const riskLevel = score >= 70 ? 'critical' : score >= 45 ? 'high' : score >= 20 ? 'medium' : 'low';

  return {
    riskScore: score,
    riskLevel,
    flags,
    existingFlag: flag,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

export default function createPlayerIntelRouter(): Router {
  const router = Router();

  // ── Search players ──────────────────────────────────────────────────────────
  router.get('/search', async (req: Request, res: Response) => {
    try {
      const q = (req.query.q as string ?? '').trim();
      if (!q) return res.json({ users: [] });

      const isObjectId = /^[a-f\d]{24}$/i.test(q);
      const filter: any = isObjectId
        ? { _id: q }
        : { username: { $regex: q, $options: 'i' } };

      const users = await User.find(filter)
        .select('_id username avatar email isGuest isBanned walletBalance lastSeenAt createdAt')
        .limit(20)
        .lean();

      const flags = await PlayerFlag.find({ userId: { $in: users.map(u => String(u._id)) } }).lean();
      const flagMap = Object.fromEntries(flags.map(f => [f.userId, f]));

      res.json({
        users: users.map(u => ({
          id: String(u._id),
          username: u.username,
          avatar: u.avatar,
          email: u.email ?? null,
          isGuest: u.isGuest,
          isBanned: u.isBanned,
          walletBalance: u.walletBalance,
          walletPoints: Math.round(u.walletBalance * POINTS_PER_RUPEE),
          lastSeenAt: u.lastSeenAt ?? null,
          createdAt: u.createdAt,
          riskLevel: flagMap[String(u._id)]?.riskLevel ?? 'low',
          isSuspended: flagMap[String(u._id)]?.isSuspended ?? false,
          isWatched: flagMap[String(u._id)]?.isWatched ?? false,
        })),
      });
    } catch (err) {
      res.status(500).json({ error: 'Search failed' });
    }
  });

  // ── Full player profile ─────────────────────────────────────────────────────
  router.get('/:userId/profile', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const [user, progress, flag, noteCount] = await Promise.all([
        User.findById(userId).lean(),
        PlayerProgress.findOne({ userId }).lean(),
        PlayerFlag.findOne({ userId }).lean(),
        PlayerNote.countDocuments({ userId }),
      ]);

      if (!user) return res.status(404).json({ error: 'Player not found' });

      // Financial summary from transactions
      const txAgg = await Transaction.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: '$type',
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]);
      const fin: Record<string, { total: number; count: number }> = {};
      for (const row of txAgg) fin[row._id] = { total: row.total, count: row.count };

      const [soloCount, teamCount, gameCount] = await Promise.all([
        SurvivalTournament.countDocuments({ userId }),
        SurvivalTeam.countDocuments({ 'members.userId': userId }),
        Game.countDocuments({ 'players.userId': userId, status: 'finished' }),
      ]);

      const riskProfile = await computeRiskProfile(userId);

      res.json({
        user: {
          id: String(user._id),
          username: user.username,
          email: user.email ?? null,
          avatar: user.avatar,
          isGuest: user.isGuest,
          isBanned: user.isBanned,
          walletBalance: user.walletBalance,
          walletPoints: Math.round(user.walletBalance * POINTS_PER_RUPEE),
          stats: user.stats,
          createdAt: user.createdAt,
          lastSeenAt: (user as any).lastSeenAt ?? null,
          updatedAt: user.updatedAt,
        },
        progress: progress ? {
          xp: progress.xp,
          level: progress.level,
          rank: progress.rank,
          winStreak: progress.winStreak,
          maxWinStreak: progress.maxWinStreak,
          loginStreak: progress.loginStreak,
          totalWins: progress.totalWins,
          totalGames: progress.totalGames,
          survivalWins: progress.survivalWins,
          achievementCount: progress.achievements?.length ?? 0,
        } : null,
        financial: {
          totalDeposited:     (fin['deposit']?.total ?? 0),
          totalWithdrawn:     (fin['withdrawal']?.total ?? 0),
          totalWon:           (fin['winning']?.total ?? 0),
          totalEntryFees:     (fin['entry_fee']?.total ?? 0),
          totalRefunded:      (fin['refund']?.total ?? 0),
          totalBonus:         (fin['bonus']?.total ?? 0),
          depositCount:       fin['deposit']?.count ?? 0,
          withdrawalCount:    fin['withdrawal']?.count ?? 0,
          winCount:           fin['winning']?.count ?? 0,
          refundCount:        fin['refund']?.count ?? 0,
          netFlow:            (fin['deposit']?.total ?? 0) + (fin['winning']?.total ?? 0) +
                              (fin['refund']?.total ?? 0) + (fin['bonus']?.total ?? 0) -
                              (fin['withdrawal']?.total ?? 0) - (fin['entry_fee']?.total ?? 0),
          currentWallet:      user.walletBalance,
        },
        activity: {
          soloTournaments: soloCount,
          teamTournaments: teamCount,
          multiplayerGames: gameCount,
        },
        risk: {
          riskScore: riskProfile.riskScore,
          riskLevel: riskProfile.riskLevel,
          flags:     riskProfile.flags,
          isWatched: flag?.isWatched ?? false,
          isSuspended: flag?.isSuspended ?? false,
          suspendReason: flag?.suspendReason ?? null,
        },
        noteCount,
      });
    } catch (err) {
      console.error('[PlayerIntel] profile error:', err);
      res.status(500).json({ error: 'Failed to load profile' });
    }
  });

  // ── Transactions (paginated, filterable, with before/after) ────────────────
  router.get('/:userId/transactions', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const page  = Math.max(1, parseInt((req.query.page as string) ?? '1'));
      const limit = 50;
      const type  = req.query.type as string | undefined;
      const from  = req.query.from as string | undefined;
      const to    = req.query.to   as string | undefined;

      const filter: any = { userId };
      if (type && type !== 'all') filter.type = type;
      if (from || to) {
        filter.createdAt = {};
        if (from) filter.createdAt.$gte = new Date(from);
        if (to)   filter.createdAt.$lte = new Date(to);
      }

      const [txs, total] = await Promise.all([
        Transaction.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        Transaction.countDocuments(filter),
      ]);

      res.json({
        transactions: txs.map(t => ({
          id:            String(t._id),
          type:          t.type,
          amount:        t.amount,
          amountPts:     Math.round(t.amount * POINTS_PER_RUPEE),
          status:        t.status,
          description:   t.description,
          balanceBefore: t.balanceBefore,
          balanceAfter:  t.balanceAfter,
          ptsBefore:     Math.round((t.balanceBefore ?? 0) * POINTS_PER_RUPEE),
          ptsAfter:      Math.round((t.balanceAfter  ?? 0) * POINTS_PER_RUPEE),
          metadata:      t.metadata,
          createdAt:     t.createdAt,
        })),
        total,
        page,
        pages: Math.ceil(total / limit),
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to load transactions' });
    }
  });

  // ── Game / Match history ────────────────────────────────────────────────────
  router.get('/:userId/games', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const page  = Math.max(1, parseInt((req.query.page as string) ?? '1'));
      const limit = 30;

      const [games, total] = await Promise.all([
        Game.find({ 'players.userId': userId, status: 'finished' })
          .sort({ startedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        Game.countDocuments({ 'players.userId': userId, status: 'finished' }),
      ]);

      res.json({
        games: games.map(g => {
          const me = g.players.find(p => p.userId === userId);
          const humanPlayers = g.players.filter(p => !p.isBot);
          const botPlayers   = g.players.filter(p => p.isBot);
          const won          = g.winnerId === userId;
          const durationMs   = g.endedAt && g.startedAt
            ? new Date(g.endedAt).getTime() - new Date(g.startedAt).getTime() : 0;
          return {
            id:           String(g._id),
            roomId:       g.roomId,
            players:      g.players.map(p => ({ username: p.username, isBot: p.isBot, totalScore: p.totalScore })),
            humanCount:   humanPlayers.length,
            botCount:     botPlayers.length,
            myScore:      me?.totalScore ?? 0,
            won,
            winnerId:     g.winnerId,
            winnerUsername: g.winnerUsername,
            entryFee:     g.entryFee,
            roundCount:   g.rounds?.length ?? 0,
            durationMs,
            durationMin:  Math.round(durationMs / 60000),
            startedAt:    g.startedAt,
            endedAt:      g.endedAt ?? null,
          };
        }),
        total,
        page,
        pages: Math.ceil(total / limit),
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to load game history' });
    }
  });

  // ── Tournament analytics (solo + team) ─────────────────────────────────────
  router.get('/:userId/tournaments', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const page  = Math.max(1, parseInt((req.query.page as string) ?? '1'));
      const limit = 20;

      const [solo, team, soloTotal, teamTotal] = await Promise.all([
        SurvivalTournament.find({ userId }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        SurvivalTeam.find({ 'members.userId': userId }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        SurvivalTournament.countDocuments({ userId }),
        SurvivalTeam.countDocuments({ 'members.userId': userId }),
      ]);

      // Solo summary
      const soloWins      = await SurvivalTournament.countDocuments({ userId, status: 'won' });
      const soloAbandoned = await SurvivalTournament.countDocuments({ userId, status: 'abandoned' });
      const soloEarnings  = await SurvivalTournament.aggregate([
        { $match: { userId } },
        { $group: { _id: null, total: { $sum: '$totalPointsEarned' }, fees: { $sum: '$entryPoints' } } },
      ]);
      const soloEntry     = soloEarnings[0]?.fees ?? 0;
      const soloEarned    = soloEarnings[0]?.total ?? 0;

      // Team summary
      const teamWins      = await SurvivalTeam.countDocuments({
        'members.userId': userId, status: 'completed',
        'stageResults.4.teamWon': true,
      });
      const teamAbandoned = await SurvivalTeam.countDocuments({ 'members.userId': userId, status: 'abandoned' });
      const teamEarnings  = await SurvivalTeam.aggregate([
        { $match: { 'members.userId': userId } },
        { $group: { _id: null, total: { $sum: '$totalPointsEarned' }, fees: { $sum: '$entryPoints' } } },
      ]);
      const teamEarned    = teamEarnings[0]?.total ?? 0;

      res.json({
        solo: {
          records: solo.map(r => ({
            id: String(r._id), tier: r.tier, status: r.status,
            currentStage: r.currentStage, entryPoints: r.entryPoints,
            totalPointsEarned: r.totalPointsEarned, stageResults: r.stageResults,
            createdAt: r.createdAt, completedAt: (r as any).completedAt ?? null,
          })),
          total: soloTotal, page, pages: Math.ceil(soloTotal / limit),
          summary: { wins: soloWins, abandoned: soloAbandoned, totalEarned: soloEarned, totalFees: soloEntry,
            net: soloEarned - soloEntry, winRate: soloTotal > 0 ? +((soloWins / soloTotal) * 100).toFixed(1) : 0 },
        },
        team: {
          records: team.map(r => ({
            id: String(r._id), tier: r.tier, status: r.status,
            currentStage: r.currentStage, entryPoints: r.entryPoints,
            totalPointsEarned: r.totalPointsEarned, stageResults: r.stageResults,
            members: (r.members as any[]).map(m => ({ username: m.username, isBot: m.isBot })),
            entryFeeMode: r.entryFeeMode, isHost: r.hostId === userId,
            createdAt: r.createdAt, completedAt: r.completedAt ?? null,
          })),
          total: teamTotal, page, pages: Math.ceil(teamTotal / limit),
          summary: { wins: teamWins, abandoned: teamAbandoned, totalEarned: teamEarned,
            winRate: teamTotal > 0 ? +((teamWins / teamTotal) * 100).toFixed(1) : 0 },
        },
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to load tournament data' });
    }
  });

  // ── Risk profile ────────────────────────────────────────────────────────────
  router.get('/:userId/risk', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const [risk, flag, notes] = await Promise.all([
        computeRiskProfile(userId),
        PlayerFlag.findOne({ userId }).lean(),
        PlayerNote.find({ userId }).sort({ createdAt: -1 }).limit(5).lean(),
      ]);

      res.json({
        computed: risk,
        stored: flag ?? { riskLevel: 'low', riskScore: 0, fraudFlags: [], isWatched: false, isSuspended: false },
        recentNotes: notes,
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to compute risk profile' });
    }
  });

  // ── Admin notes ─────────────────────────────────────────────────────────────
  router.get('/:userId/notes', async (req: Request, res: Response) => {
    try {
      const notes = await PlayerNote.find({ userId: req.params.userId })
        .sort({ createdAt: -1 }).lean();
      res.json({ notes });
    } catch (err) {
      res.status(500).json({ error: 'Failed to load notes' });
    }
  });

  router.post('/:userId/notes', async (req: Request, res: Response) => {
    try {
      const { content, type } = req.body;
      if (!content?.trim()) return res.status(400).json({ error: 'Content required' });
      const adminName = (req as any).adminName ?? 'Admin';
      const adminId   = (req as any).adminId   ?? 'system';
      const note = await PlayerNote.create({
        userId:    req.params.userId,
        adminId,
        adminName,
        type:      type ?? 'info',
        content:   content.trim(),
      });
      res.json({ note });
    } catch (err) {
      res.status(500).json({ error: 'Failed to create note' });
    }
  });

  router.delete('/:userId/notes/:noteId', async (req: Request, res: Response) => {
    try {
      await PlayerNote.findByIdAndDelete(req.params.noteId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete note' });
    }
  });

  // ── Admin actions (flag, watch, suspend, wallet adjust) ─────────────────────
  router.post('/:userId/action', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { action, reason, amount } = req.body;
      const adminName = (req as any).adminName ?? 'Admin';
      const adminId   = (req as any).adminId   ?? 'system';

      let result: any = {};

      switch (action) {
        case 'watch': {
          await PlayerFlag.findOneAndUpdate(
            { userId }, { isWatched: true }, { upsert: true, new: true },
          );
          await PlayerNote.create({ userId, adminId, adminName, type: 'info', content: `Marked as watched. Reason: ${reason ?? 'unspecified'}` });
          result = { message: 'Player marked as watched' };
          break;
        }
        case 'unwatch': {
          await PlayerFlag.findOneAndUpdate({ userId }, { isWatched: false }, { upsert: true });
          result = { message: 'Watch removed' };
          break;
        }
        case 'flag_fraud': {
          const risk = await computeRiskProfile(userId);
          await PlayerFlag.findOneAndUpdate(
            { userId },
            { riskLevel: 'high', riskScore: risk.riskScore, fraudFlags: risk.flags, isWatched: true },
            { upsert: true, new: true },
          );
          await PlayerNote.create({ userId, adminId, adminName, type: 'fraud_flag', content: `Fraud flag applied. Flags: ${risk.flags.join(', ') || 'manual'}. Reason: ${reason ?? 'unspecified'}` });
          result = { message: 'Fraud flag applied', flags: risk.flags };
          break;
        }
        case 'clear_flags': {
          await PlayerFlag.findOneAndUpdate(
            { userId },
            { riskLevel: 'low', riskScore: 0, fraudFlags: [], isWatched: false },
            { upsert: true },
          );
          await PlayerNote.create({ userId, adminId, adminName, type: 'cleared', content: `All fraud flags cleared. Reason: ${reason ?? 'unspecified'}` });
          result = { message: 'Flags cleared' };
          break;
        }
        case 'suspend': {
          await User.findByIdAndUpdate(userId, { isBanned: true });
          await PlayerFlag.findOneAndUpdate(
            { userId },
            { isSuspended: true, suspendedAt: new Date(), suspendedBy: adminName, suspendReason: reason ?? '' },
            { upsert: true },
          );
          await PlayerNote.create({ userId, adminId, adminName, type: 'warning', content: `Account suspended. Reason: ${reason ?? 'unspecified'}` });
          result = { message: 'Account suspended' };
          break;
        }
        case 'unsuspend': {
          await User.findByIdAndUpdate(userId, { isBanned: false });
          await PlayerFlag.findOneAndUpdate(
            { userId },
            { isSuspended: false, $unset: { suspendedAt: 1, suspendedBy: 1, suspendReason: 1 } },
            { upsert: true },
          );
          await PlayerNote.create({ userId, adminId, adminName, type: 'cleared', content: `Account unsuspended. Reason: ${reason ?? 'unspecified'}` });
          result = { message: 'Account unsuspended' };
          break;
        }
        case 'wallet_adjust': {
          if (typeof amount !== 'number') return res.status(400).json({ error: 'amount required' });
          const user = await User.findById(userId);
          if (!user) return res.status(404).json({ error: 'User not found' });
          const before = user.walletBalance;
          const after  = Math.max(0, before + amount);
          await User.findByIdAndUpdate(userId, { walletBalance: after });
          await Transaction.create({
            userId, type: amount >= 0 ? 'bonus' : 'refund',
            amount: Math.abs(amount), status: 'completed',
            description: `Admin adjustment by ${adminName}: ${reason ?? ''}`,
            balanceBefore: before, balanceAfter: after,
            metadata: {},
          });
          await PlayerNote.create({ userId, adminId, adminName, type: 'info',
            content: `Wallet adjusted ₹${amount >= 0 ? '+' : ''}${amount.toFixed(2)} (${amount >= 0 ? '+' : ''}${Math.round(amount * POINTS_PER_RUPEE)} pts). Before: ₹${before.toFixed(2)}, After: ₹${after.toFixed(2)}. Reason: ${reason ?? 'unspecified'}` });
          result = { message: 'Wallet adjusted', before, after };
          break;
        }
        default:
          return res.status(400).json({ error: 'Unknown action' });
      }

      res.json(result);
    } catch (err) {
      console.error('[PlayerIntel] action error:', err);
      res.status(500).json({ error: 'Action failed' });
    }
  });

  // ── Deposit & withdrawal history ────────────────────────────────────────────
  router.get('/:userId/wallet-requests', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const [deposits, withdrawals] = await Promise.all([
        DepositRequest.find({ userId }).sort({ createdAt: -1 }).limit(50).lean(),
        WithdrawalRequest.find({ userId }).sort({ createdAt: -1 }).limit(50).lean(),
      ]);
      res.json({ deposits, withdrawals });
    } catch (err) {
      res.status(500).json({ error: 'Failed to load wallet requests' });
    }
  });

  return router;
}
