import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { ScheduledTournament } from '../models/ScheduledTournament';
import { Transaction } from '../models/Transaction';
import { User } from '../models/User';
import { sendNotification } from '../services/fcmService';

const router = Router();

// GET /api/tournaments — list upcoming, live, and recent completed
router.get('/', async (req: Request, res: Response) => {
  try {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    const tournaments = await ScheduledTournament.find({
      $or: [
        { status: { $in: ['upcoming', 'live'] } },
        { status: 'completed', completedAt: { $gte: cutoff } },
        { status: 'cancelled', cancelledAt: { $gte: cutoff } },
      ],
    })
      .sort({ startTime: 1 })
      .lean();

    // Strip isBot flag — bots appear as regular players to users
    const sanitized = tournaments.map((t) => ({
      ...t,
      registrations: (t.registrations ?? []).map(({ isBot: _b, ...r }: any) => r),
    }));
    res.json({ tournaments: sanitized });
  } catch (err) {
    console.error('[Tournaments] list error:', err);
    res.status(500).json({ error: 'Failed to load tournaments' });
  }
});

// GET /api/tournaments/:id — full details with leaderboard
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const tournament = await ScheduledTournament.findById(req.params.id).lean();
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

    // Sort registrations by score desc for leaderboard; strip isBot from public view
    const sorted = [...(tournament.registrations ?? [])]
      .sort((a, b) => b.score - a.score)
      .map(({ isBot: _b, ...r }: any) => r);

    res.json({ tournament: { ...tournament, registrations: sorted } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load tournament' });
  }
});

// POST /api/tournaments/:id/register
router.post('/:id/register', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const tournament = await ScheduledTournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

    if (tournament.status !== 'upcoming') {
      return res.status(400).json({ error: 'Registration is closed' });
    }

    const alreadyRegistered = tournament.registrations.some(
      (r) => String(r.userId) === String(userId)
    );
    if (alreadyRegistered) return res.status(400).json({ error: 'Already registered' });

    if (tournament.maxPlayers > 0 && tournament.registrations.length >= tournament.maxPlayers) {
      return res.status(400).json({ error: 'Tournament is full' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ error: 'User not found' });

    // Deduct entry fee (entryFee is in pts; wallet is in rupees; 100 pts = ₹1)
    if (tournament.entryFee > 0) {
      const feeInRupees = tournament.entryFee / 100;
      const available = user.walletBalance - user.heldBalance;
      if (available < feeInRupees) {
        return res.status(400).json({ error: `Insufficient balance. Need ${tournament.entryFee} pts.` });
      }

      const balanceBefore = user.walletBalance;
      user.walletBalance -= feeInRupees;
      await user.save();

      await Transaction.create({
        userId: String(userId),
        type: 'tournament_entry',
        amount: feeInRupees,
        status: 'completed',
        description: `Entry fee — ${tournament.name}`,
        balanceBefore,
        balanceAfter: user.walletBalance,
        heldBefore: user.heldBalance,
        heldAfter: user.heldBalance,
        metadata: { scheduledTournamentId: String(tournament._id) },
      });
    }

    tournament.registrations.push({
      userId,
      username: user.username,
      avatar: user.avatar ?? 'avatar_1',
      registeredAt: new Date(),
      score: 0,
      prizeWon: 0,
      rank: 0,
      eliminated: false,
      timeoutCount: 0,
      isBot: false,
    });
    await tournament.save();

    // Confirmation notification
    sendNotification({
      userId: String(userId),
      title: `✅ Registered: ${tournament.name}`,
      message: `You're in! Tournament starts ${new Date(tournament.startTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST. Prize pool: ${tournament.prizePool} pts.`,
      category: 'tournament',
      type: 'success',
      actionUrl: '/tournaments',
    }).catch(() => {});

    res.json({ success: true, message: 'Registered successfully' });
  } catch (err) {
    console.error('[Tournaments] register error:', err);
    res.status(500).json({ error: 'Failed to register' });
  }
});

// DELETE /api/tournaments/:id/register — unregister (only before start)
router.delete('/:id/register', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const tournament = await ScheduledTournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

    if (tournament.status !== 'upcoming') {
      return res.status(400).json({ error: 'Cannot unregister after tournament has started' });
    }

    const regIdx = tournament.registrations.findIndex(
      (r) => String(r.userId) === String(userId)
    );
    if (regIdx === -1) return res.status(400).json({ error: 'Not registered' });

    tournament.registrations.splice(regIdx, 1);
    await tournament.save();

    // Refund entry fee (convert pts → rupees)
    if (tournament.entryFee > 0) {
      const feeInRupees = tournament.entryFee / 100;
      const user = await User.findById(userId);
      if (user) {
        const balanceBefore = user.walletBalance;
        user.walletBalance += feeInRupees;
        await user.save();

        await Transaction.create({
          userId: String(userId),
          type: 'refund',
          amount: feeInRupees,
          status: 'completed',
          description: `Entry refund — ${tournament.name}`,
          balanceBefore,
          balanceAfter: user.walletBalance,
          heldBefore: user.heldBalance,
          heldAfter: user.heldBalance,
          metadata: { scheduledTournamentId: String(tournament._id) },
        });
      }
    }

    res.json({ success: true, message: 'Unregistered successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unregister' });
  }
});

export default router;
