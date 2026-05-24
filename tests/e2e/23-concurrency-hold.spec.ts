/**
 * E2E Suite 23 — Concurrency & Hold System Race Conditions
 * Validates: concurrent wallet reads return consistent data,
 * parallel API calls don't violate equation, hold isolation
 * between simultaneous users.
 */
import { test, expect } from '@playwright/test';
import { guestLogin } from '../helpers/auth';
import { uniqueUsername } from '../test-data/users';
import { createApiContext } from '../utils/api';
import { HoldApiClient, reconcileWallet } from '../utils/hold';
import { validateEquation, takeSnapshot } from '../utils/wallet-reconciliation';
import { ENV } from '../config/env';

// ── Concurrent wallet reads ───────────────────────────────────────────────────

test.describe('Concurrency Hold — Parallel Wallet Reads', () => {
  test('5 concurrent wallet reads all return balanced state', async ({ page }) => {
    await guestLogin(page, uniqueUsername('ConcRead'));
    const token = await page.evaluate(() => localStorage.getItem('token'));

    const ctx = await createApiContext();
    try {
      const client = new HoldApiClient(ctx, token!);

      // Fire 5 parallel requests
      const results = await Promise.all(
        Array.from({ length: 5 }, () => client.getHoldWallet()),
      );

      for (const wallet of results) {
        const rec = reconcileWallet(wallet);
        expect(rec.isBalanced).toBe(true);
        expect(wallet.heldBalance).toBeGreaterThanOrEqual(0);
        expect(wallet.balance).toBeGreaterThanOrEqual(0);
        expect(wallet.availableBalance).toBeGreaterThanOrEqual(0);
      }
    } finally {
      await ctx.dispose();
    }
  });

  test('all concurrent reads return identical balances', async ({ page }) => {
    await guestLogin(page, uniqueUsername('ConcSame'));
    const token = await page.evaluate(() => localStorage.getItem('token'));

    const ctx = await createApiContext();
    try {
      const client = new HoldApiClient(ctx, token!);
      const results = await Promise.all(
        Array.from({ length: 3 }, () => client.getHoldWallet()),
      );

      const first = results[0];
      for (const wallet of results.slice(1)) {
        expect(wallet.balance).toBe(first.balance);
        expect(wallet.heldBalance).toBe(first.heldBalance);
        expect(wallet.availableBalance).toBe(first.availableBalance);
      }
    } finally {
      await ctx.dispose();
    }
  });

  test('sequential wallet reads produce same result', async ({ page }) => {
    await guestLogin(page, uniqueUsername('SeqRead'));
    const token = await page.evaluate(() => localStorage.getItem('token'));

    const ctx = await createApiContext();
    try {
      const client = new HoldApiClient(ctx, token!);
      const w1 = await client.getHoldWallet();
      const w2 = await client.getHoldWallet();
      expect(w1.balance).toBe(w2.balance);
      expect(w1.heldBalance).toBe(w2.heldBalance);
      expect(w1.availableBalance).toBe(w2.availableBalance);
    } finally {
      await ctx.dispose();
    }
  });
});

// ── Multi-user wallet isolation ───────────────────────────────────────────────

test.describe('Concurrency Hold — Multi-User Isolation', () => {
  test('two concurrent users have independent held balances', async ({ browser }) => {
    const ctx1 = await browser.newContext({ baseURL: ENV.BASE_URL });
    const ctx2 = await browser.newContext({ baseURL: ENV.BASE_URL });
    const p1 = await ctx1.newPage();
    const p2 = await ctx2.newPage();

    try {
      const stamp = Date.now();
      await Promise.all([
        guestLogin(p1, `ConcHold1_${stamp}`),
        guestLogin(p2, `ConcHold2_${stamp}`),
      ]);

      const [t1, t2] = await Promise.all([
        p1.evaluate(() => localStorage.getItem('token')),
        p2.evaluate(() => localStorage.getItem('token')),
      ]);

      const apiCtx = await createApiContext();
      try {
        const c1 = new HoldApiClient(apiCtx, t1!);
        const c2 = new HoldApiClient(apiCtx, t2!);

        const [w1, w2] = await Promise.all([c1.getHoldWallet(), c2.getHoldWallet()]);

        // Both balanced
        expect(validateEquation(w1).valid).toBe(true);
        expect(validateEquation(w2).valid).toBe(true);

        // Both start fresh
        expect(w1.heldBalance).toBe(0);
        expect(w2.heldBalance).toBe(0);
      } finally {
        await apiCtx.dispose();
      }
    } finally {
      await ctx1.close();
      await ctx2.close();
    }
  });

  test('three users log in concurrently, all get distinct tokens', async ({ browser }) => {
    const ctxs = await Promise.all([
      browser.newContext({ baseURL: ENV.BASE_URL }),
      browser.newContext({ baseURL: ENV.BASE_URL }),
      browser.newContext({ baseURL: ENV.BASE_URL }),
    ]);
    const pages = await Promise.all(ctxs.map(c => c.newPage()));

    try {
      const stamp = Date.now();
      await Promise.all(
        pages.map((p, i) => guestLogin(p, `Tri${i}_${stamp}`)),
      );

      const tokens = await Promise.all(
        pages.map(p => p.evaluate(() => localStorage.getItem('token'))),
      );

      // All tokens distinct
      const tokenSet = new Set(tokens.filter(Boolean));
      expect(tokenSet.size).toBe(3);
    } finally {
      await Promise.all(ctxs.map(c => c.close()));
    }
  });
});

// ── Concurrent room operations ────────────────────────────────────────────────

test.describe('Concurrency Hold — Rapid Wallet Requests', () => {
  test('wallet API handles burst of 10 requests', async ({ page }) => {
    await guestLogin(page, uniqueUsername('Burst'));
    const token = await page.evaluate(() => localStorage.getItem('token'));

    // Fire 10 concurrent requests via browser fetch
    const results = await page.evaluate(async (t) => {
      const requests = Array.from({ length: 10 }, () =>
        fetch('/api/wallet', { headers: { Authorization: `Bearer ${t}` } })
          .then(r => r.json())
          .catch(() => null),
      );
      return Promise.all(requests);
    }, token!);

    const nonNull = results.filter(Boolean);
    expect(nonNull.length).toBeGreaterThanOrEqual(8); // allow 2 failures

    for (const w of nonNull) {
      if (typeof w?.balance === 'number') {
        const eq = validateEquation({
          balance: w.balance,
          heldBalance: w.heldBalance ?? 0,
          availableBalance: w.availableBalance ?? w.balance,
          isGuest: w.isGuest ?? false,
          transactions: w.transactions ?? [],
        });
        expect(eq.valid).toBe(true);
      }
    }
  });

  test('wallet API does not return negative values under concurrent load', async ({ page }) => {
    await guestLogin(page, uniqueUsername('NegLoad'));
    const token = await page.evaluate(() => localStorage.getItem('token'));

    const results = await page.evaluate(async (t) => {
      const requests = Array.from({ length: 5 }, () =>
        fetch('/api/wallet', { headers: { Authorization: `Bearer ${t}` } })
          .then(r => r.json())
          .catch(() => null),
      );
      return Promise.all(requests);
    }, token!);

    for (const w of results.filter(Boolean)) {
      if (typeof w?.balance === 'number') {
        expect(w.balance).toBeGreaterThanOrEqual(0);
      }
      if (typeof w?.heldBalance === 'number') {
        expect(w.heldBalance).toBeGreaterThanOrEqual(0);
      }
      if (typeof w?.availableBalance === 'number') {
        expect(w.availableBalance).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

// ── Snapshot consistency under concurrent reads ───────────────────────────────

test.describe('Concurrency Hold — Snapshot Consistency', () => {
  test('snapshots taken concurrently are internally consistent', async ({ page }) => {
    await guestLogin(page, uniqueUsername('SnapCon'));
    const token = await page.evaluate(() => localStorage.getItem('token'));

    const ctx = await createApiContext();
    try {
      const client = new HoldApiClient(ctx, token!);
      const wallets = await Promise.all([
        client.getHoldWallet(),
        client.getHoldWallet(),
        client.getHoldWallet(),
      ]);

      const snaps = wallets.map(takeSnapshot);
      for (const snap of snaps) {
        expect(snap.balance).toBeGreaterThanOrEqual(0);
        expect(snap.heldBalance).toBeGreaterThanOrEqual(0);
        expect(snap.availableBalance).toBeGreaterThanOrEqual(0);
        expect(typeof snap.capturedAt).toBe('number');
      }
    } finally {
      await ctx.dispose();
    }
  });

  test('held balance never exceeds total under concurrent reads', async ({ page }) => {
    await guestLogin(page, uniqueUsername('HeldExCon'));
    const token = await page.evaluate(() => localStorage.getItem('token'));

    const ctx = await createApiContext();
    try {
      const client = new HoldApiClient(ctx, token!);
      const wallets = await Promise.all(
        Array.from({ length: 4 }, () => client.getHoldWallet()),
      );

      for (const w of wallets) {
        expect(w.heldBalance).toBeLessThanOrEqual(w.balance + 0.01);
      }
    } finally {
      await ctx.dispose();
    }
  });
});
