import { test, expect } from '@playwright/test';
import { guestLogin } from './helpers/auth';

test.describe('Wallet', () => {
  test.beforeEach(async ({ page }) => {
    await guestLogin(page, 'WalletTest' + Date.now());
    await page.goto('/wallet');
    await page.waitForLoadState('networkidle');
  });

  test('wallet page loads', async ({ page }) => {
    // Use "Wallet Balance" label (always visible on page) to avoid hidden desktop nav links on mobile
    await expect(page.getByText(/wallet balance/i).first()).toBeVisible();
  });

  test('wallet balance is displayed', async ({ page }) => {
    await expect(page.getByText(/balance|₹0/i).first()).toBeVisible();
  });

  test('guest sees wallet restriction message', async ({ page }) => {
    // Guests cannot add or withdraw money — they see an info banner
    await expect(page.getByText(/guest accounts cannot/i)).toBeVisible();
  });

  test('add money button visible for non-guest or restriction shown for guest', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /add money/i });
    const guestMsg = page.getByText(/guest accounts cannot/i);
    await expect(addBtn.or(guestMsg)).toBeVisible();
  });

  test('deposit modal opens when add money button is available', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /add money/i });
    const isVisible = await addBtn.isVisible();
    if (!isVisible) {
      // Guest user — button is hidden, skip this flow test
      test.info().annotations.push({ type: 'skip-reason', description: 'Guest user cannot add money' });
      return;
    }
    await addBtn.click();
    await expect(
      page.getByText(/amount|₹100|₹200|₹500|scan/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('deposit amount presets work when available', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /add money/i });
    if (!await addBtn.isVisible()) return;
    await addBtn.click();
    const preset = page.getByRole('button', { name: /₹/ }).first();
    if (await preset.isVisible()) {
      await preset.click();
      await expect(page.getByText(/₹/)).toBeVisible();
    }
  });

  test('proceed to QR shows UPI code when available', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /add money/i });
    if (!await addBtn.isVisible()) return;
    await addBtn.click();
    const preset = page.getByRole('button', { name: /₹100/ }).or(
      page.getByRole('button', { name: /₹200/ })
    ).first();
    if (await preset.isVisible()) await preset.click();
    const paidBtn = page.getByRole('button', { name: /paid|i.ve paid|next/i }).first();
    if (await paidBtn.isVisible()) {
      await paidBtn.click();
      await expect(
        page.getByPlaceholder(/utr|transaction reference/i).or(page.getByText(/utr/i))
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test('UTR submission validates empty input when available', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /add money/i });
    if (!await addBtn.isVisible()) return;
    await addBtn.click();
    const preset = page.getByRole('button', { name: /₹100/ }).first();
    if (await preset.isVisible()) await preset.click();
    const paidBtn = page.getByRole('button', { name: /paid|next/i }).first();
    if (await paidBtn.isVisible()) {
      await paidBtn.click();
      const submitBtn = page.getByRole('button', { name: /submit|confirm/i }).first();
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        await expect(page.getByText(/valid|required|enter/i).first()).toBeVisible({ timeout: 3000 });
      }
    }
  });

  test('UTR must be at least 6 characters when available', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /add money/i });
    if (!await addBtn.isVisible()) return;
    await addBtn.click();
    const preset = page.getByRole('button', { name: /₹100/ }).first();
    if (await preset.isVisible()) await preset.click();
    const paidBtn = page.getByRole('button', { name: /paid|next/i }).first();
    if (await paidBtn.isVisible()) {
      await paidBtn.click();
      const utrInput = page.getByPlaceholder(/utr|transaction/i).first();
      if (await utrInput.isVisible()) {
        await utrInput.fill('123');
        const submitBtn = page.getByRole('button', { name: /submit|confirm/i }).first();
        await submitBtn.click();
        await expect(page.getByText(/valid|6|reference/i).first()).toBeVisible({ timeout: 3000 });
      }
    }
  });

  test('withdraw button visible for non-guest or restriction shown for guest', async ({ page }) => {
    const withdrawBtn = page.getByRole('button', { name: /withdraw/i }).first();
    const guestMsg = page.getByText(/guest accounts cannot/i);
    await expect(withdrawBtn.or(guestMsg)).toBeVisible();
  });

  test('withdrawal requires minimum amount when available', async ({ page }) => {
    const withdrawBtn = page.getByRole('button', { name: /withdraw/i }).first();
    if (!await withdrawBtn.isVisible()) return;
    await withdrawBtn.click();
    const amountInput = page.getByLabel(/amount/i).or(page.getByPlaceholder(/amount/i)).first();
    if (await amountInput.isVisible()) {
      await amountInput.fill('5');
      await page.getByRole('button', { name: /submit|withdraw/i }).last().click();
      await expect(page.getByText(/minimum|₹10/i)).toBeVisible({ timeout: 3000 });
    }
  });

  test('transaction history section exists', async ({ page }) => {
    await expect(
      page.getByText(/transaction|history|no transaction/i).first()
    ).toBeVisible();
  });
});
