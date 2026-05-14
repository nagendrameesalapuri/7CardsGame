import { test, expect } from '@playwright/test';
import { guestLogin } from './helpers/auth';

test.describe('Tournament', () => {
  test.beforeEach(async ({ page }) => {
    await guestLogin(page, 'TourneyTest' + Date.now());
    await page.goto('/tournament');
    await page.waitForLoadState('networkidle');
  });

  test('tournament page loads with title', async ({ page }) => {
    await expect(page.getByText(/bot tournament/i)).toBeVisible();
  });

  test('play and history tabs are present', async ({ page }) => {
    await expect(page.getByRole('button', { name: /play/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /history/i })).toBeVisible();
  });

  test('tournament format section is visible', async ({ page }) => {
    await expect(page.getByText(/tournament format/i)).toBeVisible();
    await expect(page.getByText(/3 games|up to 3/i)).toBeVisible();
    await expect(page.getByText(/first to 2/i)).toBeVisible();
  });

  test('starter tier card shows ₹10 entry', async ({ page }) => {
    await expect(page.getByText(/starter/i)).toBeVisible();
    await expect(page.getByText(/₹10/).first()).toBeVisible();
  });

  test('champion tier card shows ₹20 entry', async ({ page }) => {
    await expect(page.getByText(/champion/i)).toBeVisible();
    await expect(page.getByText(/₹20/).first()).toBeVisible();
  });

  test('prize amounts are shown correctly', async ({ page }) => {
    await expect(page.getByText(/₹15/).first()).toBeVisible(); // starter prize
    await expect(page.getByText(/₹25/).first()).toBeVisible(); // champion prize
  });

  test('tie refund rule notice is visible', async ({ page }) => {
    await expect(page.getByText(/refund/i).first()).toBeVisible();
  });

  test('guest user sees sign-in prompt instead of enter button', async ({ page }) => {
    const enterBtns = page.getByRole('button', { name: /sign in to play/i });
    await expect(enterBtns.first()).toBeVisible();
  });

  test('history tab switches view', async ({ page }) => {
    await page.getByRole('button', { name: /history/i }).click();
    // Should show history content or empty state
    await expect(
      page.getByText(/no tournament|play your first|history/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('how it works section visible', async ({ page }) => {
    await expect(page.getByText(/how it works/i)).toBeVisible();
  });

  test('back to lobby button works', async ({ page }) => {
    await page.getByRole('button', { name: /back to lobby/i }).click();
    await expect(page).toHaveURL(/\/lobby/);
  });
});
