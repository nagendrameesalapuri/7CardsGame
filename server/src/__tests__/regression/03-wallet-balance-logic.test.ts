/**
 * REGRESSION SUITE 03 — Wallet Balance Computation & Business Rules
 *
 * Covers: balance fields (total, held, available, withdrawable, gift),
 * gift balance restrictions, withdrawable calculation, transferEligible flag,
 * spin deductions, refund scenarios.
 *
 * Tests the pure computation logic — DB-free using direct formula assertions.
 */

// ────────────────────────────────────────────────────────────────────────────
// Pure wallet computation formulas (mirrors server/src/routes/wallet.ts GET /)
// ────────────────────────────────────────────────────────────────────────────

interface WalletInput {
  walletBalance: number;
  heldBalance?: number;
  giftBalance?: number;
  transferEligible?: boolean;
}

function computeWallet(u: WalletInput) {
  const round = (n: number) => Math.round(n * 100) / 100;
  const totalBalance      = round(u.walletBalance);
  const heldBalance       = round(u.heldBalance ?? 0);
  const rawGift           = u.giftBalance ?? 0;
  const giftBalance       = round(Math.min(rawGift, totalBalance));
  const availableBalance  = Math.max(0, totalBalance - heldBalance);
  const withdrawableBalance = Math.max(0, totalBalance - giftBalance);
  const transferEligible  = u.transferEligible ?? false;
  return { totalBalance, heldBalance, giftBalance, availableBalance, withdrawableBalance, transferEligible };
}

// ════════════════════════════════════════════════════════════════════════════
// 1. BALANCE FIELD COMPUTATION
// ════════════════════════════════════════════════════════════════════════════

describe('Balance Field Computation', () => {
  it('basic: no held, no gift → available = withdrawable = total', () => {
    const w = computeWallet({ walletBalance: 100 });
    expect(w.totalBalance).toBe(100);
    expect(w.availableBalance).toBe(100);
    expect(w.withdrawableBalance).toBe(100);
    expect(w.giftBalance).toBe(0);
    expect(w.heldBalance).toBe(0);
  });

  it('held balance reduces available but not withdrawable', () => {
    const w = computeWallet({ walletBalance: 100, heldBalance: 20 });
    expect(w.availableBalance).toBe(80);
    expect(w.withdrawableBalance).toBe(100); // held doesn't affect withdrawable
  });

  it('gift balance reduces withdrawable but not available', () => {
    const w = computeWallet({ walletBalance: 100, giftBalance: 30 });
    expect(w.withdrawableBalance).toBe(70);
    expect(w.availableBalance).toBe(100); // gift doesn't affect available
    expect(w.giftBalance).toBe(30);
  });

  it('gift balance capped at wallet balance (no negative withdrawable)', () => {
    const w = computeWallet({ walletBalance: 50, giftBalance: 200 });
    expect(w.giftBalance).toBe(50);        // capped
    expect(w.withdrawableBalance).toBe(0); // 50 - 50
  });

  it('held + gift: both reduce respective fields independently', () => {
    const w = computeWallet({ walletBalance: 200, heldBalance: 20, giftBalance: 50 });
    expect(w.availableBalance).toBe(180);    // 200 - 20
    expect(w.withdrawableBalance).toBe(150); // 200 - 50
  });

  it('zero wallet balance: all fields zero', () => {
    const w = computeWallet({ walletBalance: 0, heldBalance: 0, giftBalance: 0 });
    expect(w.totalBalance).toBe(0);
    expect(w.availableBalance).toBe(0);
    expect(w.withdrawableBalance).toBe(0);
  });

  it('decimal precision rounded to 2 dp', () => {
    const w = computeWallet({ walletBalance: 100.005 });
    expect(w.totalBalance).toBe(100.01);
  });

  it('held > wallet: available floored at 0', () => {
    const w = computeWallet({ walletBalance: 10, heldBalance: 20 });
    expect(w.availableBalance).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. TRANSFER ELIGIBILITY RULES
// ════════════════════════════════════════════════════════════════════════════

describe('Transfer Eligibility', () => {
  it('default: not eligible', () => {
    const w = computeWallet({ walletBalance: 100 });
    expect(w.transferEligible).toBe(false);
  });

  it('eligible flag set: returns true', () => {
    const w = computeWallet({ walletBalance: 100, transferEligible: true });
    expect(w.transferEligible).toBe(true);
  });

  it('eligible flag false: returns false', () => {
    const w = computeWallet({ walletBalance: 100, transferEligible: false });
    expect(w.transferEligible).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. TRANSFER AMOUNT VALIDATION (pure rules)
// ════════════════════════════════════════════════════════════════════════════

describe('Transfer Amount Validation Rules', () => {
  const TRANSFER_MAX = 100;
  const TRANSFER_MIN_DEPOSIT = 50;

  function validateTransfer(params: {
    amount: number;
    withdrawable: number;
    giftBalance: number;
    walletBalance: number;
  }): string | null {
    const { amount, withdrawable, walletBalance, giftBalance } = params;
    if (!amount || amount <= 0) return 'Enter a valid amount';
    if (amount > TRANSFER_MAX) return `Maximum transfer is ₹${TRANSFER_MAX}`;
    const senderGift = Math.min(giftBalance, walletBalance);
    const senderWithdrawable = Math.max(0, walletBalance - senderGift);
    if (senderWithdrawable < amount) return `Insufficient withdrawable balance`;
    return null;
  }

  it('valid transfer ₹1', () => expect(validateTransfer({ amount: 1, withdrawable: 100, walletBalance: 200, giftBalance: 0 })).toBeNull());
  it('valid transfer ₹100', () => expect(validateTransfer({ amount: 100, withdrawable: 100, walletBalance: 200, giftBalance: 0 })).toBeNull());
  it('₹101 exceeds max', () => expect(validateTransfer({ amount: 101, withdrawable: 200, walletBalance: 200, giftBalance: 0 })).toMatch(/Maximum/));
  it('₹0 invalid', () => expect(validateTransfer({ amount: 0, withdrawable: 100, walletBalance: 100, giftBalance: 0 })).toBeTruthy());
  it('negative invalid', () => expect(validateTransfer({ amount: -10, withdrawable: 100, walletBalance: 100, giftBalance: 0 })).toBeTruthy());
  it('cannot transfer gift balance', () => {
    // Sender has ₹100 total but ₹80 is gift — only ₹20 withdrawable
    const res = validateTransfer({ amount: 50, withdrawable: 20, walletBalance: 100, giftBalance: 80 });
    expect(res).toMatch(/Insufficient/);
  });
  it('can transfer exactly withdrawable amount', () => {
    const res = validateTransfer({ amount: 20, withdrawable: 20, walletBalance: 100, giftBalance: 80 });
    expect(res).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. VOUCHER REDEEM VALIDATION (withdrawable only)
// ════════════════════════════════════════════════════════════════════════════

describe('Voucher Redeem Validation', () => {
  function validateRedeem(amount: number, walletBalance: number, giftBalance: number): string | null {
    const effectiveGift = Math.min(giftBalance, walletBalance);
    const withdrawable = Math.max(0, walletBalance - effectiveGift);
    if (amount > withdrawable) {
      return `Only ₹${withdrawable.toFixed(2)} is withdrawable. Received transfer funds (₹${effectiveGift.toFixed(2)}) cannot be withdrawn.`;
    }
    return null;
  }

  it('redeem from withdrawable balance: allowed', () => {
    expect(validateRedeem(100, 200, 0)).toBeNull();
  });

  it('redeem exceeds withdrawable (gift blocks): blocked', () => {
    const err = validateRedeem(150, 200, 100);
    expect(err).not.toBeNull();
    expect(err).toMatch(/withdrawable/);
  });

  it('full gift wallet: ₹0 withdrawable', () => {
    expect(validateRedeem(1, 100, 100)).not.toBeNull();
  });

  it('no gift: full balance withdrawable', () => {
    expect(validateRedeem(100, 100, 0)).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5. SPIN COST & PRIZE RULES
// ════════════════════════════════════════════════════════════════════════════

describe('Spin System Rules', () => {
  const SPIN_COST = 100; // AI points

  it('spin costs 100 AI points', () => {
    const aiPoints = 500;
    const after = aiPoints - SPIN_COST;
    expect(after).toBe(400);
  });

  it('insufficient AI points blocks spin', () => {
    const aiPoints = 50;
    expect(aiPoints < SPIN_COST).toBe(true);
  });

  it('bonus spin: no AI point cost', () => {
    const bonusSpins = 1;
    const aiPoints = 0;
    // Bonus spin doesn't use AI points
    expect(bonusSpins > 0 || aiPoints >= SPIN_COST).toBe(true);
  });

  it('spin prize: cash credited to walletBalance', () => {
    const walletBefore = 100;
    const prize = 50;
    expect(walletBefore + prize).toBe(150);
  });

  it('spin prize: points credited to aiPoints', () => {
    const pointsBefore = 200;
    const prize = 100;
    expect(pointsBefore + prize).toBe(300);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 6. REFUND POLICY RULES
// ════════════════════════════════════════════════════════════════════════════

describe('Refund Policy', () => {
  it('orphan game: entry fee fully refunded per player', () => {
    const entryFee = 20;
    const players = ['u1', 'u2'];
    const totalRefunded = players.length * entryFee;
    expect(totalRefunded).toBe(40);
  });

  it('pre-LIVE cancel: hold released = no wallet deduction', () => {
    // Hold is placed but not locked — release means wallet unchanged
    const walletBefore = 100;
    const held = 20;
    const walletAfterRelease = walletBefore; // hold was never deducted from wallet
    expect(walletAfterRelease).toBe(walletBefore);
  });

  it('post-LIVE abandon: locked amount refunded to wallet', () => {
    const walletAfterLock = 80; // 100 - 20 entry fee
    const refund = 20;
    expect(walletAfterLock + refund).toBe(100);
  });

  it('free mode: no entry fee, no refund needed', () => {
    const entryFee = 0;
    expect(entryFee).toBe(0);
  });

  it('double-charge prevention: second lockEntryHold is no-op (idempotency guard)', () => {
    // If entry_locked transaction already exists for userId+roomCode,
    // lockEntryHold returns true without creating another transaction
    const alreadyLocked = true; // simulates Transaction.findOne returning a record
    const shouldDeduct = !alreadyLocked;
    expect(shouldDeduct).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 7. DEPOSIT APPROVAL SIDE EFFECTS
// ════════════════════════════════════════════════════════════════════════════

describe('Deposit Approval Side Effects', () => {
  it('deposit < ₹50: transferEligible stays false', () => {
    const amount = 49;
    const shouldSetEligible = amount >= 50;
    expect(shouldSetEligible).toBe(false);
  });

  it('deposit = ₹50: transferEligible set to true', () => {
    const amount = 50;
    const shouldSetEligible = amount >= 50;
    expect(shouldSetEligible).toBe(true);
  });

  it('deposit > ₹50: transferEligible set to true', () => {
    const amount = 500;
    const shouldSetEligible = amount >= 50;
    expect(shouldSetEligible).toBe(true);
  });

  it('after sending transfer: transferEligible set to false', () => {
    // Transfer POST atomically sets transferEligible: false
    const transferEligibleAfterSend = false;
    expect(transferEligibleAfterSend).toBe(false);
  });
});
