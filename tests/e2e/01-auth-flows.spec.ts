/**
 * E2E Suite 01 — Authentication Flows
 * Covers: home page, guest login, validation, session persistence, protected routes, logout.
 */
import { test, expect } from '@playwright/test';
import { HomePage } from '../pages/HomePage';
import { LobbyPage } from '../pages/LobbyPage';
import { uniqueUsername } from '../test-data/users';

test.describe('Authentication Flows', () => {
  let home: HomePage;

  test.beforeEach(async ({ page }) => {
    home = new HomePage(page);
    // Clear auth state
    await page.goto('/');
    await page.evaluate(() => {
      try { localStorage.clear(); } catch { /* ignore */ }
    });
  });

  // ── Home Page ───────────────────────────────────────────────────────────────

  test('home page has correct title', async ({ page }) => {
    await home.goto();
    await expect(page).toHaveTitle(/Arena of Sevens/i);
  });

  test('home page shows Google and Guest sign-in options', async ({ page }) => {
    await home.goto();
    await home.expectLoaded();
    await expect(home.googleBtn).toBeVisible();
  });

  test('clicking Play as Guest reveals username form', async ({ page }) => {
    await home.goto();
    await home.guestBtn.click();
    await home.expectGuestFormVisible();
  });

  // ── Guest Login Validation ──────────────────────────────────────────────────

  test('Start Playing is disabled for empty username', async ({ page }) => {
    await home.goto();
    await home.guestBtn.click();
    await expect(home.startPlayingBtn).toBeDisabled();
  });

  test('Start Playing is disabled for 1-character username', async ({ page }) => {
    await home.goto();
    await home.guestBtn.click();
    await home.usernameInput.fill('a');
    await expect(home.startPlayingBtn).toBeDisabled();
  });

  test('Start Playing is enabled for 2+ character username', async ({ page }) => {
    await home.goto();
    await home.guestBtn.click();
    await home.usernameInput.fill('ab');
    await expect(home.startPlayingBtn).toBeEnabled();
  });

  test('username is trimmed to 20 characters max', async ({ page }) => {
    await home.goto();
    await home.guestBtn.click();
    await home.usernameInput.fill('A'.repeat(25));
    // The input should cap at 20 characters (maxLength or server-side trim)
    const value = await home.usernameInput.inputValue();
    expect(value.length).toBeLessThanOrEqual(20);
  });

  // ── Successful Guest Login ──────────────────────────────────────────────────

  test('valid guest login navigates to lobby', async ({ page }) => {
    await home.goto();
    await home.guestLogin(uniqueUsername('Auth'));
    await expect(page).toHaveURL(/\/lobby/);
  });

  test('auth token stored in localStorage after login', async ({ page }) => {
    await home.goto();
    await home.guestLogin(uniqueUsername('TokenTest'));
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();
  });

  test('user info persists on page refresh', async ({ page }) => {
    await home.goto();
    await home.guestLogin(uniqueUsername('Persist'));
    await page.reload();
    await page.waitForLoadState('networkidle');
    // Should stay on lobby (auto-auth from token)
    await expect(page).toHaveURL(/\/lobby/);
  });

  // ── Back Button ─────────────────────────────────────────────────────────────

  test('back button in guest form returns to home screen', async ({ page }) => {
    await home.goto();
    await home.guestBtn.click();
    await home.expectGuestFormVisible();
    const backBtn = page.getByText(/← back|back/i).first();
    if (await backBtn.isVisible({ timeout: 3_000 })) {
      await backBtn.click();
      await expect(home.guestBtn).toBeVisible();
    }
  });

  // ── Protected Route Redirects ───────────────────────────────────────────────

  test('unauthenticated access to /lobby redirects to home', async ({ page }) => {
    await page.evaluate(() => localStorage.clear());
    await page.goto('/lobby');
    await page.waitForURL('/', { timeout: 10_000 });
    await expect(page).toHaveURL('/');
  });

  test('unauthenticated access to /wallet redirects to home', async ({ page }) => {
    await page.evaluate(() => localStorage.clear());
    await page.goto('/wallet');
    await page.waitForURL('/', { timeout: 10_000 });
    await expect(page).toHaveURL('/');
  });

  test('unauthenticated access to /tournament redirects to home', async ({ page }) => {
    await page.evaluate(() => localStorage.clear());
    await page.goto('/tournament');
    await page.waitForURL('/', { timeout: 10_000 });
    await expect(page).toHaveURL('/');
  });

  test('unauthenticated access to /profile redirects to home', async ({ page }) => {
    await page.evaluate(() => localStorage.clear());
    await page.goto('/profile');
    await page.waitForURL('/', { timeout: 10_000 });
    await expect(page).toHaveURL('/');
  });

  // ── Logout ──────────────────────────────────────────────────────────────────

  test('logout clears session and returns to home', async ({ page }) => {
    await home.goto();
    await home.guestLogin(uniqueUsername('Logout'));
    await page.getByRole('button', { name: /logout/i }).click();
    await page.waitForURL('/', { timeout: 10_000 });
    await expect(page).toHaveURL('/');
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeFalsy();
  });

  test('after logout, navigating to lobby redirects to home', async ({ page }) => {
    await home.goto();
    await home.guestLogin(uniqueUsername('LogoutRedir'));
    await page.getByRole('button', { name: /logout/i }).click();
    await page.waitForURL('/', { timeout: 10_000 });
    await page.goto('/lobby');
    await page.waitForURL('/', { timeout: 10_000 });
    await expect(page).toHaveURL('/');
  });

  // ── Invalid Token Handling ──────────────────────────────────────────────────

  test('invalid/expired token in localStorage redirects to home', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('token', 'invalid.jwt.token');
    });
    await page.goto('/lobby');
    await page.waitForURL('/', { timeout: 15_000 });
    await expect(page).toHaveURL('/');
  });
});
