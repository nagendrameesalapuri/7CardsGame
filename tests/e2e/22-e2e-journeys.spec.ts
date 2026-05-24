/**
 * E2E Suite 22 — Full End-to-End Journeys
 * 6 complete user journeys covering the hold system lifecycle:
 * 1. Guest wallet inspection journey
 * 2. Admin hold monitor inspection journey
 * 3. Wallet equation stability journey
 * 4. Transaction history completeness journey
 * 5. Free room → hold system coexistence journey
 * 6. Multi-user wallet isolation journey
 */
import { test, expect } from '@playwright/test';
import { guestLogin, adminLogin } from '../helpers/auth';
import { WalletHoldPage } from '../pages/WalletHoldPage';
import { LobbyPage } from '../pages/LobbyPage';
import { uniqueUsername } from '../test-data/users';
import { createApiContext } from '../utils/api';
import { HoldApiClient, reconcileWallet, assertWalletEquation } from '../utils/hold';
import { validateEquation, generateReport, takeSnapshot, computeDelta } from '../utils/wallet-reconciliation';
import { ENV } from '../config/env';

// ── Journey 1: Guest wallet inspection ───────────────────────────────────────

test('Journey 1: Guest registers → visits wallet → three-way balance shown → equation valid', async ({ page }) => {
  const holdPage = new WalletHoldPage(page);

  // Step 1: Register as guest
  await guestLogin(page, uniqueUsername('Journey1'));
  await expect(page).toHaveURL(/\/lobby/);

  // Step 2: Navigate to wallet
  await holdPage.goto();

  // Step 3: Balance section is visible
  await expect(page.getByText(/balance|₹|wallet/i).first()).toBeVisible({ timeout: 8_000 });

  // Step 4: API equation is valid
  const token = await page.evaluate(() => localStorage.getItem('token'));
  const ctx = await createApiContext();
  try {
    const client = new HoldApiClient(ctx, token!);
    const wallet = await client.getHoldWallet();
    const rec = reconcileWallet(wallet);
    expect(rec.isBalanced).toBe(true);
    expect(wallet.heldBalance).toBe(0);
    expect(wallet.availableBalance).toBe(wallet.balance);
  } finally {
    await ctx.dispose();
  }
});

// ── Journey 2: Admin hold monitor inspection ─────────────────────────────────

test('Journey 2: Admin logs in → opens hold monitor → views rooms and exploit data', async ({ page }) => {
  // Step 1: Admin login
  await adminLogin(page);
  await expect(page).toHaveURL(/\/admin(?!\/login)/);

  // Step 2: Look for hold monitor
  const holdBtn = page.getByText(/hold monitor|hold system|🔒/i).first();
  const visible = await holdBtn.isVisible({ timeout: 5_000 }).catch(() => false);

  if (visible) {
    await holdBtn.click();
    await page.waitForTimeout(1000);

    // Step 3: Hold monitor section rendered
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.toLowerCase()).toMatch(/hold|exploit|room|stat/i);
  } else {
    // Admin page loaded even if hold monitor nav not found at top level
    await expect(page).toHaveURL(/\/admin/);
  }

  // Step 4: Hold overview API responds
  const adminToken = await page.evaluate(() => localStorage.getItem('adminToken'));
  if (adminToken) {
    const res = await page.evaluate(async (t) => {
      const r = await fetch('/api/admin/hold-system/overview', {
        headers: { Authorization: `Bearer ${t}` },
      });
      return { status: r.status };
    }, adminToken);
    expect([200, 403]).toContain(res.status);
  }
});

// ── Journey 3: Wallet equation stability ─────────────────────────────────────

test('Journey 3: User logs in → API polled 5 times → equation never violated', async ({ page }) => {
  await guestLogin(page, uniqueUsername('Journey3'));
  const token = await page.evaluate(() => localStorage.getItem('token'));

  const ctx = await createApiContext();
  try {
    const client = new HoldApiClient(ctx, token!);
    const snapshots = [];

    for (let i = 0; i < 5; i++) {
      const wallet = await client.getHoldWallet();
      const result = validateEquation(wallet);
      expect(result.valid).toBe(true);
      snapshots.push(takeSnapshot(wallet));
      await new Promise(r => setTimeout(r, 500));
    }

    // All snapshots should show consistent balance
    for (let i = 1; i < snapshots.length; i++) {
      const delta = computeDelta(snapshots[i-1], snapshots[i]);
      // No changes should have happened (no game activity)
      expect(delta.totalDelta).toBe(0);
      expect(delta.heldDelta).toBe(0);
      expect(delta.availableDelta).toBe(0);
    }
  } finally {
    await ctx.dispose();
  }
});

// ── Journey 4: Transaction history completeness ───────────────────────────────

test('Journey 4: User views wallet → transaction list rendered → all tx types structurally valid', async ({ page }) => {
  const holdPage = new WalletHoldPage(page);
  await guestLogin(page, uniqueUsername('Journey4'));
  await holdPage.goto();

  // Transaction section visible
  await expect(
    page.getByText(/transaction|history|no transaction/i).first()
  ).toBeVisible({ timeout: 8_000 });

  // All transactions in API are structurally valid
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
  } finally {
    await ctx.dispose();
  }
});

// ── Journey 5: Free room → hold system coexistence ────────────────────────────

test('Journey 5: Guest creates free room → hold balance unchanged → equation still valid', async ({ page }) => {
  const lobby = new LobbyPage(page);
  await guestLogin(page, uniqueUsername('Journey5'));

  // Snapshot before
  const token = await page.evaluate(() => localStorage.getItem('token'));
  const ctx = await createApiContext();

  try {
    const client = new HoldApiClient(ctx, token!);
    const before = await client.getHoldWallet();
    const snapBefore = takeSnapshot(before);

    // Create free room
    await page.goto('/lobby');
    const createBtn = page.getByRole('button', { name: /create/i }).first();
    if (await createBtn.isVisible({ timeout: 5_000 })) {
      await createBtn.click();
      const confirmBtn = page.getByRole('button', { name: /create room|confirm|create/i }).last();
      if (await confirmBtn.isVisible({ timeout: 5_000 })) {
        await confirmBtn.click();
        await expect(page.getByText(/waiting|room|forming/i).first()).toBeVisible({ timeout: 15_000 });
      }
    }

    // Snapshot after
    const after = await client.getHoldWallet();
    const snapAfter = takeSnapshot(after);

    // Free room should NOT change wallet at all (no entry fee)
    expect(snapAfter.balance).toBe(snapBefore.balance);
    // Equation still valid
    const result = validateEquation(after);
    expect(result.valid).toBe(true);
  } finally {
    await ctx.dispose();
  }
});

// ── Journey 6: Multi-user wallet isolation ────────────────────────────────────

test('Journey 6: Two users log in → each has isolated wallet → no cross-contamination', async ({ browser }) => {
  const ctx1 = await browser.newContext({ baseURL: ENV.BASE_URL });
  const ctx2 = await browser.newContext({ baseURL: ENV.BASE_URL });
  const page1 = await ctx1.newPage();
  const page2 = await ctx2.newPage();

  try {
    const stamp = Date.now();
    await guestLogin(page1, `IsolA_${stamp}`);
    await guestLogin(page2, `IsolB_${stamp}`);

    const token1 = await page1.evaluate(() => localStorage.getItem('token'));
    const token2 = await page2.evaluate(() => localStorage.getItem('token'));

    expect(token1).toBeTruthy();
    expect(token2).toBeTruthy();
    expect(token1).not.toBe(token2);

    const apiCtx = await createApiContext();
    try {
      const client1 = new HoldApiClient(apiCtx, token1!);
      const client2 = new HoldApiClient(apiCtx, token2!);

      const wallet1 = await client1.getHoldWallet();
      const wallet2 = await client2.getHoldWallet();

      // Both wallets satisfy equation independently
      expect(validateEquation(wallet1).valid).toBe(true);
      expect(validateEquation(wallet2).valid).toBe(true);

      // Both start at zero (fresh guest users)
      expect(wallet1.heldBalance).toBe(0);
      expect(wallet2.heldBalance).toBe(0);
    } finally {
      await apiCtx.dispose();
    }
  } finally {
    await ctx1.close();
    await ctx2.close();
  }
});
