import { Page } from '@playwright/test';

// playwright.config.ts loads root .env before tests run so ADMIN_SECRET is available
export const TEST_ADMIN_PASS = process.env.ADMIN_SECRET ?? 'admin-test-123';

export async function guestLogin(page: Page, username = 'PWTestPlayer') {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  // Step 1: click "Play as Guest" to reveal the username input
  await page.getByRole('button', { name: /play as guest/i }).click();

  // Step 2: fill "Your display name" — actual placeholder text in HomePage
  await page.getByPlaceholder(/your display name/i).fill(username);

  // Step 3: click "Start Playing"
  await page.getByRole('button', { name: /start playing/i }).click();

  await page.waitForURL('**/lobby', { timeout: 15000 });
}

export async function adminLogin(page: Page, password = TEST_ADMIN_PASS) {
  await page.goto('/admin/login');
  await page.waitForLoadState('domcontentloaded');
  await page.getByPlaceholder(/password/i).fill(password);
  await page.getByRole('button', { name: /login/i }).click();
  await page.waitForURL(/\/admin(?!\/login)/, { timeout: 10000 });
}

export async function clearAuth(page: Page) {
  try {
    await page.evaluate(() => {
      try { localStorage.clear(); } catch { /* ignore */ }
      try { sessionStorage.clear(); } catch { /* ignore */ }
    });
  } catch {
    // Page not yet initialised — safe to ignore
  }
}
