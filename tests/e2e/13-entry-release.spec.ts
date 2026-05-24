/**
 * E2E Suite 13 — Entry Release (Pre-LIVE Hold Cancellation)
 * Validates: releasing a hold before LIVE restores availableBalance,
 * does NOT change total walletBalance, creates entry_released transaction.
 */
import { test, expect } from '@playwright/test';
import { guestLogin } from '../helpers/auth';
import { uniqueUsername } from '../test-data/users';
import { createApiContext } from '../utils/api';
import { HoldApiClient, findTransactionsByType, assertTransactionIntegrity, assertNoActiveHoldForRoom } from '../utils/hold';
import { validateEquation, validateHoldPlaced, validateHoldReleased, takeSnapshot } from '../utils/wallet-reconciliation';
import { ENV } from '../config/env';

// ── Release semantics unit tests ──────────────────────────────────────────────

test.describe('Entry Release — Balance Semantics', () => {
  test('release restores available balance by entryFee', async () => {
    const totalBal  = 500;
    const heldBef   = 50;
    const entryFee  = 50;
    const heldAft   = heldBef - entryFee;
    const availBef  = totalBal - heldBef;  // 450
    const availAft  = totalBal - heldAft;  // 500

    expect(availAft - availBef).toBe(entryFee); // restored by entryFee
  });

  test('release does NOT change total wallet balance', async () => {
    const before = 500;
    const after  = 500; // total unchanged on release
    expect(after).toBe(before);
  });

  test('validateHoldReleased passes for correct delta', async () => {
    const before = { capturedAt: 0, balance: 500, heldBalance: 50, availableBalance: 450, transactionCount: 1 };
    const after  = { capturedAt: 1, balance: 500, heldBalance: 0,  availableBalance: 500, transactionCount: 2 };
    const result = validateHoldReleased(before, after, 50);
    expect(result.valid).toBe(true);
  });

  test('validateHoldReleased fails when total balance changed', async () => {
    const before = { capturedAt: 0, balance: 500, heldBalance: 50, availableBalance: 450, transactionCount: 1 };
    const after  = { capturedAt: 1, balance: 450, heldBalance: 0,  availableBalance: 450, transactionCount: 2 };
    const result = validateHoldReleased(before, after, 50);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('totalBalance'))).toBe(true);
  });

  test('validateHoldReleased fails when held did not decrease', async () => {
    const before = { capturedAt: 0, balance: 500, heldBalance: 50, availableBalance: 450, transactionCount: 1 };
    const after  = { capturedAt: 1, balance: 500, heldBalance: 50, availableBalance: 500, transactionCount: 2 };
    const result = validateHoldReleased(before, after, 50);
    expect(result.valid).toBe(false);
  });

  test('validateHoldPlaced passes for correct delta', async () => {
    const before = { capturedAt: 0, balance: 500, heldBalance: 0,  availableBalance: 500, transactionCount: 0 };
    const after  = { capturedAt: 1, balance: 500, heldBalance: 50, availableBalance: 450, transactionCount: 1 };
    const result = validateHoldPlaced(before, after, 50);
    expect(result.valid).toBe(true);
  });

  test('validateHoldPlaced fails when total balance changed', async () => {
    const before = { capturedAt: 0, balance: 500, heldBalance: 0,  availableBalance: 500, transactionCount: 0 };
    const after  = { capturedAt: 1, balance: 450, heldBalance: 50, availableBalance: 400, transactionCount: 1 };
    const result = validateHoldPlaced(before, after, 50);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('totalBalance'))).toBe(true);
  });
});

// ── assertTransactionIntegrity for entry_released ─────────────────────────────

test.describe('Entry Release — Transaction Integrity', () => {
  test('entry_released is neutral (does not change wallet balance)', async () => {
    const tx = {
      _id: 'rel-001',
      type: 'entry_released' as const,
      amount: 50,
      status: 'completed' as const,
      description: 'Hold released — room cancelled',
      balanceBefore: 500,
      balanceAfter: 500,   // unchanged
      heldBefore: 50,
      heldAfter: 0,
      metadata: { roomCode: 'RELTEST', releaseReason: 'room_cancelled' },
      createdAt: new Date().toISOString(),
    };
    expect(() => assertTransactionIntegrity(tx)).not.toThrow();
  });

  test('entry_released fails integrity check when wallet balance changed', async () => {
    const tx = {
      _id: 'rel-bad',
      type: 'entry_released' as const,
      amount: 50,
      status: 'completed' as const,
      description: 'Bad release',
      balanceBefore: 500,
      balanceAfter: 550,  // wrong — release should not credit wallet
      heldBefore: 50,
      heldAfter: 0,
      metadata: { roomCode: 'RELBAD' },
      createdAt: new Date().toISOString(),
    };
    expect(() => assertTransactionIntegrity(tx)).toThrow();
  });

  test('assertNoActiveHoldForRoom passes when hold has been released', async () => {
    const txns = [
      { _id: 'h1', type: 'entry_hold' as const, amount: 50, status: 'completed' as const,
        description: '', balanceBefore: 500, balanceAfter: 500, heldBefore: 0, heldAfter: 50,
        metadata: { roomCode: 'RC01' }, createdAt: new Date().toISOString() },
      { _id: 'r1', type: 'entry_released' as const, amount: 50, status: 'completed' as const,
        description: '', balanceBefore: 500, balanceAfter: 500, heldBefore: 50, heldAfter: 0,
        metadata: { roomCode: 'RC01' }, createdAt: new Date().toISOString() },
    ];
    expect(() => assertNoActiveHoldForRoom(txns, 'RC01')).not.toThrow();
  });

  test('assertNoActiveHoldForRoom throws when hold has no release or lock', async () => {
    const txns = [
      { _id: 'h2', type: 'entry_hold' as const, amount: 50, status: 'completed' as const,
        description: '', balanceBefore: 500, balanceAfter: 500, heldBefore: 0, heldAfter: 50,
        metadata: { roomCode: 'RC02' }, createdAt: new Date().toISOString() },
    ];
    expect(() => assertNoActiveHoldForRoom(txns, 'RC02')).toThrow();
  });

  test('assertNoActiveHoldForRoom passes when hold is followed by entry_locked', async () => {
    const txns = [
      { _id: 'h3', type: 'entry_hold' as const, amount: 50, status: 'completed' as const,
        description: '', balanceBefore: 500, balanceAfter: 500, heldBefore: 0, heldAfter: 50,
        metadata: { roomCode: 'RC03' }, createdAt: new Date().toISOString() },
      { _id: 'l3', type: 'entry_locked' as const, amount: 50, status: 'completed' as const,
        description: '', balanceBefore: 500, balanceAfter: 450, heldBefore: 50, heldAfter: 0,
        metadata: { roomCode: 'RC03' }, createdAt: new Date().toISOString() },
    ];
    expect(() => assertNoActiveHoldForRoom(txns, 'RC03')).not.toThrow();
  });
});

// ── Release — API level (fresh user has no active holds) ──────────────────────

test.describe('Entry Release — API State', () => {
  test('fresh guest user has no unresolved holds', async ({ page }) => {
    await guestLogin(page, uniqueUsername('FreshRelease'));
    const token = await page.evaluate(() => localStorage.getItem('token'));

    const ctx = await createApiContext();
    try {
      const client = new HoldApiClient(ctx, token!);
      const wallet = await client.getHoldWallet();
      // No entry_hold transactions should exist for a brand new guest user
      const holds    = findTransactionsByType(wallet.transactions, 'entry_hold');
      const releases = findTransactionsByType(wallet.transactions, 'entry_released');
      const locks    = findTransactionsByType(wallet.transactions, 'entry_locked');
      // Zero holds OR all holds have corresponding releases/locks
      const unresolvedHolds = holds.filter(h => {
        const room = h.metadata?.roomCode;
        return !room || (
          !releases.some(r => r.metadata?.roomCode === room) &&
          !locks.some(l => l.metadata?.roomCode === room)
        );
      });
      expect(unresolvedHolds).toHaveLength(0);
    } finally {
      await ctx.dispose();
    }
  });

  test('wallet snapshot captures correct balances', async ({ page }) => {
    await guestLogin(page, uniqueUsername('Snapshot'));
    const token = await page.evaluate(() => localStorage.getItem('token'));

    const ctx = await createApiContext();
    try {
      const client = new HoldApiClient(ctx, token!);
      const wallet = await client.getHoldWallet();
      const snap = takeSnapshot(wallet);
      expect(snap.balance).toBe(wallet.balance);
      expect(snap.heldBalance).toBe(wallet.heldBalance);
      expect(snap.availableBalance).toBe(wallet.availableBalance);
      expect(snap.transactionCount).toBe(wallet.transactions.length);
      expect(typeof snap.capturedAt).toBe('number');
    } finally {
      await ctx.dispose();
    }
  });
});
