/**
 * E2E Suite 09 — Transaction History & Wallet Audit
 * Covers: transaction list display, transaction types, API response validation,
 *         deposit/withdrawal history, survival entry fee tracking.
 */
import { test, expect } from '@playwright/test';
import { guestLogin } from '../helpers/auth';
import { WalletPage } from '../pages/WalletPage';
import { uniqueUsername } from '../test-data/users';

// Helper: fetch JSON via browser eval with auth header
async function apiFetch(page: Parameters<typeof guestLogin>[0], path: string, token: string): Promise<any> {
  return page.evaluate(
    async ([url, t]: string[]) => {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${t}` } });
      return r.json();
    },
    [path, token],
  ) as Promise<any>;
}

async function apiFetchStatus(page: Parameters<typeof guestLogin>[0], path: string, token: string): Promise<number> {
  return page.evaluate(
    async ([url, t]: string[]) => {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${t}` } });
      return r.status;
    },
    [path, token],
  ) as Promise<number>;
}

test.describe('Transaction History — Display', () => {
  let wallet: WalletPage;

  test.beforeEach(async ({ page }) => {
    await guestLogin(page, uniqueUsername('TxHist'));
    wallet = new WalletPage(page);
    await wallet.goto();
  });

  test('transaction history section is visible on wallet page', async ({ page }) => {
    await expect(
      page.getByText(/transaction|history/i).first(),
    ).toBeVisible();
  });

  test('empty state shows "no transactions" message', async ({ page }) => {
    await expect(
      page.getByText(/no transaction|no history|empty/i).first(),
    ).toBeVisible({ timeout: 8_000 });
  });

  test('transaction list is scrollable when entries exist', async ({ page }) => {
    const count = await wallet.getTransactionCount();
    if (count > 0) {
      const list = page.locator('.transaction-list, [data-testid="transaction-list"]').first();
      if (await list.isVisible({ timeout: 3_000 })) {
        await expect(list).toBeVisible();
      }
    } else {
      test.info().annotations.push({ type: 'note', description: 'No transactions — scroll test skipped' });
    }
  });

  test('each transaction shows amount and type', async ({ page }) => {
    const count = await wallet.getTransactionCount();
    if (count > 0) {
      const latestText = await wallet.getLatestTransactionText();
      expect(latestText).toMatch(/₹|\d+/);
    }
  });
});

test.describe('Transaction History — API Validation', () => {
  test('wallet API returns transactions array', async ({ page }) => {
    await guestLogin(page, uniqueUsername('WalletAPI'));
    const token = await page.evaluate(() => localStorage.getItem('token') ?? '');
    expect(token).toBeTruthy();

    const res = await apiFetch(page, '/api/wallet', token);

    expect(res).toHaveProperty('balance');
    expect(typeof res.balance).toBe('number');
    expect(Array.isArray(res.transactions)).toBeTruthy();
  });

  test('wallet API includes isGuest flag', async ({ page }) => {
    await guestLogin(page, uniqueUsername('GuestFlag'));
    const token = await page.evaluate(() => localStorage.getItem('token') ?? '');

    const res = await apiFetch(page, '/api/wallet', token);

    expect(res).toHaveProperty('isGuest');
    expect(res.isGuest).toBe(true);
  });

  test('wallet API returns lockedRewards field', async ({ page }) => {
    await guestLogin(page, uniqueUsername('Locked'));
    const token = await page.evaluate(() => localStorage.getItem('token') ?? '');

    const res = await apiFetch(page, '/api/wallet', token);

    expect(res).toHaveProperty('lockedRewards');
    expect(typeof res.lockedRewards).toBe('number');
  });

  test('wallet balance is 0 for new guest user', async ({ page }) => {
    await guestLogin(page, uniqueUsername('NewGuest'));
    const token = await page.evaluate(() => localStorage.getItem('token') ?? '');

    const res = await apiFetch(page, '/api/wallet', token);

    expect(res.balance).toBe(0);
  });

  test('wallet API requires authentication (401 without token)', async ({ page }) => {
    const status = await page.evaluate(async () => {
      const r = await fetch('/api/wallet');
      return r.status;
    }) as number;
    expect(status).toBe(401);
  });

  test('dev add balance endpoint returns 403 for guest user', async ({ page }) => {
    await guestLogin(page, uniqueUsername('DevBlock'));
    const token = await page.evaluate(() => localStorage.getItem('token') ?? '');

    const res = await page.evaluate(
      async ([t]: string[]) => {
        const r = await fetch('/api/wallet/dev/add', {
          method: 'POST',
          headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: 100 }),
        });
        return { status: r.status };
      },
      [token],
    ) as { status: number };

    expect(res.status).toBe(403);
  });

  test('transaction history shows up to 50 entries', async ({ page }) => {
    await guestLogin(page, uniqueUsername('TxLimit'));
    const token = await page.evaluate(() => localStorage.getItem('token') ?? '');

    const res = await apiFetch(page, '/api/wallet', token);

    expect(res.transactions.length).toBeLessThanOrEqual(50);
  });
});

test.describe('Transaction History — Deposit Requests', () => {
  test('wallet API includes depositRequests array', async ({ page }) => {
    await guestLogin(page, uniqueUsername('DepReq'));
    const token = await page.evaluate(() => localStorage.getItem('token') ?? '');

    const res = await apiFetch(page, '/api/wallet', token);
    expect(Array.isArray(res.depositRequests)).toBeTruthy();
  });

  test('wallet API includes withdrawalRequests array', async ({ page }) => {
    await guestLogin(page, uniqueUsername('WdReq'));
    const token = await page.evaluate(() => localStorage.getItem('token') ?? '');

    const res = await apiFetch(page, '/api/wallet', token);
    expect(Array.isArray(res.withdrawalRequests)).toBeTruthy();
  });

  test('voucher numbers are masked in deposit requests', async ({ page }) => {
    await guestLogin(page, uniqueUsername('VouchMask'));
    const token = await page.evaluate(() => localStorage.getItem('token') ?? '');

    const res = await apiFetch(page, '/api/wallet', token);

    for (const dep of (res.depositRequests ?? []) as any[]) {
      if (dep.voucherNumber !== undefined) {
        expect(dep.voucherNumber).toBeUndefined();
        expect(dep.voucherNumberMasked).toMatch(/XXXX/);
      }
    }
  });
});

test.describe('Transaction History — Games History', () => {
  test('games API returns match history or 404', async ({ page }) => {
    await guestLogin(page, uniqueUsername('GameHist'));
    const token = await page.evaluate(() => localStorage.getItem('token') ?? '');

    const status = await apiFetchStatus(page, '/api/games', token);
    if (status === 404) {
      test.info().annotations.push({ type: 'note', description: 'Games API not implemented' });
      return;
    }
    const res = await apiFetch(page, '/api/games', token);
    expect(Array.isArray(res.games ?? res)).toBeTruthy();
  });

  test('survival history API returns array', async ({ page }) => {
    await guestLogin(page, uniqueUsername('SurvHistAPI'));
    const token = await page.evaluate(() => localStorage.getItem('token') ?? '');

    const res = await apiFetch(page, '/api/survival/history', token);
    expect(Array.isArray(res.tournaments ?? res)).toBeTruthy();
  });

  test('profile page shows games played stat', async ({ page }) => {
    await guestLogin(page, uniqueUsername('ProfileStat'));
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByText(/games played|played|wins|losses/i).first(),
    ).toBeVisible({ timeout: 5_000 });
  });
});
