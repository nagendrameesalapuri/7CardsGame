import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { User } from '../models/User';
import { Transaction } from '../models/Transaction';
import { WithdrawalRequest } from '../models/WithdrawalRequest';
import { DepositRequest } from '../models/DepositRequest';

const router = Router();

// All wallet routes require auth
router.use(requireAuth);

// ── DEV ONLY: add test balance ───────────────────────────────────────────────
router.post('/dev/add', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }
  try {
    if (req.user!.isGuest) return res.status(403).json({ error: 'Guests cannot add money' });
    const amount = Math.min(Number(req.body.amount) || 500, 10000);
    const user = await User.findByIdAndUpdate(
      req.user!.id,
      { $inc: { walletBalance: amount } },
      { new: true }
    );
    await Transaction.create({
      userId: req.user!.id,
      type: 'deposit',
      amount,
      status: 'completed',
      description: `[DEV] Added ₹${amount} test balance`,
    });
    res.json({ balance: user!.walletBalance, message: `₹${amount} added (dev mode)` });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

// ── GET /api/wallet ──────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.user!.id).select('walletBalance isGuest');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const [transactions, withdrawalRequests, depositRequests] = await Promise.all([
      Transaction.find({ userId: req.user!.id }).sort({ createdAt: -1 }).limit(50).lean(),
      WithdrawalRequest.find({ userId: req.user!.id }).sort({ createdAt: -1 }).limit(20).lean(),
      DepositRequest.find({ userId: req.user!.id }).sort({ createdAt: -1 }).limit(20).lean(),
    ]);

    res.json({
      balance: user.walletBalance,
      isGuest: user.isGuest,
      transactions,
      withdrawalRequests,
      depositRequests,
    });
  } catch {
    res.status(500).json({ error: 'Failed to load wallet' });
  }
});

// ── POST /api/wallet/deposit/request — submit UTR after UPI payment ──────────
router.post('/deposit/request', async (req: Request, res: Response) => {
  try {
    if (req.user!.isGuest) return res.status(403).json({ error: 'Guests cannot add money' });

    const { amount, utrNumber } = req.body as { amount: number; utrNumber: string };

    if (!amount || amount < 10 || amount > 100000) {
      return res.status(400).json({ error: 'Amount must be between ₹10 and ₹1,00,000' });
    }
    const utr = (utrNumber ?? '').trim();
    if (!utr || utr.length < 6) {
      return res.status(400).json({ error: 'Enter a valid UTR / transaction reference number' });
    }

    // Prevent duplicate UTR submissions
    const existing = await DepositRequest.findOne({ utrNumber: utr });
    if (existing) {
      return res.status(400).json({ error: 'This UTR number has already been submitted' });
    }

    await DepositRequest.create({
      userId:    req.user!.id,
      username:  req.user!.username,
      amount,
      utrNumber: utr,
      status:    'pending',
    });

    res.json({ message: 'Deposit request submitted. Admin will verify and credit your wallet shortly.' });
  } catch {
    res.status(500).json({ error: 'Failed to submit deposit request' });
  }
});

// ── POST /api/wallet/withdraw ────────────────────────────────────────────────
router.post('/withdraw', async (req: Request, res: Response) => {
  try {
    if (req.user!.isGuest) return res.status(403).json({ error: 'Guests cannot withdraw money' });

    const { amount, upiId, bankDetails } = req.body as {
      amount: number;
      upiId?: string;
      bankDetails?: { accountNumber: string; ifsc: string; accountName: string };
    };

    if (!amount || amount < 10) return res.status(400).json({ error: 'Minimum withdrawal is ₹10' });
    if (!upiId && !bankDetails?.accountNumber) {
      return res.status(400).json({ error: 'Provide UPI ID or bank details' });
    }

    const user = await User.findById(req.user!.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.walletBalance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    user.walletBalance -= amount;
    await user.save();

    const wr = await WithdrawalRequest.create({
      userId: req.user!.id,
      username: req.user!.username,
      amount,
      upiId,
      bankDetails,
      status: 'pending',
    });

    await Transaction.create({
      userId: req.user!.id,
      type: 'withdrawal',
      amount,
      status: 'pending',
      description: `Withdrawal request of ₹${amount}`,
      metadata: { withdrawalRequestId: wr.id },
    });

    res.json({ balance: user.walletBalance, message: 'Withdrawal request submitted. Admin will process within 24 hours.' });
  } catch {
    res.status(500).json({ error: 'Failed to process withdrawal' });
  }
});

export default router;
