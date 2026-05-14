import { test, expect } from '@playwright/test';
import { guestLogin } from './helpers/auth';

test.describe('Wallet', () => {
  test.beforeEach(async ({ page }) => {
    await guestLogin(page, 'WalletTest' + Date.now());
    await page.goto('/wallet');
    await page.waitForLoadState('networkidle');
  });

  test('wallet page loads', async ({ page }) => {
    await expect(page.getByText(/wallet/i).first()).toBeVisible();
  });

  test('wallet balance is displayed', async ({ page }) => {
    await expect(page.getByText(/balance|₹0/i).first()).toBeVisible();
  });

  test('add money button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /add money/i })).toBeVisible();
  });

  test('deposit modal opens on add money click', async ({ page }) => {
    await page.getByRole('button', { name: /add money/i }).click();
    // Should show amount options or QR
    await expect(
      page.getByText(/amount|₹100|₹200|₹500|scan/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('deposit step 1 - amount presets work', async ({ page }) => {
    await page.getByRole('button', { name: /add money/i }).click();
    const preset = page.getByRole('button', { name: /₹/ }).first();
    if (await preset.isVisible()) {
      await preset.click();
      // Amount should be reflected
      await expect(page.getByText(/₹/)).toBeVisible();
    }
  });

  test('deposit step 1 - proceed to QR shows UPI code', async ({ page }) => {
    await page.getByRole('button', { name: /add money/i }).click();
    // Pick an amount
    const preset = page.getByRole('button', { name: /₹100/ }).or(
      page.getByRole('button', { name: /₹200/ })
    ).first();
    if (await preset.isVisible()) await preset.click();

    const paidBtn = page.getByRole('button', { name: /paid|i.ve paid|next/i }).first();
    if (await paidBtn.isVisible()) {
      await paidBtn.click();
      // Step 2: UTR input
      await expect(
        page.getByPlaceholder(/utr|transaction reference/i).or(page.getByText(/utr/i))
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test('UTR submission validates empty input', async ({ page }) => {
    await page.getByRole('button', { name: /add money/i }).click();
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

  test('UTR must be at least 6 characters', async ({ page }) => {
    await page.getByRole('button', { name: /add money/i }).click();
    const preset = page.getByRole('button', { name: /₹100/ }).first();
    if (await preset.isVisible()) await preset.click();
    const paidBtn = page.getByRole('button', { name: /paid|next/i }).first();
    if (await paidBtn.isVisible()) {
      await paidBtn.click();
      const utrInput = page.getByPlaceholder(/utr|transaction/i).first();
      if (await utrInput.isVisible()) {
        await utrInput.fill('123'); // too short
        const submitBtn = page.getByRole('button', { name: /submit|confirm/i }).first();
        await submitBtn.click();
        await expect(page.getByText(/valid|6|reference/i).first()).toBeVisible({ timeout: 3000 });
      }
    }
  });

  test('withdrawal button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /withdraw/i })).toBeVisible();
  });

  test('withdrawal requires minimum amount', async ({ page }) => {
    const withdrawBtn = page.getByRole('button', { name: /withdraw/i }).first();
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
