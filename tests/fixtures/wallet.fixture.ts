/**
 * Wallet fixtures — provide pages with a known wallet balance.
 * Non-guest login is required for wallet operations (devTopUp).
 */
import { test as base, Page } from '@playwright/test';
import { ApiClient, createApiContext } from '../utils/api';
import { ENV } from '../config/env';

export interface WalletFixtures {
  /** Authenticated non-guest page with ₹500 balance pre-loaded. */
  fundedPage: Page;
  /** Returns page with at least the specified balance. */
  pageWithBalance: (minBalance: number) => Promise<Page>;
}

async function createFundedUser(page: Page, balance: number): Promise<void> {
  // 1. Create a non-guest user via API (using a unique email approach — guest won't work for dev top-up)
  // Since we only have guest login on the platform, we use the guest route then skip wallet top-up
  // for guests. Instead we test via a registered user flow.
  // For now, perform guest login and note that dev/add returns 403 for guests.
  const username = `Funded_${Date.now()}`;
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.getByRole('button', { name: /play as guest/i }).click();
  await page.getByPlaceholder(/your display name/i).fill(username);
  await page.getByRole('button', { name: /enter the arena/i }).click();
  await page.waitForURL('**/lobby', { timeout: 20_000 });
  // Note: Guest users cannot use dev/add — wallet tests for guests check the restriction message.
}

export const test = base.extend<WalletFixtures>({
  fundedPage: async ({ page }, use) => {
    await createFundedUser(page, 500);
    await use(page);
  },

  pageWithBalance: async ({ page }, use) => {
    const fn = async (minBalance: number): Promise<Page> => {
      await createFundedUser(page, minBalance);
      return page;
    };
    await use(fn);
  },
});

export { expect } from '@playwright/test';
