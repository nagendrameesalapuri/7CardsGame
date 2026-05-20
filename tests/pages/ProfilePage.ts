import { Page, Locator, expect } from '@playwright/test';

export class ProfilePage {
  readonly page: Page;

  readonly usernameHeading: Locator;
  readonly statsSection: Locator;
  readonly gamesPlayedStat: Locator;
  readonly winsLossesStat: Locator;
  readonly walletBalanceStat: Locator;
  readonly backBtn: Locator;
  readonly avatarImg: Locator;

  constructor(page: Page) {
    this.page = page;
    this.usernameHeading  = page.getByRole('heading').first();
    this.statsSection     = page.locator('text=/stats|wins|games/i').first();
    this.gamesPlayedStat  = page.locator('text=/games played|played/i').first();
    this.winsLossesStat   = page.locator('text=/wins|losses/i').first();
    this.walletBalanceStat = page.locator('text=/wallet|balance|₹/i').first();
    this.backBtn          = page.getByRole('button', { name: /back|lobby/i }).first();
    this.avatarImg        = page.locator('img[alt*="avatar"], .avatar-img').first();
  }

  async goto() {
    await this.page.goto('/profile');
    await this.page.waitForLoadState('networkidle');
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL(/\/profile/);
    await expect(this.usernameHeading).toBeVisible();
  }

  async getUsername(): Promise<string> {
    return (await this.usernameHeading.textContent()) ?? '';
  }

  async getGamesPlayed(): Promise<number> {
    const text = await this.gamesPlayedStat.textContent().catch(() => '0');
    const match = text?.match(/\d+/);
    return match ? parseInt(match[0]) : 0;
  }
}
