import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { createWorker } from 'tesseract.js';
import { requireAuth } from '../middleware/auth';
import { User } from '../models/User';
import { Transaction } from '../models/Transaction';
import { WithdrawalRequest } from '../models/WithdrawalRequest';
import { DepositRequest } from '../models/DepositRequest';
import { sendDepositRequestEmail } from '../services/mailer';
import { sendNotification } from '../services/fcmService';
import { SpinLog } from '../models/SpinLog';
import { getAdminConfig } from '../models/AdminConfig';

const router = Router();

const ALLOWED_VOUCHER_AMOUNTS: Record<string, number[]> = {
  Amazon:   [500, 1000],
  default:  [50, 100],
};
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
    const user = await User.findById(req.user!.id).select('walletBalance heldBalance giftBalance transferEligible isGuest aiPoints launchBonusClaimed bonusSpins');
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

    const heldBalance      = Math.round((user.heldBalance ?? 0) * 100) / 100;
    const totalBalance     = Math.round(user.walletBalance * 100) / 100;
    const rawGift          = (user as any).giftBalance ?? 0;
    const giftBalance      = Math.round(Math.min(rawGift, totalBalance) * 100) / 100;
    const availableBalance = Math.max(0, totalBalance - heldBalance);
    const withdrawableBalance = Math.max(0, totalBalance - giftBalance);

    // Read stored flag — updated by deposit approval and transfer endpoints, not recomputed here
    const transferEligible = (user as any).transferEligible ?? false;

    res.json({
      balance: totalBalance,
      heldBalance,
      availableBalance,
      giftBalance,
      withdrawableBalance,
      transferEligible,
      isGuest: user.isGuest,
      aiPoints: (user as any).aiPoints ?? 0,
      launchBonusClaimed: (user as any).launchBonusClaimed ?? false,
      bonusSpins: (user as any).bonusSpins ?? 0,
      lockedRewards,
      transactions,
      withdrawalRequests,
      depositRequests: maskedDeposits,
    });
  } catch { res.status(500).json({ error: 'Failed to load wallet' }); }
});

// ── Helpers for parsing OCR text ─────────────────────────────────────────────

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

function toMMYY(raw: string): string {
  raw = raw.trim();
  // "15 May 2027" or "May 2027"
  const wordy = raw.match(/(\d{1,2})\s+([a-z]{3})[a-z]*\s+(\d{4})/i)
              ?? raw.match(/([a-z]{3})[a-z]*\s+(\d{4})/i);
  if (wordy) {
    const mon = (wordy[2] ?? wordy[1]).toLowerCase().slice(0, 3);
    const yr  = (wordy[3] ?? wordy[2]).slice(-2);
    return `${MONTHS[mon] ?? '??'}/${yr}`;
  }
  // "16/05/2027" or "05/27"
  const numeric = raw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (numeric) {
    const [, d, m, y] = numeric;
    const mm = d.length === 4 ? m.padStart(2, '0') : m.padStart(2, '0');
    return `${mm}/${y.slice(-2)}`;
  }
  return raw.slice(0, 5);
}

function parseVoucherText(text: string): { voucherNumber: string; voucherPin: string; voucherExpiry: string } {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const full  = lines.join(' ');

  // ── Voucher Code: 14–19 digit number (groups of 4, may have spaces/dashes) ──
  const codeMatch = full.match(/\b(\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{2,7})\b/);
  const voucherNumber = codeMatch ? codeMatch[1].replace(/[-]/g, ' ').trim() : '';

  // ── PIN: line or value after "PIN" label ──────────────────────────────────
  let voucherPin = '';
  for (let i = 0; i < lines.length; i++) {
    if (/\bpin\b/i.test(lines[i])) {
      // same line: "PIN SV94DK6RJZ8QZ" or "PIN: 141637"
      const inline = lines[i].replace(/.*pin[:\s]*/i, '').trim();
      if (inline.length >= 3) { voucherPin = inline; break; }
      // next line
      if (lines[i + 1] && lines[i + 1].length >= 3) { voucherPin = lines[i + 1]; break; }
    }
  }
  // Alphanumeric PIN fallback (e.g. Amazon: "SV94 DK6R JZ8Q Z")
  if (!voucherPin) {
    const alphaPin = full.match(/\b([A-Z0-9]{4}\s[A-Z0-9]{4}\s[A-Z0-9]{4}(?:\s[A-Z0-9]{1,4})?)\b/);
    if (alphaPin) voucherPin = alphaPin[1];
  }

  // ── Expiry: "Valid till", "Expires on", "Expiry" labels ──────────────────
  let voucherExpiry = '';
  const expiryRx = /(?:valid\s*till|expires?\s*on|expiry|exp)[:\s]+([^\n,]{5,20})/i;
  const expMatch = full.match(expiryRx);
  if (expMatch) voucherExpiry = toMMYY(expMatch[1]);

  return { voucherNumber, voucherPin, voucherExpiry };
}

// ── POST /api/wallet/voucher/extract — free Tesseract OCR ────────────────────
router.post('/voucher/extract', async (req: Request, res: Response) => {
  let worker: any = null;
  try {
    if (req.user!.isGuest) return res.status(403).json({ error: 'Sign in required' });

    const { imageBase64 } = req.body as { imageBase64: string };
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'Image required' });
    }

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    worker = await createWorker('eng', 1, { logger: () => {} });
    const { data: { text } } = await worker.recognize(imageBuffer);

    const result = parseVoucherText(text);
    res.json(result);
  } catch (err) {
    console.error('[Wallet] OCR extract error:', err);
    res.status(500).json({ error: 'Could not read screenshot — please enter details manually.' });
  } finally {
    if (worker) await worker.terminate().catch(() => {});
  }
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

    // Validate amount (brand-specific)
    const allowedAmts = ALLOWED_VOUCHER_AMOUNTS[voucherBrand] ?? ALLOWED_VOUCHER_AMOUNTS.default;
    if (!allowedAmts.includes(Number(amount))) {
      return res.status(400).json({ error: `${voucherBrand} voucher amount must be ${allowedAmts.map(a => '₹' + a).join(' or ')}` });
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

    // Only withdrawable balance (walletBalance - giftBalance) can be redeemed
    const userCheck = await User.findById(req.user!.id).select('walletBalance giftBalance').lean() as any;
    if (!userCheck) return res.status(404).json({ error: 'User not found' });
    const effectiveGift     = Math.min(userCheck.giftBalance ?? 0, userCheck.walletBalance);
    const withdrawable      = Math.max(0, userCheck.walletBalance - effectiveGift);
    if (amount > withdrawable) {
      return res.status(400).json({ error: `Only ₹${withdrawable.toFixed(2)} is withdrawable. Received transfer funds (₹${effectiveGift.toFixed(2)}) cannot be withdrawn.` });
    }

    const user = await User.findOneAndUpdate(
      { _id: req.user!.id, walletBalance: { $gte: amount } },
      { $inc: { walletBalance: -amount } },
      { new: true },
    );
    if (!user) return res.status(400).json({ error: 'Insufficient Reward Balance' });

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

// ── POST /api/wallet/spin — money spin (₹5 per spin, dynamic daily limit) ──────
const SPIN_COST = 5;
let SPIN_DAILY_LIMIT = 3; // updated dynamically from admin config

const SPIN_PRIZES = [
  { label: 'Try Again', amount: 0,   type: 'cash', weight: 35, color: '#4b5563', icon: '😔' },
  { label: '₹2 Back',  amount: 2,   type: 'cash', weight: 25, color: '#6366f1', icon: '🥈' },
  { label: '₹5 Back',  amount: 5,   type: 'cash', weight: 15, color: '#8b5cf6', icon: '🎯' },
  { label: '₹10',      amount: 10,  type: 'cash', weight: 10, color: '#06b6d4', icon: '✨' },
  { label: '500 XP',   amount: 500, type: 'xp',   weight: 8,  color: '#f59e0b', icon: '🎁' },
  { label: '₹20',      amount: 20,  type: 'cash', weight: 4,  color: '#22c55e', icon: '💰' },
  { label: '₹50',      amount: 50,  type: 'cash', weight: 2,  color: '#f97316', icon: '🌟' },
  { label: '₹100 🎉',  amount: 100, type: 'cash', weight: 1,  color: '#eab308', icon: '🏆' },
] as const;

function pickPrize() {
  const total = SPIN_PRIZES.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of SPIN_PRIZES) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return SPIN_PRIZES[0];
}

router.post('/spin', requireAuth, async (req: Request, res: Response) => {
  try {
    if (req.user!.isGuest) return res.status(403).json({ error: 'Guests cannot use the spin' });

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const cfg = await getAdminConfig();
    SPIN_DAILY_LIMIT = (cfg as any).spinConfig?.moneySpinDailyLimit ?? 3;

    const user = await User.findById(req.user!.id).select('walletBalance spinLastDate spinDailyCount bonusSpins stats username');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const hasBonusSpin = ((user as any).bonusSpins ?? 0) > 0;

    if (!hasBonusSpin) {
      // Normal daily limit check
      const spinsToday = user.spinLastDate === today ? (user.spinDailyCount ?? 0) : 0;
      if (spinsToday >= SPIN_DAILY_LIMIT) {
        return res.status(400).json({ error: `Daily limit reached — ${SPIN_DAILY_LIMIT} spins per day`, spinsLeft: 0 });
      }
      if ((user.walletBalance ?? 0) < SPIN_COST) {
        return res.status(400).json({ error: `You need ₹${SPIN_COST} to spin` });
      }
    }

    // Deduct cost (free if bonus spin)
    const isFreeSplin = hasBonusSpin;
    if (hasBonusSpin) {
      (user as any).bonusSpins -= 1;
    } else {
      user.walletBalance -= SPIN_COST;
    }

    // Pick prize
    const prize = pickPrize();

    // Apply prize
    if (prize.type === 'cash' && prize.amount > 0) {
      user.walletBalance += prize.amount;
    } else if (prize.type === 'xp') {
      user.stats.totalPointsEarned = (user.stats.totalPointsEarned ?? 0) + prize.amount;
    }

    // Update daily spin count (only for paid spins)
    if (!isFreeSplin) {
      const spinsToday2 = user.spinLastDate === today ? (user.spinDailyCount ?? 0) : 0;
      user.spinLastDate = today;
      user.spinDailyCount = spinsToday2 + 1;
    }
    await user.save();

    const spinsRemainingToday = isFreeSplin
      ? Math.max(0, SPIN_DAILY_LIMIT - (user.spinLastDate === today ? (user.spinDailyCount ?? 0) : 0))
      : Math.max(0, SPIN_DAILY_LIMIT - (user.spinDailyCount ?? 0));

    // Two transactions: cost deduction + prize credit (so wallet history is clear)
    const balanceAfterCost  = user.walletBalance - (prize.type === 'cash' ? prize.amount : 0);
    const effectiveCost     = isFreeSplin ? 0 : SPIN_COST;
    const balanceBeforeSpin = balanceAfterCost + effectiveCost;

    // 1) Spin cost (skipped for free bonus spins)
    if (!isFreeSplin) {
      await Transaction.create({
        userId: req.user!.id,
        type: 'entry_fee',
        amount: SPIN_COST,
        status: 'completed',
        description: `Money Spin — cost`,
        balanceBefore: balanceBeforeSpin,
        balanceAfter: balanceAfterCost,
        heldBefore: user.heldBalance ?? 0,
        heldAfter: user.heldBalance ?? 0,
        metadata: { spinPrize: prize.label, prizeType: prize.type },
      });
    }

    // 2) Prize credit (only if won something)
    if (prize.type === 'cash' && prize.amount > 0) {
      await Transaction.create({
        userId: req.user!.id,
        type: 'bonus',
        amount: prize.amount,
        status: 'completed',
        description: `Money Spin — won ₹${prize.amount} (${prize.label})`,
        balanceBefore: balanceAfterCost,
        balanceAfter: user.walletBalance,
        heldBefore: user.heldBalance ?? 0,
        heldAfter: user.heldBalance ?? 0,
        metadata: { spinPrize: prize.label, prizeAmount: prize.amount, prizeType: prize.type },
      });
    } else if (prize.type === 'xp' && prize.amount > 0) {
      await Transaction.create({
        userId: req.user!.id,
        type: 'bonus',
        amount: 0,
        status: 'completed',
        description: `Money Spin — won ${prize.amount} XP (${prize.label})`,
        balanceBefore: balanceAfterCost,
        balanceAfter: balanceAfterCost,
        heldBefore: user.heldBalance ?? 0,
        heldAfter: user.heldBalance ?? 0,
        metadata: { spinPrize: prize.label, prizeAmount: prize.amount, prizeType: 'xp' },
      });
    }

    // Log spin for analytics/history (fire-and-forget)
    SpinLog.create({
      userId: req.user!.id,
      username: user.username,
      spinType: 'money',
      isFree: isFreeSplin,
      costRupees: isFreeSplin ? 0 : SPIN_COST,
      costPoints: 0,
      prizeType: prize.amount === 0 ? 'none' : prize.type as any,
      prizeAmount: prize.amount,
      prizeLabel: prize.label,
      prizeIcon: prize.icon,
    }).catch(() => {});

    res.json({
      prize,
      balance: user.walletBalance,
      spinsLeft: spinsRemainingToday,
      bonusSpins: (user as any).bonusSpins ?? 0,
      isFreeSplin,
    });
  } catch (err) {
    console.error('[Spin] Error:', err);
    res.status(500).json({ error: 'Spin failed, please try again' });
  }
});

// ── GET /api/wallet/spin/status — check daily spins remaining ─────────────────
router.get('/spin/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [user, cfg] = await Promise.all([
      User.findById(req.user!.id).select('spinLastDate spinDailyCount bonusSpins').lean() as any,
      getAdminConfig(),
    ]);
    const limit = (cfg as any).spinConfig?.moneySpinDailyLimit ?? 3;
    const spinsToday = user?.spinLastDate === today ? (user?.spinDailyCount ?? 0) : 0;
    const bonusSpins = user?.bonusSpins ?? 0;
    res.json({ spinsLeft: Math.max(0, limit - spinsToday), bonusSpins, spinsUsed: Math.min(spinsToday, limit), dailyLimit: limit, cost: SPIN_COST });
  } catch {
    res.status(500).json({ error: 'Failed to get spin status' });
  }
});

export { SPIN_PRIZES, SPIN_COST, SPIN_DAILY_LIMIT };

// ── POST /api/wallet/points-spin — spin wheel using AI points ─────────────────
const POINTS_SPIN_COST        = 100;
let POINTS_SPIN_DAILY_LIMIT   = 10; // updated dynamically

const POINTS_SPIN_PRIZES = [
  { label: 'Try Again', amount: 0,   type: 'cash',   weight: 22, color: '#4b5563', icon: '😔' },
  { label: '+50 pts',   amount: 50,  type: 'points', weight: 20, color: '#6366f1', icon: '⭐' },
  { label: '₹2',        amount: 2,   type: 'cash',   weight: 17, color: '#8b5cf6', icon: '💎' },
  { label: '+100 pts',  amount: 100, type: 'points', weight: 14, color: '#0891b2', icon: '💫' },
  { label: '₹5',        amount: 5,   type: 'cash',   weight: 12, color: '#06b6d4', icon: '✨' },
  { label: '₹10',       amount: 10,  type: 'cash',   weight: 7,  color: '#22c55e', icon: '🎯' },
  { label: '+300 pts',  amount: 300, type: 'points', weight: 5,  color: '#f97316', icon: '🌟' },
  { label: '₹20',       amount: 20,  type: 'cash',   weight: 3,  color: '#eab308', icon: '🏆' },
] as const;

function pickPointsPrize() {
  const total = POINTS_SPIN_PRIZES.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of POINTS_SPIN_PRIZES) { r -= p.weight; if (r <= 0) return p; }
  return POINTS_SPIN_PRIZES[0];
}

router.post('/points-spin', requireAuth, async (req: Request, res: Response) => {
  try {
    if (req.user!.isGuest) return res.status(403).json({ error: 'Guests cannot use the spin' });

    const today = new Date().toISOString().slice(0, 10);
    const cfg = await getAdminConfig();
    POINTS_SPIN_DAILY_LIMIT = (cfg as any).spinConfig?.pointsSpinDailyLimit ?? 10;

    const user = await User.findById(req.user!.id).select('walletBalance aiPoints pointsSpinLastDate pointsSpinDailyCount username');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const spinsToday = user.pointsSpinLastDate === today ? (user.pointsSpinDailyCount ?? 0) : 0;
    if (spinsToday >= POINTS_SPIN_DAILY_LIMIT)
      return res.status(400).json({ error: `Daily limit reached — ${POINTS_SPIN_DAILY_LIMIT} point spins per day`, spinsLeft: 0 });

    const currentPoints = user.aiPoints ?? 0;
    if (currentPoints < POINTS_SPIN_COST)
      return res.status(400).json({ error: `You need ${POINTS_SPIN_COST} AI points to spin` });

    // Deduct points
    user.aiPoints = currentPoints - POINTS_SPIN_COST;
    const prize = pickPointsPrize();

    // Credit prize — cash or AI points
    const balBefore = user.walletBalance;
    if (prize.type === 'cash' && prize.amount > 0) {
      user.walletBalance += prize.amount;
    } else if (prize.type === 'points' && prize.amount > 0) {
      user.aiPoints = (user.aiPoints ?? 0) + prize.amount;
    }

    user.pointsSpinLastDate   = today;
    user.pointsSpinDailyCount = spinsToday + 1;
    await user.save();

    // Transaction: cash prizes only (points are internal)
    if (prize.type === 'cash' && prize.amount > 0) {
      await Transaction.create({
        userId: req.user!.id,
        type: 'bonus',
        amount: prize.amount,
        status: 'completed',
        description: `Points Spin — won ₹${prize.amount} (${prize.label})`,
        balanceBefore: balBefore,
        balanceAfter: user.walletBalance,
        heldBefore: user.heldBalance ?? 0,
        heldAfter: user.heldBalance ?? 0,
        metadata: { spinPrize: prize.label, prizeAmount: prize.amount, prizeType: 'points_spin' },
      });
    }

    // Log spin for analytics/history (fire-and-forget)
    SpinLog.create({
      userId: req.user!.id,
      username: user.username,
      spinType: 'points',
      isFree: false,
      costRupees: 0,
      costPoints: POINTS_SPIN_COST,
      prizeType: prize.amount === 0 ? 'none' : prize.type as any,
      prizeAmount: prize.amount,
      prizeLabel: prize.label,
      prizeIcon: prize.icon,
    }).catch(() => {});

    res.json({
      prize,
      balance: user.walletBalance,
      aiPoints: user.aiPoints,
      spinsLeft: Math.max(0, POINTS_SPIN_DAILY_LIMIT - (spinsToday + 1)),
    });
  } catch (err) {
    console.error('[PointsSpin] Error:', err);
    res.status(500).json({ error: 'Spin failed, please try again' });
  }
});

// ── GET /api/wallet/points-spin/status ───────────────────────────────────────
router.get('/points-spin/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [user, cfg] = await Promise.all([
      User.findById(req.user!.id).select('aiPoints pointsSpinLastDate pointsSpinDailyCount').lean() as any,
      getAdminConfig(),
    ]);
    const limit = (cfg as any).spinConfig?.pointsSpinDailyLimit ?? 10;
    const spinsToday = user?.pointsSpinLastDate === today ? (user?.pointsSpinDailyCount ?? 0) : 0;
    res.json({
      spinsLeft: Math.max(0, limit - spinsToday),
      aiPoints:  user?.aiPoints ?? 0,
      dailyLimit: limit,
      cost: POINTS_SPIN_COST,
    });
  } catch {
    res.status(500).json({ error: 'Failed to get spin status' });
  }
});

// ── GET /api/wallet/spin-history — server-side spin history for the user ─────
router.get('/spin-history', requireAuth, async (req: Request, res: Response) => {
  try {
    const logs = await SpinLog.find({ userId: req.user!.id })
      .sort({ createdAt: -1 }).limit(100).lean();
    res.json({ logs });
  } catch {
    res.status(500).json({ error: 'Failed to load spin history' });
  }
});

// ── POST /api/wallet/transfer — send money to a favorite friend ──────────────
const TRANSFER_MAX = 100;
const TRANSFER_MIN_DEPOSIT = 50;

router.post('/transfer', requireAuth, async (req: Request, res: Response) => {
  try {
    if (req.user!.isGuest) return res.status(403).json({ error: 'Guests cannot transfer money. Please sign in.' });

    const { recipientId, amount } = req.body as { recipientId: string; amount: number };

    const parsedAmount = Math.round(Number(amount) * 100) / 100;
    if (!parsedAmount || parsedAmount <= 0) return res.status(400).json({ error: 'Enter a valid amount' });
    if (parsedAmount > TRANSFER_MAX) return res.status(400).json({ error: `Maximum transfer is ₹${TRANSFER_MAX}` });
    if (!recipientId) return res.status(400).json({ error: 'Recipient required' });
    if (String(recipientId) === String(req.user!.id)) return res.status(400).json({ error: 'Cannot transfer to yourself' });

    // Sender must have recipient in their favorites
    const sender = await User.findById(req.user!.id).select('walletBalance giftBalance heldBalance favorites username transferEligible');
    if (!sender) return res.status(404).json({ error: 'User not found' });

    // Sender must have an approved deposit ≥₹50 within the last 24 hrs AND no transfer sent after it
    const _24hAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const qualifyingDeposit = await DepositRequest.findOne({
      userId: req.user!.id,
      status: 'approved',
      amount: { $gte: TRANSFER_MIN_DEPOSIT },
      updatedAt: { $gte: _24hAgo },
    }).sort({ updatedAt: -1 }).select('updatedAt').lean();

    if (!qualifyingDeposit) {
      return res.status(400).json({
        error: `You need an approved deposit of at least ₹${TRANSFER_MIN_DEPOSIT} within the last 24 hours to send a transfer.`,
      });
    }
    const alreadySent = await Transaction.findOne({
      userId: req.user!.id,
      type: 'transfer_sent',
      createdAt: { $gt: (qualifyingDeposit as any).updatedAt },
    }).select('_id').lean();
    if (alreadySent) {
      return res.status(400).json({
        error: 'You have already sent a transfer after your last deposit. Deposit again to send another transfer.',
      });
    }

    const isFavorite = sender.favorites.some(f => String(f.userId) === String(recipientId));
    if (!isFavorite) return res.status(400).json({ error: 'Recipient must be in your favorites' });

    // Sender must have enough own (non-gift) balance
    const senderGift        = Math.min((sender as any).giftBalance ?? 0, sender.walletBalance);
    const senderWithdrawable = Math.max(0, sender.walletBalance - senderGift);
    if (senderWithdrawable < parsedAmount) {
      return res.status(400).json({ error: `Insufficient withdrawable balance. You can transfer up to ₹${senderWithdrawable.toFixed(2)}` });
    }

    const recipient = await User.findById(recipientId).select('walletBalance giftBalance username avatar');
    if (!recipient) return res.status(404).json({ error: 'Recipient not found' });

    // ── Atomic deduction from sender, lock sender's eligibility ─────────────
    const updatedSender = await User.findOneAndUpdate(
      { _id: req.user!.id, walletBalance: { $gte: parsedAmount } },
      { $inc: { walletBalance: -parsedAmount }, $set: { transferEligible: false } },
      { new: true },
    );
    if (!updatedSender) return res.status(400).json({ error: 'Insufficient balance (concurrent update)' });

    // ── Credit gift balance to recipient (no eligibility change on recipient) ─
    const updatedRecipient = await User.findByIdAndUpdate(
      recipientId,
      { $inc: { walletBalance: parsedAmount, giftBalance: parsedAmount } },
      { new: true },
    );

    // ── Transaction records ──────────────────────────────────────────────────
    await Promise.all([
      Transaction.create({
        userId:      req.user!.id,
        type:        'transfer_sent',
        amount:      parsedAmount,
        status:      'completed',
        description: `Transferred ₹${parsedAmount} to ${recipient.username}`,
        balanceBefore: sender.walletBalance,
        balanceAfter:  updatedSender.walletBalance,
        metadata:    { transferToUserId: recipientId, transferToUsername: recipient.username },
      }),
      Transaction.create({
        userId:      recipientId,
        type:        'transfer_received',
        amount:      parsedAmount,
        status:      'completed',
        description: `Received ₹${parsedAmount} from ${sender.username} (play-only, not withdrawable)`,
        balanceBefore: recipient.walletBalance,
        balanceAfter:  (updatedRecipient?.walletBalance ?? recipient.walletBalance),
        metadata:    { transferFromUserId: req.user!.id, transferFromUsername: sender.username },
      }),
    ]);

    // Push notifications — fire-and-forget (don't block response)
    Promise.allSettled([
      sendNotification({
        userId: String(req.user!.id),
        title: '💸 Transfer Sent',
        message: `₹${parsedAmount} sent to ${recipient.username} successfully. Deposit again to send another transfer.`,
        category: 'rewards',
        type: 'success',
        actionUrl: '/wallet',
        skipThrottle: true,
      }),
      sendNotification({
        userId: String(recipientId),
        title: '🎁 You received ₹' + parsedAmount + '!',
        message: `${sender.username} sent you ₹${parsedAmount} as a gift. Use it in games — it cannot be withdrawn.`,
        category: 'rewards',
        type: 'success',
        actionUrl: '/wallet',
        skipThrottle: true,
      }),
    ]).catch(() => {});

    res.json({
      balance: updatedSender.walletBalance,
      message: `₹${parsedAmount} sent to ${recipient.username} successfully!`,
    });
  } catch (err) {
    console.error('[Wallet] Transfer error:', err);
    res.status(500).json({ error: 'Transfer failed. Please try again.' });
  }
});

// ── GET /api/wallet/transfer/eligibility/:userId — check if user can receive transfer ──
router.get('/transfer/eligibility/:userId', requireAuth, async (req: Request, res: Response) => {
  try {
    if (req.user!.isGuest) return res.status(403).json({ error: 'Sign in required' });
    const u = await User.findById(req.params.userId).select('username avatar transferEligible').lean() as any;
    if (!u) return res.status(404).json({ error: 'User not found' });
    res.json({ username: u.username, avatar: u.avatar, transferEligible: u.transferEligible ?? false });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── DELETE /api/wallet/withdrawal/:id — cancel pending withdrawal ─────────────
router.delete('/withdrawal/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const wr = await WithdrawalRequest.findOne({ _id: req.params.id, userId: req.user!.id });
    if (!wr) return res.status(404).json({ error: 'Withdrawal request not found' });
    if (wr.status !== 'pending') return res.status(400).json({ error: 'Only pending requests can be cancelled' });

    // Refund the amount back to wallet
    const updated = await User.findByIdAndUpdate(
      req.user!.id,
      { $inc: { walletBalance: wr.amount } },
      { new: true },
    );

    // Mark withdrawal as rejected (cancelled by user)
    wr.status = 'rejected';
    wr.adminNote = 'Cancelled by user';
    await wr.save();

    // Update the pending transaction to failed
    await Transaction.findOneAndUpdate(
      { userId: req.user!.id, 'metadata.withdrawalRequestId': wr.id, status: 'pending' },
      { status: 'failed', description: `Withdrawal cancelled by user — ₹${wr.amount} refunded` },
    );

    res.json({ balance: updated?.walletBalance, message: `₹${wr.amount} refunded to your wallet.` });
  } catch (err) {
    console.error('[Wallet] Cancel withdrawal error:', err);
    res.status(500).json({ error: 'Failed to cancel withdrawal' });
  }
});

// ── POST /api/wallet/claim-launch-bonus ──────────────────────────────────────
router.post('/claim-launch-bonus', requireAuth, async (req: Request, res: Response) => {
  try {
    if (req.user!.isGuest) return res.status(403).json({ error: 'Guests cannot claim bonuses' });
    const user = await User.findById(req.user!.id).select('launchBonusClaimed aiPoints bonusSpins');
    if (!user) return res.status(404).json({ error: 'User not found' });
    if ((user as any).launchBonusClaimed) return res.status(400).json({ error: 'Launch bonus already claimed' });

    (user as any).aiPoints      = ((user as any).aiPoints ?? 0) + 250;
    (user as any).bonusSpins    = ((user as any).bonusSpins ?? 0) + 1;
    (user as any).launchBonusClaimed = true;
    await user.save();

    res.json({ aiPoints: (user as any).aiPoints, bonusSpins: (user as any).bonusSpins });
  } catch (err) {
    console.error('[Wallet] claim-launch-bonus error:', err);
    res.status(500).json({ error: 'Failed to claim bonus' });
  }
});

// ── POST /api/wallet/withdraw — legacy bank/UPI flow (kept for compat) ────────
router.post('/withdraw', async (req: Request, res: Response) => {
  try {
    if (req.user!.isGuest) return res.status(403).json({ error: 'Guests cannot withdraw' });
    const { amount, upiId, bankDetails } = req.body as { amount: number; upiId?: string; bankDetails?: any };
    if (!amount || amount < 10) return res.status(400).json({ error: 'Minimum withdrawal is ₹10' });
    if (!upiId && !bankDetails?.accountNumber) return res.status(400).json({ error: 'Provide UPI ID or bank details' });

    // Gift balance is non-withdrawable
    const userCheck = await User.findById(req.user!.id).select('walletBalance giftBalance').lean() as any;
    if (!userCheck) return res.status(404).json({ error: 'User not found' });
    const effectiveGift  = Math.min(userCheck.giftBalance ?? 0, userCheck.walletBalance);
    const withdrawable   = Math.max(0, userCheck.walletBalance - effectiveGift);
    if (amount > withdrawable) {
      return res.status(400).json({ error: `Only ₹${withdrawable.toFixed(2)} is withdrawable. Received transfer funds cannot be withdrawn.` });
    }

    const user = await User.findOneAndUpdate(
      { _id: req.user!.id, walletBalance: { $gte: amount } },
      { $inc: { walletBalance: -amount } },
      { new: true },
    );
    if (!user) return res.status(400).json({ error: 'Insufficient Reward Balance' });
    const wr = await WithdrawalRequest.create({ userId: req.user!.id, username: req.user!.username, amount, upiId, bankDetails, redemptionType: 'bank', status: 'pending' });
    await Transaction.create({ userId: req.user!.id, type: 'withdrawal', amount, status: 'pending', description: `Reward redemption of ₹${amount}`, metadata: { withdrawalRequestId: wr.id } });
    res.json({ balance: user.walletBalance, message: 'Reward redemption request submitted. Admin will process within 24 hours.' });
  } catch { res.status(500).json({ error: 'Failed to process redemption' }); }
});

export default router;
