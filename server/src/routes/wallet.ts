import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { requireAuth } from '../middleware/auth';
import { User } from '../models/User';
import { Transaction } from '../models/Transaction';
import { WithdrawalRequest } from '../models/WithdrawalRequest';
import { DepositRequest } from '../models/DepositRequest';
import { sendDepositRequestEmail } from '../services/mailer';

const router = Router();

const ALLOWED_VOUCHER_AMOUNTS = [50, 100];
const DAILY_VOUCHER_LIMIT = 300;
const REDEEM_MIN = 50;
const REDEEM_MAX = 500;

const ALLOWED_BRANDS = ['Amazon', 'Flipkart', 'Myntra', 'Ajio', 'Swiggy', 'Zomato'];

router.use(requireAuth);

// ── DEV: add test balance ─────────────────────────────────────────────────────
router.post('/dev/add', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') return res.status(404).json({ error: 'Not found' });
  try {
    if (req.user!.isGuest) return res.status(403).json({ error: 'Guests cannot add balance' });
    const amount = Math.min(Number(req.body.amount) || 500, 10000);
    const user = await User.findByIdAndUpdate(req.user!.id, { $inc: { walletBalance: amount } }, { new: true });
    await Transaction.create({ userId: req.user!.id, type: 'deposit', amount, status: 'completed', description: `[DEV] Added ₹${amount} test balance` });
    res.json({ balance: user!.walletBalance, message: `₹${amount} added (dev mode)` });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── GET /api/wallet ───────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.user!.id).select('walletBalance isGuest');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const [transactions, withdrawalRequests, depositRequests] = await Promise.all([
      Transaction.find({ userId: req.user!.id }).sort({ createdAt: -1 }).limit(50).lean(),
      WithdrawalRequest.find({ userId: req.user!.id }).sort({ createdAt: -1 }).limit(30).lean(),
      DepositRequest.find({ userId: req.user!.id }).sort({ createdAt: -1 }).limit(30).lean(),
    ]);

    // Calculate locked rewards (pending withdrawal requests)
    const lockedRewards = withdrawalRequests
      .filter(w => w.status === 'pending' || w.status === 'approved')
      .reduce((sum, w) => sum + w.amount, 0);

    // Mask voucher numbers for client display
    const maskedDeposits = depositRequests.map(d => {
      const doc: any = { ...d };
      if (doc.voucherNumber && doc.voucherNumber.length > 4) {
        const visible = doc.voucherNumber.slice(-4);
        doc.voucherNumberMasked = `XXXX XXXX ${visible}`;
        delete doc.voucherNumber;
        delete doc.voucherPin;
      }
      return doc;
    });

    res.json({
      balance: user.walletBalance,
      isGuest: user.isGuest,
      lockedRewards,
      transactions,
      withdrawalRequests,
      depositRequests: maskedDeposits,
    });
  } catch { res.status(500).json({ error: 'Failed to load wallet' }); }
});

// ── POST /api/wallet/voucher/submit — submit gift voucher for verification ────
router.post('/voucher/submit', async (req: Request, res: Response) => {
  try {
    if (req.user!.isGuest) return res.status(403).json({ error: 'Guests cannot submit vouchers. Please sign in.' });

    const { voucherBrand, voucherNumber, voucherPin, voucherExpiry, amount, screenshotUrl } = req.body as {
      voucherBrand: string;
      voucherNumber: string;
      voucherPin: string;
      voucherExpiry: string;
      amount: number;
      screenshotUrl?: string;
    };

    // Validate brand
    if (!ALLOWED_BRANDS.includes(voucherBrand)) {
      return res.status(400).json({ error: 'Invalid voucher brand selected' });
    }

    // Validate amount
    if (!ALLOWED_VOUCHER_AMOUNTS.includes(Number(amount))) {
      return res.status(400).json({ error: 'Voucher amount must be ₹50 or ₹100' });
    }

    // Validate fields
    const number = (voucherNumber ?? '').trim().replace(/\s/g, '');
    const pin = (voucherPin ?? '').trim();
    const expiry = (voucherExpiry ?? '').trim();

    if (number.length < 6)  return res.status(400).json({ error: 'Enter a valid voucher number' });
    if (pin.length < 3)     return res.status(400).json({ error: 'Enter a valid voucher PIN' });
    if (!expiry)            return res.status(400).json({ error: 'Enter the voucher expiry date' });

    // Daily limit check (per user, per calendar day)
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const todayDeposits = await DepositRequest.find({
      userId: req.user!.id,
      submissionType: 'voucher',
      status: { $in: ['pending', 'approved'] },
      createdAt: { $gte: startOfDay },
    }).select('amount').lean();
    const todayTotal = todayDeposits.reduce((s, d) => s + d.amount, 0);
    if (todayTotal + Number(amount) > DAILY_VOUCHER_LIMIT) {
      return res.status(400).json({
        error: `Daily voucher limit is ₹${DAILY_VOUCHER_LIMIT}. You've already submitted ₹${todayTotal} today.`,
      });
    }

    // Duplicate hash check
    const voucherHash = crypto.createHash('sha256').update(`${voucherBrand}|${number}|${pin}`).digest('hex');
    const existing = await DepositRequest.findOne({ voucherHash });
    if (existing) {
      return res.status(400).json({ error: 'This voucher has already been submitted' });
    }

    await DepositRequest.create({
      userId:         req.user!.id,
      username:       req.user!.username,
      amount:         Number(amount),
      submissionType: 'voucher',
      voucherBrand,
      voucherNumber:  number,
      voucherPin:     pin,
      voucherHash,
      voucherExpiry:  expiry,
      screenshotUrl:  screenshotUrl ?? '',
      status:         'pending',
    });

    // Notify admin by email (non-blocking)
    sendDepositRequestEmail({
      username: req.user!.username,
      userId: req.user!.id,
      amount: Number(amount),
      utrNumber: `${voucherBrand} voucher`,
      requestedAt: new Date(),
    }).catch(err => console.error('[Mailer] Failed to send voucher notification:', err));

    res.json({ message: `${voucherBrand} voucher submitted for verification. Credits will be added after admin approval.` });
  } catch (err) {
    console.error('[Wallet] Voucher submit error:', err);
    res.status(500).json({ error: 'Failed to submit voucher' });
  }
});

// ── POST /api/wallet/deposit/request — legacy UTR flow (kept for compat) ──────
router.post('/deposit/request', async (req: Request, res: Response) => {
  try {
    if (req.user!.isGuest) return res.status(403).json({ error: 'Guests cannot add money' });
    const { amount, utrNumber } = req.body as { amount: number; utrNumber: string };
    if (!amount || amount < 10 || amount > 100000) return res.status(400).json({ error: 'Amount must be between ₹10 and ₹1,00,000' });
    const utr = (utrNumber ?? '').trim();
    if (!utr || utr.length < 6) return res.status(400).json({ error: 'Enter a valid UTR / transaction reference number' });
    const existing = await DepositRequest.findOne({ utrNumber: utr });
    if (existing) return res.status(400).json({ error: 'This UTR number has already been submitted' });
    await DepositRequest.create({ userId: req.user!.id, username: req.user!.username, amount, utrNumber: utr, submissionType: 'utr', status: 'pending' });
    sendDepositRequestEmail({ username: req.user!.username, userId: req.user!.id, amount, utrNumber: utr, requestedAt: new Date() }).catch(() => {});
    res.json({ message: 'Challenge Entry request submitted. Admin will verify and credit your wallet shortly.' });
  } catch { res.status(500).json({ error: 'Failed to submit request' }); }
});

// ── POST /api/wallet/redeem — new reward redemption (brand voucher delivery) ──
router.post('/redeem', async (req: Request, res: Response) => {
  try {
    if (req.user!.isGuest) return res.status(403).json({ error: 'Guests cannot redeem rewards. Please sign in.' });

    const { amount, voucherBrand } = req.body as { amount: number; voucherBrand: string };

    if (!amount || amount < REDEEM_MIN) return res.status(400).json({ error: `Minimum redemption is ₹${REDEEM_MIN}` });
    if (amount > REDEEM_MAX)            return res.status(400).json({ error: `Maximum redemption is ₹${REDEEM_MAX}` });
    if (!ALLOWED_BRANDS.includes(voucherBrand)) return res.status(400).json({ error: 'Select a valid voucher brand' });

    const user = await User.findById(req.user!.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.walletBalance < amount) return res.status(400).json({ error: 'Insufficient Reward Balance' });

    user.walletBalance -= amount;
    await user.save();

    const wr = await WithdrawalRequest.create({
      userId: req.user!.id,
      username: req.user!.username,
      amount,
      redemptionType: 'voucher',
      voucherBrand,
      status: 'pending',
    });

    await Transaction.create({
      userId: req.user!.id,
      type: 'withdrawal',
      amount,
      status: 'pending',
      description: `Reward redemption — ${voucherBrand} voucher ₹${amount}`,
      metadata: { withdrawalRequestId: wr.id },
    });

    res.json({
      balance: user.walletBalance,
      message: `Reward redemption request submitted. Admin will deliver your ${voucherBrand} voucher within 24 hours.`,
    });
  } catch (err) {
    console.error('[Wallet] Redeem error:', err);
    res.status(500).json({ error: 'Failed to process redemption' });
  }
});

// ── POST /api/wallet/withdraw — legacy bank/UPI flow (kept for compat) ────────
router.post('/withdraw', async (req: Request, res: Response) => {
  try {
    if (req.user!.isGuest) return res.status(403).json({ error: 'Guests cannot withdraw' });
    const { amount, upiId, bankDetails } = req.body as { amount: number; upiId?: string; bankDetails?: any };
    if (!amount || amount < 10) return res.status(400).json({ error: 'Minimum withdrawal is ₹10' });
    if (!upiId && !bankDetails?.accountNumber) return res.status(400).json({ error: 'Provide UPI ID or bank details' });
    const user = await User.findById(req.user!.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.walletBalance < amount) return res.status(400).json({ error: 'Insufficient Reward Balance' });
    user.walletBalance -= amount;
    await user.save();
    const wr = await WithdrawalRequest.create({ userId: req.user!.id, username: req.user!.username, amount, upiId, bankDetails, redemptionType: 'bank', status: 'pending' });
    await Transaction.create({ userId: req.user!.id, type: 'withdrawal', amount, status: 'pending', description: `Reward redemption of ₹${amount}`, metadata: { withdrawalRequestId: wr.id } });
    res.json({ balance: user.walletBalance, message: 'Reward redemption request submitted. Admin will process within 24 hours.' });
  } catch { res.status(500).json({ error: 'Failed to process redemption' }); }
});

export default router;
