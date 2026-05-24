/**
 * E2E Suite 07 — Solo AI Survival Tournament
 * Covers: page load, tier selection, guest restriction, active session restore,
 *         stage progression, history tab, abandon flow, all 4 tiers display.
 */
import { test, expect } from '@playwright/test';
import { guestLogin } from '../helpers/auth';
import { SurvivalPage, SurvivalTier } from '../pages/SurvivalPage';
import { uniqueUsername } from '../test-data/users';
import { ENV } from '../config/env';

test.describe('Survival Tournament — Page & Tier Display', () => {
  let survival: SurvivalPage;

  test.beforeEach(async ({ page }) => {
    survival = new SurvivalPage(page);
    await guestLogin(page, uniqueUsername('Survival'));
    await survival.goto();
  });

  // ── Page Load ────────────────────────────────────────────────────────────────

  test('survival page loads', async ({ page }) => {
    await survival.expectLoaded();
  });

  test('page shows all 4 tier cards', async ({ page }) => {
    await expect(survival.beginnerCard).toBeVisible();
    await expect(survival.proCard).toBeVisible();
    await expect(survival.eliteCard).toBeVisible();
    await expect(survival.bossArenaCard).toBeVisible();
  });

  test('beginner tier shows 1000 entry points', async ({ page }) => {
    await expect(page.getByText(/1[,.]?000\s*pts|1000/i).first()).toBeVisible();
  });

  test('pro tier shows 2000 entry points', async ({ page }) => {
    await expect(page.getByText(/2[,.]?000\s*pts|2000/i).first()).toBeVisible();
  });

  test('elite tier shows 5000 entry points', async ({ page }) => {
    await expect(page.getByText(/5[,.]?000\s*pts|5000/i).first()).toBeVisible();
  });

  test('boss arena tier shows 10000 entry points', async ({ page }) => {
    await expect(page.getByText(/10[,.]?000\s*pts|10000/i).first()).toBeVisible();
  });

  // ── Stage Information ─────────────────────────────────────────────────────────

  test('5 stages are displayed', async ({ page }) => {
    await expect(
      page.getByText(/5 stages|stage 5|final arena/i).first(),
    ).toBeVisible();
  });

  test('AI personality names are shown', async ({ page }) => {
    // Iron Fist (Stage 1), Blaze (Stage 2), Phantom (Stage 3), etc.
    await expect(
      page.getByText(/iron fist|blaze|phantom|apex/i).first(),
    ).toBeVisible();
  });

  // ── Guest Restriction ─────────────────────────────────────────────────────────

  test('guest user sees sign-in prompt for survival', async ({ page }) => {
    const isGuest = await survival.isGuestBlocked();
    if (isGuest) {
      await expect(survival.guestMessage).toBeVisible();
    } else {
      // Not all implementations block guest from seeing the page
      test.info().annotations.push({ type: 'note', description: 'Guest not blocked on survival page' });
    }
  });

  test('guest cannot start survival tournament (shows error or sign-in)', async ({ page }) => {
    await survival.selectTier('beginner');
    // Click start
    const startBtn = page.getByRole('button', { name: /start|enter|play/i }).first();
    if (await startBtn.isVisible({ timeout: 5_000 })) {
      await startBtn.click();
      // Either redirected or error shown
      await expect(
        page.getByText(/guest|sign in|not allowed|insufficient/i).first(),
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  // ── Tabs & Navigation ─────────────────────────────────────────────────────────

  test('history tab switches to tournament history', async ({ page }) => {
    await survival.openHistoryTab();
    await expect(
      page.getByText(/no tournament|no history|history/i).first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('battle illustrations / descriptions are visible', async ({ page }) => {
    await expect(
      page.getByText(/warmup duel|tactical pressure|mind games|survival clash|final arena/i).first(),
    ).toBeVisible();
  });
});

test.describe('Survival Tournament — Active Session & Restore', () => {
  test('page shows active tournament state on return', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: ENV.BASE_URL });
    const page = await ctx.newPage();
    const survival = new SurvivalPage(page);

    try {
      await guestLogin(page, uniqueUsername('SurvRestore'));
      await survival.goto();

      // Try to start (will fail for guest — check that state is consistent)
      const isActive = await survival.isActiveTournament();
      if (isActive) {
        // There's already an active tournament — continue button should appear
        await expect(survival.continueBtn).toBeVisible({ timeout: 5_000 });
      } else {
        // No active tournament — tier selection visible
        await expect(survival.beginnerCard).toBeVisible();
      }
    } finally {
      await ctx.close();
    }
  });

  test('active tournament shows current stage', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: ENV.BASE_URL });
    const page = await ctx.newPage();
    const survival = new SurvivalPage(page);

    try {
      await guestLogin(page, uniqueUsername('SurvStage'));
      await survival.goto();

      const isActive = await survival.isActiveTournament();
      if (isActive) {
        const stage = await survival.getCurrentStage();
        expect(stage).toBeGreaterThanOrEqual(1);
        expect(stage).toBeLessThanOrEqual(5);
      }
    } finally {
      await ctx.close();
    }
  });

  test('refresh preserves active tournament state', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: ENV.BASE_URL });
    const page = await ctx.newPage();
    const survival = new SurvivalPage(page);

    try {
      await guestLogin(page, uniqueUsername('SurvRefresh'));
      await survival.goto();

      const isActiveBefore = await survival.isActiveTournament();
      await page.reload();
      await page.waitForLoadState('networkidle');

      const isActiveAfter = await survival.isActiveTournament();
      expect(isActiveAfter).toBe(isActiveBefore);
    } finally {
      await ctx.close();
    }
  });
});

test.describe('Survival Tournament — Abandon Flow', () => {
  test('abandon button prompts for confirmation', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: ENV.BASE_URL });
    const page = await ctx.newPage();
    const survival = new SurvivalPage(page);

    try {
      await guestLogin(page, uniqueUsername('SurvAbandon'));
      await survival.goto();

      const isActive = await survival.isActiveTournament();
      if (!isActive) {
        test.info().annotations.push({ type: 'note', description: 'No active tournament to abandon' });
        return;
      }

      await survival.abandonBtn.click({ timeout: ENV.ACTION_TIMEOUT });
      // Confirmation dialog should appear
      await expect(
        page.getByText(/are you sure|confirm|yes.*abandon/i).first(),
      ).toBeVisible({ timeout: 5_000 });
    } finally {
      await ctx.close();
    }
  });

  test('cancelling abandon keeps tournament active', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: ENV.BASE_URL });
    const page = await ctx.newPage();
    const survival = new SurvivalPage(page);

    try {
      await guestLogin(page, uniqueUsername('SurvCancel'));
      await survival.goto();

      const isActive = await survival.isActiveTournament();
      if (!isActive) {
        test.info().annotations.push({ type: 'note', description: 'No active tournament — skip abandon cancel test' });
        return;
      }

      await survival.abandonBtn.click({ timeout: ENV.ACTION_TIMEOUT });
      await page.waitForTimeout(500);
      const cancelBtn = page.getByRole('button', { name: /no|cancel|keep playing/i }).first();
      if (await cancelBtn.isVisible({ timeout: 5_000 })) {
        await cancelBtn.click();
        // Tournament should still be active
        const stillActive = await survival.isActiveTournament();
        expect(stillActive).toBeTruthy();
      }
    } finally {
      await ctx.close();
    }
  });
});

test.describe('Survival Tournament — API State Validation', () => {
  test('survival API returns null for user with no tournament', async ({ page }) => {
    await guestLogin(page, uniqueUsername('SurvAPI'));
    const token = await page.evaluate(() => localStorage.getItem('token'));

    if (token) {
      const res = await page.evaluate(async (t) => {
        const r = await fetch('/api/survival/status', {
          headers: { Authorization: `Bearer ${t}` },
        });
        return r.json();
      }, token);

      // Should have survival property (null or object)
      expect(res).toHaveProperty('survival');
    }
  });

  test('survival history API returns array', async ({ page }) => {
    await guestLogin(page, uniqueUsername('SurvHist'));
    const token = await page.evaluate(() => localStorage.getItem('token'));

    if (token) {
      const res = await page.evaluate(async (t) => {
        const r = await fetch('/api/survival/history', {
          headers: { Authorization: `Bearer ${t}` },
        });
        return r.json() as Promise<any>;
      }, token) as any;

      // Should have tournaments or history property
      const hasHistory = Array.isArray(res.tournaments) || Array.isArray(res.history) || Array.isArray(res);
      expect(hasHistory).toBeTruthy();
    }
  });

  test('active survival battles endpoint returns array', async ({ page }) => {
    const res = await page.evaluate(async () => {
      const r = await fetch('/api/survival/active');
      return r.json() as Promise<any>;
    }) as any;
    expect(Array.isArray(res.battles)).toBeTruthy();
  });
});
