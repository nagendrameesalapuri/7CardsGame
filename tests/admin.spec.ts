import { test, expect } from '@playwright/test';
import { adminLogin, clearAuth } from './helpers/auth';

const ADMIN_PASS = process.env.ADMIN_SECRET ?? 'admin-test-123';

test.describe('Admin Panel', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuth(page);
  });

  test('admin login page loads', async ({ page }) => {
    await page.goto('/admin/login');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByPlaceholder(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /login/i })).toBeVisible();
  });

  test('wrong admin password shows error', async ({ page }) => {
    await page.goto('/admin/login');
    await page.waitForLoadState('domcontentloaded');
    await page.getByPlaceholder(/password/i).fill('wrongpassword999');
    await page.getByRole('button', { name: /login/i }).click();
    await expect(page.getByText(/invalid|incorrect|wrong/i)).toBeVisible({ timeout: 5000 });
    await expect(page).not.toHaveURL(/\/admin(?!\/login)/);
  });

  test('correct admin password logs in successfully', async ({ page }) => {
    await adminLogin(page, ADMIN_PASS);
    await expect(page).toHaveURL(/\/admin(?!\/login)/);
  });

  test('admin panel shows navigation sections', async ({ page }) => {
    await adminLogin(page, ADMIN_PASS);
    // Should have multiple sections visible
    await expect(page.getByText(/deposit/i).first()).toBeVisible();
    await expect(page.getByText(/withdrawal/i).first()).toBeVisible();
  });

  test('deposits section loads', async ({ page }) => {
    await adminLogin(page, ADMIN_PASS);
    const depositsBtn = page.getByRole('button', { name: /deposit/i }).or(
      page.getByText(/📥|deposits/i).first()
    );
    await depositsBtn.first().click();
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByText(/pending|utr|no deposit|approve/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('withdrawals section loads', async ({ page }) => {
    await adminLogin(page, ADMIN_PASS);
    const withdrawBtn = page.getByRole('button', { name: /withdrawal/i }).or(
      page.getByText(/💸|withdrawals/i).first()
    );
    await withdrawBtn.first().click();
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByText(/pending|upi|no withdrawal|approve/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('users section loads', async ({ page }) => {
    await adminLogin(page, ADMIN_PASS);
    const usersBtn = page.getByRole('button', { name: /^users$/i }).or(
      page.getByText(/👤|users/i).first()
    );
    await usersBtn.first().click();
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByText(/username|email|guest|ban/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('unauthenticated access to admin redirects to login', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForURL(/\/admin\/login/);
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
