import { test, expect, Page } from '@playwright/test';
import { adminLogin, clearAuth } from './helpers/auth';

const ADMIN_PASS = process.env.ADMIN_SECRET ?? 'admin-test-123';

async function clickAdminSection(page: Page, name: string) {
  // The sidebar nav buttons exist in DOM on both desktop and mobile.
  // On mobile they are off-screen (CSS transform translateX(-100%)), so we use
  // dispatchEvent which fires directly on the DOM element with no viewport checks.
  const navBtn = page.getByRole('button', { name: new RegExp(name, 'i') }).first();
  await navBtn.waitFor({ state: 'attached', timeout: 5000 });
  await navBtn.dispatchEvent('click');
}

test.describe('Admin Panel', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuth(page);
  });

  test('admin login page loads', async ({ page }) => {
    await page.goto('/admin/login');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByPlaceholder(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /access dashboard/i })).toBeVisible();
  });

  test('wrong admin password shows error', async ({ page }) => {
    await page.goto('/admin/login');
    await page.waitForLoadState('domcontentloaded');
    await page.getByPlaceholder(/password/i).fill('wrongpassword999');
    await page.getByRole('button', { name: /access dashboard/i }).click();
    // The inline error "Invalid admin password" should appear in the form
    await expect(page.getByText(/invalid admin password|invalid|incorrect|wrong/i)).toBeVisible({ timeout: 8000 });
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('correct admin password logs in successfully', async ({ page }) => {
    await adminLogin(page, ADMIN_PASS);
    await expect(page).toHaveURL(/\/admin(?!\/login)/);
  });

  test('admin panel shows navigation sections', async ({ page }) => {
    await adminLogin(page, ADMIN_PASS);
    await expect(page.getByText(/deposit/i).first()).toBeVisible();
    await expect(page.getByText(/withdrawal/i).first()).toBeVisible();
  });

  test('deposits section loads', async ({ page }) => {
    await adminLogin(page, ADMIN_PASS);
    await clickAdminSection(page, 'deposits');
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByText(/pending|utr|no deposit|approve/i).first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('withdrawals section loads', async ({ page }) => {
    await adminLogin(page, ADMIN_PASS);
    await clickAdminSection(page, 'withdrawals');
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByText(/pending|upi|no withdrawal|approve/i).first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('users section loads', async ({ page }) => {
    await adminLogin(page, ADMIN_PASS);
    await clickAdminSection(page, 'users');
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByText(/username|email|guest|ban/i).first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('unauthenticated access to admin redirects to login', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForURL(/\/admin\/login/);
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
