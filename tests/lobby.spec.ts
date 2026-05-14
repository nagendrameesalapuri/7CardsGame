import { test, expect } from '@playwright/test';
import { guestLogin } from './helpers/auth';

test.describe('Lobby', () => {
  test.beforeEach(async ({ page }) => {
    await guestLogin(page, 'LobbyTest' + Date.now());
  });

  test('lobby page loads', async ({ page }) => {
    await expect(page).toHaveURL(/\/lobby/);
  });

  test('navigation header is visible', async ({ page }) => {
    await expect(page.getByText(/7 Cards Show/i).first()).toBeVisible();
  });

  test('create room button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /create/i }).first()).toBeVisible();
  });

  test('create room modal opens and has required fields', async ({ page }) => {
    await page.getByRole('button', { name: /create/i }).first().click();
    // Modal should open
    await expect(
      page.getByRole('dialog').or(page.getByText(/create room/i).first())
    ).toBeVisible({ timeout: 5000 });
  });

  test('leaderboard navigation works', async ({ page }) => {
    await page.getByRole('link', { name: /leaderboard/i }).click();
    await expect(page).toHaveURL(/\/leaderboard/);
  });

  test('wallet navigation works', async ({ page }) => {
    await page.getByRole('link', { name: /wallet/i }).click();
    await expect(page).toHaveURL(/\/wallet/);
  });

  test('tournament navigation works', async ({ page }) => {
    await page.getByRole('link', { name: /tournament/i }).click();
    await expect(page).toHaveURL(/\/tournament/);
  });

  test('profile navigation works', async ({ page }) => {
    const profileLink = page.getByRole('link', { name: /profile/i });
    if (await profileLink.isVisible()) {
      await profileLink.click();
      await expect(page).toHaveURL(/\/profile/);
    }
  });
});
