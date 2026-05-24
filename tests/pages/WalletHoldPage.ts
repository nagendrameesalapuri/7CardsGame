import { Page, Locator, expect } from '@playwright/test';

export class WalletHoldPage {
  readonly page: Page;

  // Three-way balance pills
  readonly totalBalancePill: Locator;
  readonly heldBalancePill: Locator;
  readonly availableBalancePill: Locator;

  // Transaction list
  readonly transactionList: Locator;
  readonly transactionEmpty: Locator;

  constructor(page: Page) {
    this.page = page;
    this.totalBalancePill     = page.getByText(/total/i).first();
    this.heldBalancePill      = page.getByText(/held/i).first();
    this.availableBalancePill = page.getByText(/available/i).first();
    this.transactionList      = page.locator('.transaction-list, [data-testid="transaction-list"]').first();
    this.transactionEmpty     = page.getByText(/no transaction|no history/i).first();
  }

  async goto() {
    await this.page.goto('/wallet');
    await this.page.waitForLoadState('networkidle');
  }

  // ── Balance extraction ────────────────────────────────────────────────────

  async extractBalance(label: RegExp): Promise<number> {
    const bodyText = await this.page.evaluate(() => document.body.innerText);
    const labelIdx = bodyText.search(label);
    if (labelIdx === -1) return 0;
    const slice = bodyText.slice(labelIdx, labelIdx + 60);
    const m = slice.match(/₹?\s*([\d,]+(?:\.\d+)?)/);
    return m ? parseFloat(m[1].replace(/,/g, '')) : 0;
  }

  async getTotalBalance():     Promise<number> { return this.extractBalance(/total/i); }
  async getHeldBalance():      Promise<number> { return this.extractBalance(/held/i); }
  async getAvailableBalance(): Promise<number> { return this.extractBalance(/available/i); }

  // ── Equation check ────────────────────────────────────────────────────────

  async assertEquation(toleranceCents = 0.01) {
    const [total, held, available] = await Promise.all([
      this.getTotalBalance(),
      this.getHeldBalance(),
      this.getAvailableBalance(),
    ]);
    expect(Math.abs((total - held) - available)).toBeLessThanOrEqual(toleranceCents);
  }

  // ── Three-pill UI detection ───────────────────────────────────────────────

  async hasThreeWayBalanceUI(): Promise<boolean> {
    const text = await this.page.evaluate(() => document.body.innerText);
    return /total/i.test(text) && /held/i.test(text) && /available/i.test(text);
  }

  // ── Transaction helpers ───────────────────────────────────────────────────

  async hasTransactionOfType(typeLabel: string | RegExp): Promise<boolean> {
    const text = await this.page.evaluate(() => document.body.innerText);
    return typeof typeLabel === 'string'
      ? text.toLowerCase().includes(typeLabel.toLowerCase())
      : typeLabel.test(text);
  }

  async getTransactionTexts(): Promise<string[]> {
    const rows = this.page.locator(
      '.transaction-row, [data-testid="transaction-row"], .tx-card, [data-testid^="tx-"]',
    );
    const count = await rows.count();
    if (count === 0) {
      // Fallback: grab all list items that look like transactions
      return this.page.evaluate(() =>
        Array.from(document.querySelectorAll('li, .card')).map(el => el.textContent ?? ''),
      );
    }
    return rows.allTextContents();
  }

  // ── Label assertions ──────────────────────────────────────────────────────

  async expectHoldLabelVisible() {
    await expect(this.page.getByText(/entry hold|hold placed|reserved/i).first()).toBeVisible({ timeout: 8_000 });
  }

  async expectReleaseLabelVisible() {
    await expect(this.page.getByText(/hold released|entry released|not deducted/i).first()).toBeVisible({ timeout: 8_000 });
  }

  async expectLockLabelVisible() {
    await expect(this.page.getByText(/entry locked|entry fee|deducted/i).first()).toBeVisible({ timeout: 8_000 });
  }

  async expectSettlementLabelVisible() {
    await expect(this.page.getByText(/settlement|prize|winning/i).first()).toBeVisible({ timeout: 8_000 });
  }

  async expectAbandonedResolutionVisible() {
    await expect(this.page.getByText(/abandoned|resolution|refund/i).first()).toBeVisible({ timeout: 8_000 });
  }

  // ── Status badge assertions ───────────────────────────────────────────────

  async expectCompletedBadgePresent() {
    const badge = this.page.getByText(/completed/i).first();
    await expect(badge).toBeVisible({ timeout: 5_000 });
  }
}
