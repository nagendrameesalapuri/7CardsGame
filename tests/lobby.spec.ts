/**
 * Lobby regression suite
 * Covers: protected route redirects, authenticated lobby access, navigation
 */
import { test, expect } from '@playwright/test';
import { loginAsGuest, uid } from './helpers';

// ── Protected route redirects ────────────────────────────────────────────────

test.describe('Protected Routes — unauthenticated redirects', () => {
  test('/lobby redirects to / when not logged in', async ({ page }) => {
    await page.goto('/lobby');
    await expect(page).toHaveURL('/');
  });

  test('/profile redirects to / when not logged in', async ({ page }) => {
    await page.goto('/profile');
    await expect(page).toHaveURL('/');
  });

  test('/wallet redirects to / when not logged in', async ({ page }) => {
    await page.goto('/wallet');
    await expect(page).toHaveURL('/');
  });

  test('/progression redirects to / when not logged in', async ({ page }) => {
    await page.goto('/progression');
    await expect(page).toHaveURL('/');
  });
});

// ── Lobby Page (authenticated) ─────────────────────────────────────────────

test.describe('Lobby Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsGuest(page, uid(`Lobby`));
  });

  test('lobby page is reachable and visible', async ({ page }) => {
    await expect(page).toHaveURL('/lobby');
    await expect(page.getByText('Game Lobby')).toBeVisible({ timeout: 10_000 });
  });

  test('leaderboard page is accessible from lobby navigation', async ({ page }) => {
    await page.goto('/leaderboard');
    await expect(page).toHaveURL('/leaderboard');
  });

  test('progression page loads while authenticated', async ({ page }) => {
    await page.goto('/progression');
    await expect(page).toHaveURL('/progression');
    await expect(page.getByText('My Progression')).toBeVisible({ timeout: 12_000 });
  });

  test('navigating to / while authenticated redirects back to /lobby', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/lobby', { timeout: 12_000 });
  });
});
