import { Page, Locator, expect } from '@playwright/test';

export class HomePage {
  readonly page: Page;

  // Locators
  readonly googleBtn: Locator;
  readonly guestBtn: Locator;
  readonly usernameInput: Locator;
  readonly startPlayingBtn: Locator;
  readonly backBtn: Locator;

  constructor(page: Page) {
    this.page = page;
    this.googleBtn      = page.getByRole('button', { name: /continue with google/i });
    this.guestBtn       = page.getByRole('button', { name: /play as guest/i });
    this.usernameInput  = page.getByPlaceholder(/your display name/i);
    this.startPlayingBtn = page.getByRole('button', { name: /enter the arena/i });
    this.backBtn        = page.getByText(/← back|back/i).first();
  }

  async goto() {
    await this.page.goto('/');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async guestLogin(username: string) {
    await this.guestBtn.click();
    await this.usernameInput.fill(username);
    await this.startPlayingBtn.click();
    await this.page.waitForURL('**/lobby', { timeout: 20_000 });
  }

  async expectLoaded() {
    await expect(this.guestBtn).toBeVisible();
  }

  async expectGuestFormVisible() {
    await expect(this.usernameInput).toBeVisible();
    await expect(this.startPlayingBtn).toBeVisible();
  }
}
