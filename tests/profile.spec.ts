import { test, expect } from '@playwright/test';
import { guestLogin } from './helpers/auth';

test.describe('Profile', () => {
  const username = 'ProfileTest' + Math.floor(Math.random() * 9999);

  test.beforeEach(async ({ page }) => {
    await guestLogin(page, username);
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
  });

  test('profile page loads', async ({ page }) => {
    // Use heading to avoid hidden desktop nav links on mobile
    await expect(page.getByRole('heading').first()).toBeVisible();
  });

  test('username is displayed on profile', async ({ page }) => {
    // Username shown in h2 on profile page (not the hidden header span)
    await expect(page.getByRole('heading', { name: new RegExp(username, 'i') })).toBeVisible({ timeout: 8000 });
  });

  test('stats section is visible', async ({ page }) => {
    await expect(
      page.getByText(/wins|games|stats|played/i).first()
    ).toBeVisible({ timeout: 5000 });
  });
});
