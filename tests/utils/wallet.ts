/**
 * Wallet automation helpers.
 * Uses direct API calls (not UI) for speed and reliability in test setup.
 */
import { Page } from '@playwright/test';
import { ApiClient, createApiContext } from './api';
import { ENV } from '../config/env';

/**
 * Top up a user's wallet via the dev endpoint using their JWT from localStorage.
 * The page must be authenticated before calling this.
 */
export async function devTopUp(page: Page, amount = 500): Promise<number> {
  const token = await page.evaluate(() => localStorage.getItem('token'));
  if (!token) throw new Error('No auth token in localStorage — user must be logged in first');

  const ctx = await createApiContext();
  try {
    const client = new ApiClient(ctx, token);
    const result = await client.devAddBalance(amount);
    return result.balance;
  } finally {
    await ctx.dispose();
  }
}

/**
 * Get current wallet balance via direct API call.
 */
export async function getWalletBalance(page: Page): Promise<number> {
  const token = await page.evaluate(() => localStorage.getItem('token'));
  if (!token) throw new Error('No auth token in localStorage');

  const ctx = await createApiContext();
  try {
    const client = new ApiClient(ctx, token);
    const wallet = await client.getWallet();
    return wallet.balance;
  } finally {
    await ctx.dispose();
  }
}

/**
 * Get wallet state including transaction history.
 */
export async function getWalletState(page: Page) {
  const token = await page.evaluate(() => localStorage.getItem('token'));
  if (!token) throw new Error('No auth token in localStorage');

  const ctx = await createApiContext();
  try {
    const client = new ApiClient(ctx, token);
    return client.getWallet();
  } finally {
    await ctx.dispose();
  }
}

/**
 * Ensure user has at least `minBalance` in their wallet.
 * Adds the difference if current balance is below minimum.
 */
export async function ensureBalance(page: Page, minBalance: number): Promise<number> {
  const current = await getWalletBalance(page);
  if (current < minBalance) {
    const needed = Math.ceil(minBalance - current);
    const capped = Math.min(needed + 100, 10000); // add buffer, cap at dev limit
    return devTopUp(page, capped);
  }
  return current;
}

/**
 * Refresh wallet display on the Wallet page by reloading.
 */
export async function refreshWalletPage(page: Page) {
  await page.goto(`${ENV.BASE_URL}/wallet`);
  await page.waitForLoadState('networkidle');
}
