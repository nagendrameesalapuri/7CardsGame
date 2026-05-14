import { test, expect } from '@playwright/test';
import { guestLogin } from './helpers/auth';

test.describe('Leaderboard', () => {
  test.beforeEach(async ({ page }) => {
    await guestLogin(page, 'LeaderTest' + Date.now());
    await page.goto('/leaderboard');
    await page.waitForLoadState('networkidle');
  });

  test('leaderboard page loads', async ({ page }) => {
    // Use heading role to find the page h1 (avoids hidden desktop nav links on mobile)
    await expect(page.getByRole('heading', { name: /leaderboard/i })).toBeVisible();
  });

  test('shows player rankings or empty state', async ({ page }) => {
    await expect(
      page.getByText(/rank|player|no players|be the first/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('back navigation works', async ({ page }) => {
    const backBtn = page.getByRole('button', { name: /back|lobby/i }).first();
    if (await backBtn.isVisible()) {
      await backBtn.click();
      await expect(page).toHaveURL(/\/lobby/);
    }
  });
});
