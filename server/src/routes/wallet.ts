import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { requireAuth } from '../middleware/auth';
import { User } from '../models/User';
import { Transaction } from '../models/Transaction';
import { WithdrawalRequest } from '../models/WithdrawalRequest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Razorpay = require('razorpay');

const router = Router();

function getRazorpay() {
  const key_id     = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) throw new Error('Razorpay keys not configured');
  return new Razorpay({ key_id, key_secret });
}

// All wallet routes require auth
router.use(requireAuth);

// ── DEV ONLY: add test balance without payment gateway ──────────────────────
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

// ── GET /api/wallet ─────────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.user!.id).select('walletBalance isGuest');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const [transactions, withdrawalRequests] = await Promise.all([
      Transaction.find({ userId: req.user!.id })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      WithdrawalRequest.find({ userId: req.user!.id })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
    ]);

    res.json({
      balance: user.walletBalance,
      isGuest: user.isGuest,
      transactions,
      withdrawalRequests,
    });
  } catch {
    res.status(500).json({ error: 'Failed to load wallet' });
  }
});

// ── POST /api/wallet/deposit/order ───────────────────────────────────────────────
router.post('/deposit/order', async (req: Request, res: Response) => {
  try {
    if (req.user!.isGuest) return res.status(403).json({ error: 'Guests cannot add money' });

    const { amount } = req.body as { amount: number };
    if (!amount || amount < 1 || amount > 100000) {
      return res.status(400).json({ error: 'Invalid amount (₹1–₹1,00,000)' });
    }

    const rzp = getRazorpay();
    const order = await rzp.orders.create({
      amount: Math.round(amount * 100), // paise
      currency: 'INR',
      receipt: `wallet_${req.user!.id}_${Date.now()}`,
    });

    res.json({
      orderId: order.id,
      amount,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err: any) {
    if (err.message?.includes('not configured')) {
      return res.status(503).json({ error: 'Payment gateway not configured' });
    }
    res.status(500).json({ error: 'Failed to create payment order' });
  }
});

// ── POST /api/wallet/deposit/verify ─────────────────────────────────────────────
router.post('/deposit/verify', async (req: Request, res: Response) => {
  try {
    if (req.user!.isGuest) return res.status(403).json({ error: 'Guests cannot add money' });

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body as {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
      amount: number;
    };

    // Verify HMAC signature
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) return res.status(503).json({ error: 'Payment gateway not configured' });

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
    if (expected !== razorpay_signature) {
      return res.status(400).json({ error: 'Payment verification failed' });
    }

    // Credit wallet atomically
    const user = await User.findByIdAndUpdate(
      req.user!.id,
      { $inc: { walletBalance: amount } },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: 'User not found' });

    await Transaction.create({
      userId: req.user!.id,
      type: 'deposit',
      amount,
      status: 'completed',
      description: `Added ₹${amount} via Razorpay`,
      metadata: { razorpayOrderId: razorpay_order_id, razorpayPaymentId: razorpay_payment_id },
    });

    res.json({ balance: user.walletBalance, message: `₹${amount} added successfully` });
  } catch {
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

// ── POST /api/wallet/withdraw ────────────────────────────────────────────────────
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

    // Deduct balance immediately (hold it)
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

    res.json({ balance: user.walletBalance, message: 'Withdrawal request submitted' });
  } catch {
    res.status(500).json({ error: 'Failed to process withdrawal' });
  }
});

export default router;
