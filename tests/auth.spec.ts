/**
 * Auth regression suite
 * Covers: home page, Google OAuth redirect, guest login flow, validation, redirects
 */
import { test, expect } from '@playwright/test';
import { loginAsGuest, uid } from './helpers';

// ── Home page ─────────────────────────────────────────────────────────────────

test.describe('Home Page', () => {
  test('renders game title and tagline', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Arena of Sevens');
    await expect(page.getByText('Master the SHOW')).toBeVisible();
  });

  test('renders all 6 feature chips', async ({ page }) => {
    await page.goto('/');
    const chips = ['AI Opponents', 'Arena Battles', 'Survival Mode', 'Real-time PvP', 'Skill Ranking', 'Earn Rewards'];
    for (const chip of chips) {
      await expect(page.getByText(chip)).toBeVisible();
    }
  });

  test('shows both login options', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Continue with Google')).toBeVisible();
    await expect(page.getByText('Play as Guest')).toBeVisible();
  });
});

// ── Google OAuth ──────────────────────────────────────────────────────────────

test.describe('Google OAuth', () => {
  test('clicking Continue with Google triggers auth navigation', async ({ page }) => {
    await page.goto('/');
    // Intercept navigation — we only verify that a navigation away from home is triggered
    const [navigationResponse] = await Promise.all([
      page.waitForNavigation({ timeout: 8_000 }).catch(() => null),
      page.getByText('Continue with Google').click(),
    ]);
    // Should navigate to Google OAuth OR show "not configured" error on home page
    const url = page.url();
    const errorMsg = page.getByText(/google login not available/i);
    const navigatedAway = !url.endsWith('/') && !url.endsWith('/?');
    const showsError = await errorMsg.isVisible({ timeout: 2_000 }).catch(() => false);
    // Either condition is acceptable — the button did something
    expect(navigatedAway || showsError || !!navigationResponse).toBe(true);
  });

  test('?error=google_not_configured shows informative warning', async ({ page }) => {
    await page.goto('/?error=google_not_configured');
    await expect(page.getByText(/google login not available/i)).toBeVisible();
  });

  test('?error=too_many_requests shows rate-limit warning', async ({ page }) => {
    await page.goto('/?error=too_many_requests');
    await expect(page.getByText(/too many login attempts/i)).toBeVisible();
  });
});

// ── Guest login — form UI ────────────────────────────────────────────────────

test.describe('Guest login form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByText('Play as Guest').click();
    await expect(page.getByPlaceholder('Your display name')).toBeVisible();
  });

  test('shows name input and Enter the Arena button', async ({ page }) => {
    await expect(page.getByPlaceholder('Your display name')).toBeVisible();
    await expect(page.getByText('Enter the Arena')).toBeVisible();
  });

  test('Enter the Arena button disabled for empty name', async ({ page }) => {
    const btn = page.getByText('Enter the Arena');
    expect(await btn.getAttribute('disabled') !== null || await btn.isDisabled()).toBe(true);
  });

  test('Enter the Arena button disabled for 1-character name', async ({ page }) => {
    await page.getByPlaceholder('Your display name').fill('X');
    const btn = page.getByText('Enter the Arena');
    expect(await btn.isDisabled()).toBe(true);
  });

  test('Enter the Arena button enabled for 2+ character name', async ({ page }) => {
    await page.getByPlaceholder('Your display name').fill('Jo');
    const btn = page.getByText('Enter the Arena');
    await expect(btn).toBeEnabled();
  });

  test('Enter key on single-char name shows validation error', async ({ page }) => {
    const input = page.getByPlaceholder('Your display name');
    await input.fill('A');
    await input.press('Enter');
    await expect(page.getByText(/at least 2 characters/i)).toBeVisible();
  });

  test('validation error clears when user types more characters', async ({ page }) => {
    const input = page.getByPlaceholder('Your display name');
    await input.fill('A');
    await input.press('Enter');
    await expect(page.getByText(/at least 2 characters/i)).toBeVisible();
    await input.fill('Alex');
    await expect(page.getByText(/at least 2 characters/i)).not.toBeVisible();
  });

  test('username ADMIN redirects to admin login', async ({ page }) => {
    await page.getByPlaceholder('Your display name').fill('ADMIN');
    await page.getByText('Enter the Arena').click();
    await expect(page).toHaveURL('/admin/login');
  });

  test('back button returns to main home view', async ({ page }) => {
    await page.getByText('← Back').click();
    await expect(page.getByText('Play as Guest')).toBeVisible();
    await expect(page.getByPlaceholder('Your display name')).not.toBeVisible();
  });
});

// ── Guest login — happy path ──────────────────────────────────────────────────

test.describe('Guest login — happy path', () => {
  test('logs in and lands on lobby', async ({ page }) => {
    const name = uid('Auth');
    await loginAsGuest(page, name);
    await expect(page).toHaveURL('/lobby');
    await expect(page.getByText('Game Lobby')).toBeVisible();
  });

  test('home page redirects to lobby when already authenticated', async ({ page }) => {
    await loginAsGuest(page, uid('Redir'));
    await page.goto('/');
    await expect(page).toHaveURL('/lobby');
  });

  test('lobby page title visible after login', async ({ page }) => {
    await loginAsGuest(page, uid('LobbyCheck'));
    await expect(page.getByText('Game Lobby')).toBeVisible();
  });

  test('guest error shown on server rejection', async ({ page }) => {
    // Try login with a name that has special chars blocked by server (if any)
    // More importantly, test that the error pathway works
    await page.goto('/');
    await page.getByText('Play as Guest').click();
    await page.route('**/api/auth/guest', route =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Username rejected by server' }),
      })
    );
    await page.getByPlaceholder('Your display name').fill('ValidName');
    await page.getByText('Enter the Arena').click();
    await expect(page.getByText(/username rejected/i)).toBeVisible({ timeout: 5_000 });
  });
});

// ── Protected routes ──────────────────────────────────────────────────────────

test.describe('Protected route redirects', () => {
  const protectedRoutes = ['/lobby', '/profile', '/wallet', '/progression', '/game', '/notifications'];
  for (const route of protectedRoutes) {
    test(`${route} redirects unauthenticated user to home`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL('/');
    });
  }
});

// ── Persistence ───────────────────────────────────────────────────────────────

test.describe('Auth persistence', () => {
  test('session persists on page reload', async ({ page }) => {
    await loginAsGuest(page, uid('Persist'));
    await page.reload();
    // Should remain on lobby (Zustand persisted token in localStorage)
    await expect(page.getByText('Game Lobby')).toBeVisible({ timeout: 10_000 });
  });
});
