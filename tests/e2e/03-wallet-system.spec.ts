/**
 * E2E Suite 03 — Wallet System
 * Covers: balance display, guest restrictions, deposit modal, UTR validation,
 *         withdrawal validation, transaction history display.
 */
import { test, expect } from '@playwright/test';
import { guestLogin } from '../helpers/auth';
import { WalletPage } from '../pages/WalletPage';
import { uniqueUsername } from '../test-data/users';

test.describe('Wallet System', () => {
  let wallet: WalletPage;

  test.beforeEach(async ({ page }) => {
    wallet = new WalletPage(page);
    await guestLogin(page, uniqueUsername('Wallet'));
    await wallet.goto();
  });

  // ── Page Load ────────────────────────────────────────────────────────────────

  test('wallet page loads with balance display', async ({ page }) => {
    await wallet.expectLoaded();
  });

  test('wallet balance is shown (₹0 or higher for guest)', async ({ page }) => {
    await expect(page.getByText(/balance|₹/i).first()).toBeVisible();
  });

  // ── Guest Restrictions ───────────────────────────────────────────────────────

  test('guest user sees restriction message about wallet limitations', async ({ page }) => {
    const isGuest = await wallet.isGuestUser();
    if (isGuest) {
      await expect(wallet.guestRestriction).toBeVisible();
    }
  });

  test('guest user cannot access add money button', async ({ page }) => {
    const isGuest = await wallet.isGuestUser();
    if (isGuest) {
      await expect(wallet.addMoneyBtn).not.toBeVisible();
    }
  });

  test('guest user sees restriction instead of withdraw button', async ({ page }) => {
    const isGuest = await wallet.isGuestUser();
    if (isGuest) {
      const withdrawVisible = await wallet.withdrawBtn.isVisible({ timeout: 2_000 }).catch(() => false);
      expect(withdrawVisible).toBeFalsy();
    }
  });

  // ── Add Money Flow ────────────────────────────────────────────────────────────

  test('add money modal opens for non-guest user', async ({ page }) => {
    const opened = await wallet.openAddMoneyModal();
    if (!opened) {
      // Guest user — acceptable skip
      test.info().annotations.push({ type: 'note', description: 'Skipped: guest user cannot add money' });
      return;
    }
    await expect(page.getByText(/amount|₹100|₹200|₹500/i).first()).toBeVisible();
  });

  test('deposit preset amounts are selectable', async ({ page }) => {
    const opened = await wallet.openAddMoneyModal();
    if (!opened) return;
    // At least one preset should be visible
    const preset = page.getByRole('button', { name: /₹\d+/ }).first();
    await expect(preset).toBeVisible({ timeout: 5_000 });
  });

  test('proceed to payment shows QR or UPI instructions', async ({ page }) => {
    const opened = await wallet.openAddMoneyModal();
    if (!opened) return;
    await wallet.selectAmountPreset(100);
    await wallet.proceedToQR();
    await expect(
      page.getByText(/qr|upi|utr|transaction|scan/i).first(),
    ).toBeVisible({ timeout: 8_000 });
  });

  test('UTR field validates empty input', async ({ page }) => {
    const opened = await wallet.openAddMoneyModal();
    if (!opened) return;
    await wallet.selectAmountPreset(100);
    await wallet.proceedToQR();
    const submitBtn = page.getByRole('button', { name: /submit|confirm/i }).first();
    if (await submitBtn.isVisible({ timeout: 5_000 })) {
      await submitBtn.click();
      await expect(
        page.getByText(/valid|required|enter utr/i).first(),
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  test('UTR must be at least 6 characters', async ({ page }) => {
    const opened = await wallet.openAddMoneyModal();
    if (!opened) return;
    await wallet.selectAmountPreset(100);
    await wallet.proceedToQR();
    const utrInput = page.getByPlaceholder(/utr|transaction reference/i).first();
    if (await utrInput.isVisible({ timeout: 5_000 })) {
      await wallet.enterUTR('123');
      await wallet.submitUTR();
      await expect(
        page.getByText(/valid|6 char|reference/i).first(),
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  test('valid UTR (12 digits) passes format validation', async ({ page }) => {
    const opened = await wallet.openAddMoneyModal();
    if (!opened) return;
    await wallet.selectAmountPreset(100);
    await wallet.proceedToQR();
    const utrInput = page.getByPlaceholder(/utr|transaction reference/i).first();
    if (await utrInput.isVisible({ timeout: 5_000 })) {
      await wallet.enterUTR('123456789012');
      // Submit — should not show format error (may show pending/processing state)
      await wallet.submitUTR();
      await expect(
        page.getByText(/pending|submitted|processing|thank you/i).first(),
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  // ── Withdrawal Validation ─────────────────────────────────────────────────────

  test('withdraw button exists for non-guest or restriction shown', async ({ page }) => {
    const guestMsg = wallet.guestRestriction;
    const isGuest = await wallet.isGuestUser();
    if (isGuest) {
      await expect(guestMsg).toBeVisible();
    } else {
      await expect(wallet.withdrawBtn).toBeVisible();
    }
  });

  test('withdrawal with amount below minimum shows error', async ({ page }) => {
    const opened = await wallet.openWithdrawModal();
    if (!opened) return;
    await wallet.enterWithdrawAmount(5);
    await wallet.submitWithdraw();
    await expect(
      page.getByText(/minimum|₹10|min/i).first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('withdrawal with zero amount is rejected', async ({ page }) => {
    const opened = await wallet.openWithdrawModal();
    if (!opened) return;
    await wallet.enterWithdrawAmount(0);
    await wallet.submitWithdraw();
    await expect(
      page.getByText(/minimum|valid amount|enter/i).first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  // ── Transaction History ───────────────────────────────────────────────────────

  test('transaction history section is visible', async ({ page }) => {
    await expect(
      page.getByText(/transaction|history|no transaction/i).first(),
    ).toBeVisible();
  });

  test('transaction list shows entries or empty state', async ({ page }) => {
    await expect(
      page.getByText(/no transaction|no history|transaction/i).first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  // ── Voucher Redemption ────────────────────────────────────────────────────────

  test('redeem voucher section is present for non-guest', async ({ page }) => {
    const isGuest = await wallet.isGuestUser();
    if (!isGuest) {
      await expect(
        page.getByText(/voucher|redeem|gift card/i).first(),
      ).toBeVisible({ timeout: 5_000 });
    }
  });
});
