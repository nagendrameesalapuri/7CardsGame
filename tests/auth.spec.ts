import { test, expect } from '@playwright/test';
import { guestLogin, clearAuth } from './helpers/auth';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuth(page);
  });

  test('home page loads with correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/7 Cards Show/i);
  });

  test('home page shows Google and Guest buttons', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /play as guest/i })).toBeVisible();
  });

  test('clicking Play as Guest reveals username input', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('button', { name: /play as guest/i }).click();
    await expect(page.getByPlaceholder(/your display name/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /start playing/i })).toBeVisible();
  });

  test('guest login with valid username navigates to lobby', async ({ page }) => {
    await guestLogin(page, 'ValidUser' + Date.now());
    await expect(page).toHaveURL(/\/lobby/);
  });

  test('Start Playing disabled for empty username', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('button', { name: /play as guest/i }).click();
    await expect(page.getByRole('button', { name: /start playing/i })).toBeDisabled();
  });

  test('Start Playing disabled for single-char username', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('button', { name: /play as guest/i }).click();
    await page.getByPlaceholder(/your display name/i).fill('a');
    await expect(page.getByRole('button', { name: /start playing/i })).toBeDisabled();
  });

  test('2+ char username enables Start Playing', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('button', { name: /play as guest/i }).click();
    await page.getByPlaceholder(/your display name/i).fill('ab');
    await expect(page.getByRole('button', { name: /start playing/i })).toBeEnabled();
  });

  test('back button in guest mode returns to home screen', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('button', { name: /play as guest/i }).click();
    await page.getByText(/← back|back/i).first().click();
    await expect(page.getByRole('button', { name: /play as guest/i })).toBeVisible();
  });

  test('unauthenticated access to lobby redirects to home', async ({ page }) => {
    await page.goto('/lobby');
    await page.waitForURL('/');
    await expect(page).toHaveURL('/');
  });

  test('unauthenticated access to wallet redirects to home', async ({ page }) => {
    await page.goto('/wallet');
    await page.waitForURL('/');
    await expect(page).toHaveURL('/');
  });

  test('unauthenticated access to tournament redirects to home', async ({ page }) => {
    await page.goto('/tournament');
    await page.waitForURL('/');
    await expect(page).toHaveURL('/');
  });

  test('logout clears session and returns to home', async ({ page }) => {
    await guestLogin(page, 'LogoutTest' + Date.now());
    await page.getByRole('button', { name: 'Logout', exact: true }).click();
    await page.waitForURL('/', { timeout: 10000 });
    await expect(page).toHaveURL('/');
  });
});
