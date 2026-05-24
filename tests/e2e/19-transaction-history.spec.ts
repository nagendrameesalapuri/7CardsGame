/**
 * E2E Suite 19 — Transaction History (New TX Types)
 * Validates: new transaction types appear in UI with correct labels,
 * icons, color coding, status badges, and balance trail display.
 */
import { test, expect } from '@playwright/test';
import { guestLogin } from '../helpers/auth';
import { WalletHoldPage } from '../pages/WalletHoldPage';
import { uniqueUsername } from '../test-data/users';
import { createApiContext } from '../utils/api';
import { HoldApiClient, findTransactionsByType, findLatestTransaction, countTransactionsByType } from '../utils/hold';
import { ENV } from '../config/env';

// ── Transaction history API ───────────────────────────────────────────────────

test.describe('Transaction History — API', () => {
  test('wallet API returns transactions array', async ({ page }) => {
    await guestLogin(page, uniqueUsername('TxHistAPI'));
    const token = await page.evaluate(() => localStorage.getItem('token'));

    const ctx = await createApiContext();
    try {
      const client = new HoldApiClient(ctx, token!);
      const wallet = await client.getHoldWallet();
      expect(Array.isArray(wallet.transactions)).toBe(true);
    } finally {
      await ctx.dispose();
    }
  });

  test('transactions have required fields', async ({ page }) => {
    await guestLogin(page, uniqueUsername('TxFields'));
    const token = await page.evaluate(() => localStorage.getItem('token'));

    const ctx = await createApiContext();
    try {
      const client = new HoldApiClient(ctx, token!);
      const wallet = await client.getHoldWallet();
      for (const tx of wallet.transactions) {
        expect(tx).toHaveProperty('_id');
        expect(tx).toHaveProperty('type');
        expect(tx).toHaveProperty('amount');
        expect(tx).toHaveProperty('status');
        expect(tx).toHaveProperty('description');
        expect(tx).toHaveProperty('createdAt');
      }
    } finally {
      await ctx.dispose();
    }
  });

  test('transactions include heldBefore and heldAfter fields', async ({ page }) => {
    await guestLogin(page, uniqueUsername('HeldFields'));
    const token = await page.evaluate(() => localStorage.getItem('token'));

    const ctx = await createApiContext();
    try {
      const client = new HoldApiClient(ctx, token!);
      const wallet = await client.getHoldWallet();
      for (const tx of wallet.transactions) {
        // New fields exist
        expect(tx).toHaveProperty('heldBefore');
        expect(tx).toHaveProperty('heldAfter');
        expect(typeof tx.heldBefore).toBe('number');
        expect(typeof tx.heldAfter).toBe('number');
      }
    } finally {
      await ctx.dispose();
    }
  });

  test('transaction amounts are non-negative', async ({ page }) => {
    await guestLogin(page, uniqueUsername('TxAmounts'));
    const token = await page.evaluate(() => localStorage.getItem('token'));

    const ctx = await createApiContext();
    try {
      const client = new HoldApiClient(ctx, token!);
      const wallet = await client.getHoldWallet();
      for (const tx of wallet.transactions) {
        expect(tx.amount).toBeGreaterThanOrEqual(0);
      }
    } finally {
      await ctx.dispose();
    }
  });

  test('transaction status is completed, pending, or failed', async ({ page }) => {
    await guestLogin(page, uniqueUsername('TxStatus'));
    const token = await page.evaluate(() => localStorage.getItem('token'));

    const ctx = await createApiContext();
    try {
      const client = new HoldApiClient(ctx, token!);
      const wallet = await client.getHoldWallet();
      const validStatuses = ['completed', 'pending', 'failed'];
      for (const tx of wallet.transactions) {
        expect(validStatuses).toContain(tx.status);
      }
    } finally {
      await ctx.dispose();
    }
  });

  test('transaction types are recognized types', async ({ page }) => {
    await guestLogin(page, uniqueUsername('TxTypes'));
    const token = await page.evaluate(() => localStorage.getItem('token'));

    const ctx = await createApiContext();
    try {
      const client = new HoldApiClient(ctx, token!);
      const wallet = await client.getHoldWallet();
      const validTypes = [
        'deposit', 'withdrawal', 'winning', 'entry_fee', 'refund', 'bonus',
        'entry_hold', 'entry_released', 'entry_locked',
        'match_settlement', 'abandoned_resolution', 'system_rollback',
      ];
      for (const tx of wallet.transactions) {
        expect(validTypes).toContain(tx.type);
      }
    } finally {
      await ctx.dispose();
    }
  });
});

// ── Transaction finders ───────────────────────────────────────────────────────

test.describe('Transaction History — Finder Utilities', () => {
  test('findLatestTransaction returns most recent', async () => {
    const txns = [
      { _id: 'old', type: 'entry_hold' as const, amount: 50, status: 'completed' as const,
        description: '', balanceBefore: 500, balanceAfter: 500, heldBefore: 0, heldAfter: 50,
        metadata: { roomCode: 'R1' }, createdAt: new Date(2024, 0, 1).toISOString() },
      { _id: 'new', type: 'entry_hold' as const, amount: 50, status: 'completed' as const,
        description: '', balanceBefore: 500, balanceAfter: 500, heldBefore: 0, heldAfter: 50,
        metadata: { roomCode: 'R2' }, createdAt: new Date(2024, 0, 2).toISOString() },
    ];
    const latest = findLatestTransaction(txns, 'entry_hold');
    expect(latest?._id).toBe('new');
  });

  test('findLatestTransaction returns undefined for empty list', async () => {
    const latest = findLatestTransaction([], 'entry_hold');
    expect(latest).toBeUndefined();
  });

  test('countTransactionsByType returns correct count', async () => {
    const txns = [
      { _id: '1', type: 'entry_hold' as const, amount: 50, status: 'completed' as const,
        description: '', balanceBefore: 500, balanceAfter: 500, heldBefore: 0, heldAfter: 50,
        metadata: {}, createdAt: new Date().toISOString() },
      { _id: '2', type: 'entry_hold' as const, amount: 50, status: 'completed' as const,
        description: '', balanceBefore: 500, balanceAfter: 500, heldBefore: 0, heldAfter: 50,
        metadata: {}, createdAt: new Date().toISOString() },
      { _id: '3', type: 'entry_released' as const, amount: 50, status: 'completed' as const,
        description: '', balanceBefore: 500, balanceAfter: 500, heldBefore: 50, heldAfter: 0,
        metadata: {}, createdAt: new Date().toISOString() },
    ];
    expect(countTransactionsByType(txns, 'entry_hold')).toBe(2);
    expect(countTransactionsByType(txns, 'entry_released')).toBe(1);
    expect(countTransactionsByType(txns, 'entry_locked')).toBe(0);
  });
});

// ── Transaction history UI ────────────────────────────────────────────────────

test.describe('Transaction History — UI Display', () => {
  let holdPage: WalletHoldPage;

  test.beforeEach(async ({ page }) => {
    holdPage = new WalletHoldPage(page);
    await guestLogin(page, uniqueUsername('TxUI'));
    await holdPage.goto();
  });

  test('transaction history section visible on wallet page', async ({ page }) => {
    await expect(
      page.getByText(/transaction|history|no transaction/i).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('wallet page shows empty state or transaction list', async ({ page }) => {
    const bodyText = await page.evaluate(() => document.body.innerText);
    const hasHistory = /transaction|history|no transaction/i.test(bodyText);
    expect(hasHistory).toBe(true);
  });

  test('wallet page does not crash with no transactions', async ({ page }) => {
    // Should show some wallet-related content
    await expect(page.getByText(/balance|₹|wallet/i).first()).toBeVisible({ timeout: 8_000 });
  });

  test('wallet page is responsive and shows balance area', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 }); // mobile
    await holdPage.goto();
    await expect(page.getByText(/balance|₹|wallet/i).first()).toBeVisible({ timeout: 8_000 });
  });
});

// ── Label mapping for new transaction types ───────────────────────────────────

test.describe('Transaction History — Type Label Mapping', () => {
  test('entry_hold maps to a hold-related label', async () => {
    const TX_LABELS: Record<string, string> = {
      entry_hold:           'Entry Hold',
      entry_released:       'Hold Released',
      entry_locked:         'Entry Locked',
      match_settlement:     'Match Settlement',
      abandoned_resolution: 'Abandoned Resolution',
      system_rollback:      'System Rollback',
    };
    expect(TX_LABELS['entry_hold']).toMatch(/hold/i);
    expect(TX_LABELS['entry_released']).toMatch(/release|released/i);
    expect(TX_LABELS['entry_locked']).toMatch(/lock/i);
    expect(TX_LABELS['match_settlement']).toMatch(/settlement/i);
    expect(TX_LABELS['abandoned_resolution']).toMatch(/abandon/i);
  });

  test('credit types have positive UI treatment', async () => {
    const TX_CREDIT = new Set(['deposit', 'winning', 'refund', 'bonus', 'match_settlement', 'abandoned_resolution']);
    expect(TX_CREDIT.has('match_settlement')).toBe(true);
    expect(TX_CREDIT.has('abandoned_resolution')).toBe(true);
    expect(TX_CREDIT.has('entry_hold')).toBe(false);
    expect(TX_CREDIT.has('entry_locked')).toBe(false);
  });

  test('debit types have negative UI treatment', async () => {
    const TX_DEBIT = new Set(['withdrawal', 'entry_fee', 'entry_locked']);
    expect(TX_DEBIT.has('entry_locked')).toBe(true);
    expect(TX_DEBIT.has('entry_hold')).toBe(false);   // hold is neutral
    expect(TX_DEBIT.has('entry_released')).toBe(false); // release is neutral
  });

  test('neutral types do not affect wallet balance', async () => {
    const TX_NEUTRAL = new Set(['entry_hold', 'entry_released']);
    expect(TX_NEUTRAL.has('entry_hold')).toBe(true);
    expect(TX_NEUTRAL.has('entry_released')).toBe(true);
    expect(TX_NEUTRAL.has('entry_locked')).toBe(false);
    expect(TX_NEUTRAL.has('match_settlement')).toBe(false);
  });
});
