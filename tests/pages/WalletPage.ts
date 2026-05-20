import { Page, Locator, expect } from '@playwright/test';

export class WalletPage {
  readonly page: Page;

  readonly balanceDisplay: Locator;
  readonly addMoneyBtn: Locator;
  readonly withdrawBtn: Locator;
  readonly guestRestriction: Locator;
  readonly transactionList: Locator;
  readonly transactionEmpty: Locator;

  constructor(page: Page) {
    this.page = page;
    this.balanceDisplay   = page.getByText(/wallet balance/i).first();
    this.addMoneyBtn      = page.getByRole('button', { name: /add money/i });
    this.withdrawBtn      = page.getByRole('button', { name: /withdraw/i }).first();
    this.guestRestriction = page.getByText(/guest accounts cannot/i);
    this.transactionList  = page.locator('.transaction-list, [data-testid="transaction-list"]').first();
    this.transactionEmpty = page.getByText(/no transaction|no history/i).first();
  }

  async goto() {
    await this.page.goto('/wallet');
    await this.page.waitForLoadState('networkidle');
  }

  async expectLoaded() {
    await expect(this.balanceDisplay).toBeVisible();
  }

  async getDisplayedBalance(): Promise<number> {
    // Balance text looks like "₹500.00" or "500"
    const allText = await this.page.evaluate(() => document.body.innerText);
    const match = allText.match(/₹\s*([\d,]+(?:\.\d+)?)/);
    if (!match) return 0;
    return parseFloat(match[1].replace(/,/g, ''));
  }

  async isGuestUser(): Promise<boolean> {
    return this.guestRestriction.isVisible({ timeout: 5_000 }).catch(() => false);
  }

  // ── Add money flow ─────────────────────────────────────────────────────────

  async openAddMoneyModal(): Promise<boolean> {
    if (!await this.addMoneyBtn.isVisible({ timeout: 3_000 }).catch(() => false)) return false;
    await this.addMoneyBtn.click();
    await this.page.waitForSelector('text=/amount|₹100|₹200/i', { state: 'visible', timeout: 5_000 });
    return true;
  }

  async selectAmountPreset(amount: 100 | 200 | 500): Promise<void> {
    await this.page.getByRole('button', { name: `₹${amount}` }).click();
  }

  async proceedToQR(): Promise<void> {
    const btn = this.page.getByRole('button', { name: /paid|i.ve paid|next|proceed/i }).first();
    await btn.click({ timeout: 10_000 });
  }

  async enterUTR(utr: string): Promise<void> {
    const input = this.page.getByPlaceholder(/utr|transaction reference/i).first();
    await input.fill(utr);
  }

  async submitUTR(): Promise<void> {
    await this.page.getByRole('button', { name: /submit|confirm/i }).first().click();
  }

  // ── Withdraw flow ──────────────────────────────────────────────────────────

  async openWithdrawModal(): Promise<boolean> {
    if (!await this.withdrawBtn.isVisible({ timeout: 3_000 }).catch(() => false)) return false;
    await this.withdrawBtn.click();
    await this.page.waitForSelector('text=/amount|withdraw/i', { state: 'visible', timeout: 5_000 });
    return true;
  }

  async enterWithdrawAmount(amount: number): Promise<void> {
    const input = this.page.getByLabel(/amount/i).or(this.page.getByPlaceholder(/amount/i)).first();
    await input.fill(String(amount));
  }

  async submitWithdraw(): Promise<void> {
    await this.page.getByRole('button', { name: /submit|withdraw/i }).last().click();
  }

  // ── Transactions ───────────────────────────────────────────────────────────

  async getTransactionCount(): Promise<number> {
    const rows = this.page.locator('.transaction-row, [data-testid="transaction-row"]').or(
      this.page.locator('table tbody tr'),
    );
    return rows.count();
  }

  async getLatestTransactionText(): Promise<string> {
    const rows = this.page.locator('.transaction-row, [data-testid="transaction-row"]').or(
      this.page.locator('table tbody tr'),
    );
    const first = rows.first();
    return (await first.textContent()) ?? '';
  }

  async hasTransactionOfType(type: string): Promise<boolean> {
    const rows = this.page.locator('.transaction-row, [data-testid="transaction-row"]').or(
      this.page.locator('table tbody tr'),
    );
    const texts = await rows.allTextContents();
    return texts.some(t => t.toLowerCase().includes(type.toLowerCase()));
  }
}
