/**
 * Auth fixtures — provide pre-authenticated pages so individual tests
 * don't need to repeat the login flow.
 */
import { test as base, Page } from '@playwright/test';
import { ENV } from '../config/env';

export interface AuthFixtures {
  /** Page authenticated as a guest user (unique username per test). */
  guestPage: Page;
  /** Page authenticated as a named user. */
  namedGuestPage: (username: string) => Promise<Page>;
}

async function performGuestLogin(page: Page, username: string): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.getByRole('button', { name: /play as guest/i }).click();
  await page.getByPlaceholder(/your display name/i).fill(username);
  await page.getByRole('button', { name: /start playing/i }).click();
  await page.waitForURL('**/lobby', { timeout: 20_000 });
}

export const test = base.extend<AuthFixtures>({
  guestPage: async ({ page }, use) => {
    const username = `Guest_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await performGuestLogin(page, username);
    await use(page);
  },

  namedGuestPage: async ({ page }, use) => {
    const loginFn = async (username: string): Promise<Page> => {
      await performGuestLogin(page, username);
      return page;
    };
    await use(loginFn);
  },
});

export { expect } from '@playwright/test';
