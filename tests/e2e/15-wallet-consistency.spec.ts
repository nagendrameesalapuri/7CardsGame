/**
 * E2E Suite 15 — Wallet Consistency (TOTAL = AVAILABLE + HELD)
 * The fundamental invariant of the hold system:
 * walletBalance = availableBalance + heldBalance at all times.
 */
import { test, expect } from '@playwright/test';
import { guestLogin } from '../helpers/auth';
import { uniqueUsername } from '../test-data/users';
import { createApiContext } from '../utils/api';
import { HoldApiClient, reconcileWallet, assertWalletEquation } from '../utils/hold';
import {
  validateEquation,
  detectDuplicateSettlements,
  detectUnbalancedHolds,
  generateReport,
  takeSnapshot,
  computeDelta,
  validateSettlement,
  validateEntryLocked,
} from '../utils/wallet-reconciliation';
import { ENV } from '../config/env';

// ── Core equation via API ─────────────────────────────────────────────────────

test.describe('Wallet Consistency — API Equation', () => {
  test('wallet equation holds for fresh guest user', async ({ page }) => {
    await guestLogin(page, uniqueUsername('ConsAPI'));
    const token = await page.evaluate(() => localStorage.getItem('token'));

    const ctx = await createApiContext();
    try {
      const client = new HoldApiClient(ctx, token!);
      const wallet = await client.getHoldWallet();
      expect(() => assertWalletEquation(wallet)).not.toThrow();
    } finally {
      await ctx.dispose();
    }
  });

  test('reconcileWallet returns isBalanced: true for fresh user', async ({ page }) => {
    await guestLogin(page, uniqueUsername('Recon'));
    const token = await page.evaluate(() => localStorage.getItem('token'));

    const ctx = await createApiContext();
    try {
      const client = new HoldApiClient(ctx, token!);
      const wallet = await client.getHoldWallet();
      const rec = reconcileWallet(wallet);
      expect(rec.isBalanced).toBe(true);
    } finally {
      await ctx.dispose();
    }
  });

  test('reconcileWallet discrepancy < 0.01 for fresh user', async ({ page }) => {
    await guestLogin(page, uniqueUsername('ReconDisc'));
    const token = await page.evaluate(() => localStorage.getItem('token'));

    const ctx = await createApiContext();
    try {
      const client = new HoldApiClient(ctx, token!);
      const wallet = await client.getHoldWallet();
      const rec = reconcileWallet(wallet);
      expect(rec.discrepancy).toBeLessThan(0.01);
    } finally {
      await ctx.dispose();
    }
  });

  test('generateReport returns CLEAN for fresh user', async ({ page }) => {
    await guestLogin(page, uniqueUsername('Report'));
    const token = await page.evaluate(() => localStorage.getItem('token'));

    const ctx = await createApiContext();
    try {
      const client = new HoldApiClient(ctx, token!);
      const wallet = await client.getHoldWallet();
      const report = generateReport(wallet);
      expect(report.walletValid).toBe(true);
      expect(report.equationErrors).toHaveLength(0);
      expect(report.duplicateSettlements).toHaveLength(0);
      expect(report.unresolvedHolds).toHaveLength(0);
      expect(report.summary).toMatch(/CLEAN/);
    } finally {
      await ctx.dispose();
    }
  });

  test('wallet equation holds after multiple API calls', async ({ page }) => {
    await guestLogin(page, uniqueUsername('MultiAPI'));
    const token = await page.evaluate(() => localStorage.getItem('token'));

    const ctx = await createApiContext();
    try {
      const client = new HoldApiClient(ctx, token!);
      // Call wallet API 3 times — should be consistent each time
      for (let i = 0; i < 3; i++) {
        const wallet = await client.getHoldWallet();
        const result = validateEquation(wallet);
        expect(result.valid).toBe(true);
      }
    } finally {
      await ctx.dispose();
    }
  });
});

// ── Equation validator unit tests ─────────────────────────────────────────────

test.describe('Wallet Consistency — validateEquation', () => {
  test('valid state: 500 total, 50 held, 450 available', () => {
    const state = { balance: 500, heldBalance: 50, availableBalance: 450, isGuest: false, transactions: [] };
    const r = validateEquation(state);
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  test('valid state: 0 total, 0 held, 0 available', () => {
    const state = { balance: 0, heldBalance: 0, availableBalance: 0, isGuest: false, transactions: [] };
    const r = validateEquation(state);
    expect(r.valid).toBe(true);
  });

  test('invalid: total < 0', () => {
    const state = { balance: -10, heldBalance: 0, availableBalance: -10, isGuest: false, transactions: [] };
    const r = validateEquation(state);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('NEGATIVE total'))).toBe(true);
  });

  test('invalid: held < 0', () => {
    const state = { balance: 500, heldBalance: -10, availableBalance: 510, isGuest: false, transactions: [] };
    const r = validateEquation(state);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('NEGATIVE held'))).toBe(true);
  });

  test('invalid: available < 0', () => {
    const state = { balance: 500, heldBalance: 600, availableBalance: -100, isGuest: false, transactions: [] };
    const r = validateEquation(state);
    expect(r.valid).toBe(false);
  });

  test('invalid: total - held != available (discrepancy > 0.01)', () => {
    const state = { balance: 500, heldBalance: 50, availableBalance: 400, isGuest: false, transactions: [] };
    const r = validateEquation(state);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('EQUATION FAIL'))).toBe(true);
  });

  test('valid: tiny floating point difference within tolerance', () => {
    const state = { balance: 500, heldBalance: 50.001, availableBalance: 449.999, isGuest: false, transactions: [] };
    const r = validateEquation(state);
    expect(r.valid).toBe(true);
  });

  test('invalid: floating point difference beyond tolerance', () => {
    const state = { balance: 500, heldBalance: 50, availableBalance: 449.98, isGuest: false, transactions: [] };
    const r = validateEquation(state);
    expect(r.valid).toBe(false);
  });
});

// ── Duplicate settlement detection ────────────────────────────────────────────

test.describe('Wallet Consistency — Duplicate Settlement Detection', () => {
  test('no duplicates for empty transaction list', () => {
    const { duplicates } = detectDuplicateSettlements([]);
    expect(duplicates).toHaveLength(0);
  });

  test('no duplicates when one settlement per room', () => {
    const txns = [
      { _id: '1', type: 'match_settlement' as const, amount: 100, status: 'completed' as const,
        description: '', balanceBefore: 450, balanceAfter: 550, heldBefore: 0, heldAfter: 0,
        metadata: { roomCode: 'R1' }, createdAt: new Date().toISOString() },
      { _id: '2', type: 'match_settlement' as const, amount: 100, status: 'completed' as const,
        description: '', balanceBefore: 450, balanceAfter: 550, heldBefore: 0, heldAfter: 0,
        metadata: { roomCode: 'R2' }, createdAt: new Date().toISOString() },
    ];
    const { duplicates } = detectDuplicateSettlements(txns);
    expect(duplicates).toHaveLength(0);
  });

  test('detects duplicate settlement for same room', () => {
    const txns = [
      { _id: '1', type: 'match_settlement' as const, amount: 100, status: 'completed' as const,
        description: '', balanceBefore: 450, balanceAfter: 550, heldBefore: 0, heldAfter: 0,
        metadata: { roomCode: 'DUPROOM' }, createdAt: new Date().toISOString() },
      { _id: '2', type: 'match_settlement' as const, amount: 100, status: 'completed' as const,
        description: '', balanceBefore: 550, balanceAfter: 650, heldBefore: 0, heldAfter: 0,
        metadata: { roomCode: 'DUPROOM' }, createdAt: new Date().toISOString() },
    ];
    const { duplicates } = detectDuplicateSettlements(txns);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].roomCode).toBe('DUPROOM');
    expect(duplicates[0].count).toBe(2);
  });

  test('winning type is also checked for duplicates', () => {
    const txns = [
      { _id: '1', type: 'winning' as const, amount: 100, status: 'completed' as const,
        description: '', balanceBefore: 450, balanceAfter: 550, heldBefore: 0, heldAfter: 0,
        metadata: { roomCode: 'WINDUP' }, createdAt: new Date().toISOString() },
      { _id: '2', type: 'winning' as const, amount: 100, status: 'completed' as const,
        description: '', balanceBefore: 550, balanceAfter: 650, heldBefore: 0, heldAfter: 0,
        metadata: { roomCode: 'WINDUP' }, createdAt: new Date().toISOString() },
    ];
    const { duplicates } = detectDuplicateSettlements(txns);
    expect(duplicates).toHaveLength(1);
  });

  test('pending settlements are ignored by duplicate detector', () => {
    const txns = [
      { _id: '1', type: 'match_settlement' as const, amount: 100, status: 'pending' as const,
        description: '', balanceBefore: 450, balanceAfter: 550, heldBefore: 0, heldAfter: 0,
        metadata: { roomCode: 'PEND' }, createdAt: new Date().toISOString() },
      { _id: '2', type: 'match_settlement' as const, amount: 100, status: 'pending' as const,
        description: '', balanceBefore: 550, balanceAfter: 650, heldBefore: 0, heldAfter: 0,
        metadata: { roomCode: 'PEND' }, createdAt: new Date().toISOString() },
    ];
    const { duplicates } = detectDuplicateSettlements(txns);
    expect(duplicates).toHaveLength(0);
  });
});

// ── Unbalanced hold detection ─────────────────────────────────────────────────

test.describe('Wallet Consistency — Unbalanced Hold Detection', () => {
  test('no unresolved holds for empty list', () => {
    const { unresolved } = detectUnbalancedHolds([]);
    expect(unresolved).toHaveLength(0);
  });

  test('hold followed by release is resolved', () => {
    const txns = [
      { _id: '1', type: 'entry_hold' as const, amount: 50, status: 'completed' as const,
        description: '', balanceBefore: 500, balanceAfter: 500, heldBefore: 0, heldAfter: 50,
        metadata: { roomCode: 'RC01' }, createdAt: new Date().toISOString() },
      { _id: '2', type: 'entry_released' as const, amount: 50, status: 'completed' as const,
        description: '', balanceBefore: 500, balanceAfter: 500, heldBefore: 50, heldAfter: 0,
        metadata: { roomCode: 'RC01' }, createdAt: new Date().toISOString() },
    ];
    const { unresolved } = detectUnbalancedHolds(txns);
    expect(unresolved).toHaveLength(0);
  });

  test('hold followed by lock is resolved', () => {
    const txns = [
      { _id: '1', type: 'entry_hold' as const, amount: 50, status: 'completed' as const,
        description: '', balanceBefore: 500, balanceAfter: 500, heldBefore: 0, heldAfter: 50,
        metadata: { roomCode: 'RC02' }, createdAt: new Date().toISOString() },
      { _id: '2', type: 'entry_locked' as const, amount: 50, status: 'completed' as const,
        description: '', balanceBefore: 500, balanceAfter: 450, heldBefore: 50, heldAfter: 0,
        metadata: { roomCode: 'RC02' }, createdAt: new Date().toISOString() },
    ];
    const { unresolved } = detectUnbalancedHolds(txns);
    expect(unresolved).toHaveLength(0);
  });

  test('unresolved hold detected when no release or lock follows', () => {
    const txns = [
      { _id: '1', type: 'entry_hold' as const, amount: 50, status: 'completed' as const,
        description: '', balanceBefore: 500, balanceAfter: 500, heldBefore: 0, heldAfter: 50,
        metadata: { roomCode: 'UNRES' }, createdAt: new Date().toISOString() },
    ];
    const { unresolved } = detectUnbalancedHolds(txns);
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0].roomCode).toBe('UNRES');
    expect(unresolved[0].holdAmount).toBe(50);
  });
});

// ── Settlement & delta validators ─────────────────────────────────────────────

test.describe('Wallet Consistency — Settlement Validator', () => {
  test('validateSettlement passes for correct prize credit', () => {
    const before = { capturedAt: 0, balance: 450, heldBalance: 0, availableBalance: 450, transactionCount: 2 };
    const after  = { capturedAt: 1, balance: 550, heldBalance: 0, availableBalance: 550, transactionCount: 3 };
    const result = validateSettlement(before, after, 100);
    expect(result.valid).toBe(true);
  });

  test('validateSettlement fails when prize does not match delta', () => {
    const before = { capturedAt: 0, balance: 450, heldBalance: 0, availableBalance: 450, transactionCount: 2 };
    const after  = { capturedAt: 1, balance: 500, heldBalance: 0, availableBalance: 500, transactionCount: 3 };
    const result = validateSettlement(before, after, 100); // expected 100 but got 50
    expect(result.valid).toBe(false);
  });

  test('validateEntryLocked passes for correct lock delta', () => {
    const before = { capturedAt: 0, balance: 500, heldBalance: 50, availableBalance: 450, transactionCount: 1 };
    const after  = { capturedAt: 1, balance: 450, heldBalance: 0,  availableBalance: 450, transactionCount: 2 };
    const result = validateEntryLocked(before, after, 50);
    expect(result.valid).toBe(true);
  });

  test('validateEntryLocked fails when available changed during lock', () => {
    const before = { capturedAt: 0, balance: 500, heldBalance: 50, availableBalance: 450, transactionCount: 1 };
    const after  = { capturedAt: 1, balance: 450, heldBalance: 0,  availableBalance: 400, transactionCount: 2 };
    const result = validateEntryLocked(before, after, 50);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('available'))).toBe(true);
  });

  test('computeDelta calculates all deltas correctly', () => {
    const before = { capturedAt: 0, balance: 500, heldBalance: 50, availableBalance: 450, transactionCount: 1 };
    const after  = { capturedAt: 1, balance: 450, heldBalance: 0,  availableBalance: 450, transactionCount: 2 };
    const delta = computeDelta(before, after);
    expect(delta.totalDelta).toBe(-50);
    expect(delta.heldDelta).toBe(-50);
    expect(delta.availableDelta).toBe(0);
    expect(delta.newTransactions).toBe(1);
  });
});
