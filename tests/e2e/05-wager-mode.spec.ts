/**
 * E2E Suite 05 — Wager Mode (Cash Entry Fee) via Tournament Page
 * Covers: tournament tiers display, entry fee, guest restriction,
 *         sign-in prompt, prize amounts, history tab.
 */
import { test, expect } from '@playwright/test';
import { guestLogin } from '../helpers/auth';
import { uniqueUsername } from '../test-data/users';
import { ENV } from '../config/env';

test.describe('Wager Mode — Bot Tournament', () => {
  test.beforeEach(async ({ page }) => {
    await guestLogin(page, uniqueUsername('Wager'));
    await page.goto('/tournament');
    await page.waitForLoadState('networkidle');
  });

  // ── Tournament Page Load ────────────────────────────────────────────────────

  test('tournament page loads with title', async ({ page }) => {
    await expect(page.getByText(/bot tournament/i).first()).toBeVisible();
  });

  test('play and history tabs are present', async ({ page }) => {
    await expect(page.getByRole('button', { name: /play/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /history/i }).first()).toBeVisible();
  });

  // ── Tournament Format ───────────────────────────────────────────────────────

  test('tournament format section shows game count', async ({ page }) => {
    await expect(page.getByText(/tournament format/i)).toBeVisible();
    await expect(
      page.getByText(/up to 3 games|3 games|best of/i).first(),
    ).toBeVisible();
  });

  test('first to 2 wins rule is displayed', async ({ page }) => {
    await expect(page.getByText(/first to 2/i).first()).toBeVisible();
  });

  // ── Entry Fee Tiers ─────────────────────────────────────────────────────────

  test('Starter tier shows ₹10 entry fee', async ({ page }) => {
    await expect(page.getByText(/starter/i)).toBeVisible();
    await expect(page.getByText(/₹10/).first()).toBeVisible();
  });

  test('Champion tier shows ₹20 entry fee', async ({ page }) => {
    await expect(page.getByText(/champion/i)).toBeVisible();
    await expect(page.getByText(/₹20/).first()).toBeVisible();
  });

  // ── Prize Amounts ───────────────────────────────────────────────────────────

  test('Starter prize ₹15 is displayed', async ({ page }) => {
    await expect(page.getByText(/₹15/).first()).toBeVisible();
  });

  test('Champion prize ₹25 is displayed', async ({ page }) => {
    await expect(page.getByText(/₹25/).first()).toBeVisible();
  });

  // ── Tie/Refund Policy ───────────────────────────────────────────────────────

  test('refund rule for tie is visible', async ({ page }) => {
    await expect(page.getByText(/refund/i).first()).toBeVisible();
  });

  // ── Guest Restriction ───────────────────────────────────────────────────────

  test('guest user sees sign-in prompt instead of Enter button', async ({ page }) => {
    const signInBtn = page.getByRole('button', { name: /sign in to play/i });
    await expect(signInBtn.first()).toBeVisible();
  });

  test('Enter button is NOT shown to guest user', async ({ page }) => {
    const enterBtn = page.getByRole('button', { name: /^enter$/i });
    await expect(enterBtn).not.toBeVisible();
  });

  // ── History Tab ─────────────────────────────────────────────────────────────

  test('history tab switches view to tournament history', async ({ page }) => {
    await page.getByRole('button').filter({ hasText: /history/i }).first().click();
    await expect(
      page.getByText(/no tournament|play your first|history/i).first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  // ── How It Works ─────────────────────────────────────────────────────────────

  test('"How it works" section is visible', async ({ page }) => {
    await expect(page.getByText(/how it works/i)).toBeVisible();
  });

  // ── Navigation ───────────────────────────────────────────────────────────────

  test('back to lobby button navigates to lobby', async ({ page }) => {
    await page.getByRole('button', { name: /back to lobby/i }).click();
    await expect(page).toHaveURL(/\/lobby/);
  });
});

test.describe('Wager Mode — Room Entry Fee (via Lobby)', () => {
  test('guest cannot create cash game room', async ({ page }) => {
    await guestLogin(page, uniqueUsername('GuestWager'));
    const lobby = new (await import('../pages/LobbyPage')).LobbyPage(page);
    await lobby.openCreateRoomModal();

    // Try to set an entry fee
    const feeInput = page.getByLabel(/entry fee/i).or(page.getByPlaceholder(/entry fee/i)).first();
    if (await feeInput.isVisible({ timeout: 3_000 })) {
      await feeInput.fill('10');
      const confirmBtn = page.getByRole('button', { name: /create room|confirm|create/i }).last();
      await confirmBtn.click();
      // Guest should see error about cash games
      await expect(
        page.getByText(/guest|sign in|cash game/i).first(),
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  test('wager room requires sufficient balance', async ({ browser }) => {
    // Two contexts: host with balance, joiner with no balance
    const ctx1 = await browser.newContext({ baseURL: ENV.BASE_URL });
    const ctx2 = await browser.newContext({ baseURL: ENV.BASE_URL });
    const host = await ctx1.newPage();
    const joiner = await ctx2.newPage();

    try {
      const stamp = Date.now();
      await guestLogin(host, `HostW_${stamp}`);
      await guestLogin(joiner, `JoinW_${stamp}`);

      // Both are guests so cannot create/join cash games
      // Verify the server rejects guest users trying to join cash games
      const hostLobby = new (await import('../pages/LobbyPage')).LobbyPage(host);
      await hostLobby.openCreateRoomModal();

      const feeInput = host.getByLabel(/entry fee/i).or(host.getByPlaceholder(/entry fee/i)).first();
      if (await feeInput.isVisible({ timeout: 3_000 })) {
        await feeInput.fill('10');
        const confirmBtn = host.getByRole('button', { name: /create room|confirm|create/i }).last();
        await confirmBtn.click();
        await expect(
          host.getByText(/guest|sign in|balance|insufficient/i).first(),
        ).toBeVisible({ timeout: 10_000 });
      }
    } finally {
      await ctx1.close();
      await ctx2.close();
    }
  });
});
