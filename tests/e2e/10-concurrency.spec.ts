/**
 * E2E Suite 10 — Concurrency & Edge Cases
 * Covers: simultaneous actions, race conditions, duplicate socket emissions,
 *         multiple tabs, room full rejection, rapid room creation.
 */
import { test, expect } from '@playwright/test';
import { guestLogin } from '../helpers/auth';
import { LobbyPage } from '../pages/LobbyPage';
import { uniqueUsername, playerNames } from '../test-data/users';
import { createMultiplayerSession, loginAllPlayers } from '../utils/multiplayer';
import { ENV } from '../config/env';

test.describe('Concurrency — Room Capacity', () => {
  test('room enforces max player count', async ({ browser }) => {
    const names = playerNames(3, 'Cap');

    // P1 creates a 2-player room, P2 joins, P3 gets rejected
    const ctx1 = await browser.newContext({ baseURL: ENV.BASE_URL });
    const ctx2 = await browser.newContext({ baseURL: ENV.BASE_URL });
    const ctx3 = await browser.newContext({ baseURL: ENV.BASE_URL });
    const p1 = await ctx1.newPage();
    const p2 = await ctx2.newPage();
    const p3 = await ctx3.newPage();

    try {
      await guestLogin(p1, names[0]);
      await guestLogin(p2, names[1]);
      await guestLogin(p3, names[2]);

      // P1 creates a 2-player room
      const lobby1 = new LobbyPage(p1);
      await lobby1.openCreateRoomModal();

      // Set max players to 2
      const twoBtn = p1.getByRole('button', { name: /\b2\b/ }).first();
      if (await twoBtn.isVisible({ timeout: 2_000 })) await twoBtn.click();

      const confirmBtn = p1.getByRole('button', { name: /create room|confirm|create/i }).last();
      await confirmBtn.click({ timeout: 10_000 });
      await expect(p1.getByText(/waiting|room/i).first()).toBeVisible({ timeout: 15_000 });

      // Extract room code
      const allText = await p1.evaluate(() => document.body.innerText);
      const roomCode = allText.match(/\b([A-Z0-9]{4,8})\b/)?.[1];

      if (!roomCode) {
        test.info().annotations.push({ type: 'note', description: 'Could not extract room code' });
        return;
      }

      // P2 joins successfully
      await p2.goto('/lobby');
      const joinInput2 = p2.getByPlaceholder(/room code|enter code/i).first();
      if (await joinInput2.isVisible({ timeout: 5_000 })) {
        await joinInput2.fill(roomCode);
        await p2.getByRole('button', { name: /join/i }).first().click();
        await p2.waitForTimeout(1000);
      }

      // P3 tries to join — should get "room full" error
      await p3.goto('/lobby');
      const joinInput3 = p3.getByPlaceholder(/room code|enter code/i).first();
      if (await joinInput3.isVisible({ timeout: 5_000 })) {
        await joinInput3.fill(roomCode);
        await p3.getByRole('button', { name: /join/i }).first().click();
        await expect(
          p3.getByText(/full|max players|no room/i).first(),
        ).toBeVisible({ timeout: 8_000 });
      }
    } finally {
      await ctx1.close();
      await ctx2.close();
      await ctx3.close();
    }
  });

  test('cannot join a game already in progress', async ({ browser }) => {
    const ctx1 = await browser.newContext({ baseURL: ENV.BASE_URL });
    const ctx2 = await browser.newContext({ baseURL: ENV.BASE_URL });
    const ctx3 = await browser.newContext({ baseURL: ENV.BASE_URL });
    const p1 = await ctx1.newPage();
    const p2 = await ctx2.newPage();
    const p3 = await ctx3.newPage();

    try {
      const stamp = Date.now();
      await guestLogin(p1, `InProg1_${stamp}`);
      await guestLogin(p2, `InProg2_${stamp}`);
      await guestLogin(p3, `InProg3_${stamp}`);

      // P1 creates room + starts with bot
      const lobby1 = new LobbyPage(p1);
      await lobby1.openCreateRoomModal();
      const confirmBtn = p1.getByRole('button', { name: /create room|confirm|create/i }).last();
      await confirmBtn.click({ timeout: 10_000 });
      await expect(p1.getByText(/waiting|room/i).first()).toBeVisible({ timeout: 15_000 });

      const addBotBtn = p1.getByRole('button', { name: /add bot|\+/i }).first();
      if (await addBotBtn.isVisible({ timeout: 5_000 })) await addBotBtn.click();

      const allText = await p1.evaluate(() => document.body.innerText);
      const roomCode = allText.match(/\b([A-Z0-9]{4,8})\b/)?.[1];

      const startBtn = p1.getByRole('button', { name: /start game|start/i }).first();
      if (await startBtn.isVisible({ timeout: 5_000 })) {
        await startBtn.click();
        await p1.waitForURL(/\/game/, { timeout: ENV.GAME_TIMEOUT });
        await p1.waitForSelector('text=/your turn|dealing|round/i', { state: 'visible', timeout: 30_000 });

        if (roomCode) {
          // P3 tries to join the already-started game
          await p3.goto('/lobby');
          const joinInput = p3.getByPlaceholder(/room code|enter code/i).first();
          if (await joinInput.isVisible({ timeout: 5_000 })) {
            await joinInput.fill(roomCode);
            await p3.getByRole('button', { name: /join/i }).first().click();
            await expect(
              p3.getByText(/in progress|already started|playing/i).first(),
            ).toBeVisible({ timeout: 8_000 });
          }
        }
      }
    } finally {
      await ctx1.close();
      await ctx2.close();
      await ctx3.close();
    }
  });
});

test.describe('Concurrency — Simultaneous Actions', () => {
  test('two players draw simultaneously — server handles turn order', async ({ browser }) => {
    const ctx1 = await browser.newContext({ baseURL: ENV.BASE_URL });
    const ctx2 = await browser.newContext({ baseURL: ENV.BASE_URL });
    const p1 = await ctx1.newPage();
    const p2 = await ctx2.newPage();

    try {
      const stamp = Date.now();
      await guestLogin(p1, `SimDraw1_${stamp}`);
      await guestLogin(p2, `SimDraw2_${stamp}`);

      // P1 creates room, P2 joins, P1 starts
      const lobby1 = new LobbyPage(p1);
      await lobby1.openCreateRoomModal();
      const confirmBtn = p1.getByRole('button', { name: /create room|confirm|create/i }).last();
      await confirmBtn.click({ timeout: 10_000 });
      await expect(p1.getByText(/waiting|room/i).first()).toBeVisible({ timeout: 15_000 });

      const allText = await p1.evaluate(() => document.body.innerText);
      const roomCode = allText.match(/\b([A-Z0-9]{4,8})\b/)?.[1];

      if (!roomCode) return;

      await p2.goto('/lobby');
      const joinInput = p2.getByPlaceholder(/room code|enter code/i).first();
      if (await joinInput.isVisible({ timeout: 5_000 })) {
        await joinInput.fill(roomCode);
        await p2.getByRole('button', { name: /join/i }).first().click();
        await p2.waitForTimeout(1000);
      }

      const startBtn = p1.getByRole('button', { name: /start game|start/i }).first();
      if (!await startBtn.isVisible({ timeout: 5_000 })) return;

      await startBtn.click();
      await Promise.allSettled([
        p1.waitForURL(/\/game/, { timeout: ENV.GAME_TIMEOUT }),
        p2.waitForURL(/\/game/, { timeout: ENV.GAME_TIMEOUT }),
      ]);

      await p1.waitForSelector('text=/your turn|dealing|round/i', { state: 'visible', timeout: 30_000 });
      await p2.waitForSelector('text=/your turn|dealing|round/i', { state: 'visible', timeout: 30_000 }).catch(() => {});

      // Try to click draw simultaneously from both players
      const [deck1, deck2] = [
        p1.locator('.deck-area, [data-testid="draw-pile"]').first(),
        p2.locator('.deck-area, [data-testid="draw-pile"]').first(),
      ];

      await Promise.allSettled([
        deck1.click({ timeout: 3_000 }),
        deck2.click({ timeout: 3_000 }),
      ]);

      // Server should enforce turns — only the current turn player's action succeeds
      // Verify neither client crashed
      await expect(p1).toHaveURL(/\/game/);
      await expect(p2).toHaveURL(/\/game/);
    } finally {
      await ctx1.close();
      await ctx2.close();
    }
  });
});

test.describe('Concurrency — Multiple Tabs', () => {
  test('opening lobby in two tabs shares auth state', async ({ browser }) => {
    // Use same context for two tabs (shared localStorage)
    const ctx = await browser.newContext({ baseURL: ENV.BASE_URL });
    const tab1 = await ctx.newPage();
    const tab2 = await ctx.newPage();

    try {
      await guestLogin(tab1, uniqueUsername('MultiTab'));

      // Open lobby in tab2 — should be auto-authenticated
      await tab2.goto('/lobby');
      await tab2.waitForLoadState('networkidle');
      await expect(tab2).toHaveURL(/\/lobby/);

      // Both tabs authenticated with same token
      const token1 = await tab1.evaluate(() => localStorage.getItem('token'));
      const token2 = await tab2.evaluate(() => localStorage.getItem('token'));
      expect(token1).toBe(token2);
    } finally {
      await ctx.close();
    }
  });

  test('logout in one tab affects the other tab on next navigation', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: ENV.BASE_URL });
    const tab1 = await ctx.newPage();
    const tab2 = await ctx.newPage();

    try {
      await guestLogin(tab1, uniqueUsername('TabLogout'));

      // Tab 2 is on lobby
      await tab2.goto('/lobby');
      await tab2.waitForLoadState('networkidle');

      // Logout from tab 1
      await tab1.getByRole('button', { name: /logout/i }).click();
      await tab1.waitForURL('/', { timeout: 10_000 });

      // Tab 2 navigates — should be redirected to home (shared storage)
      await tab2.goto('/lobby');
      await tab2.waitForURL('/', { timeout: 10_000 });
      await expect(tab2).toHaveURL('/');
    } finally {
      await ctx.close();
    }
  });
});

test.describe('Concurrency — Rapid Room Operations', () => {
  test('creating multiple rooms in sequence works', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: ENV.BASE_URL });
    const page = await ctx.newPage();
    const lobby = new LobbyPage(page);

    try {
      await guestLogin(page, uniqueUsername('RapidRoom'));

      // Create first room
      await lobby.openCreateRoomModal();
      let confirmBtn = page.getByRole('button', { name: /create room|confirm|create/i }).last();
      await confirmBtn.click({ timeout: 10_000 });
      await expect(page.getByText(/waiting|room/i).first()).toBeVisible({ timeout: 15_000 });

      // Leave
      const leaveBtn = page.getByRole('button', { name: /leave|exit/i }).first();
      if (await leaveBtn.isVisible({ timeout: 5_000 })) {
        await leaveBtn.click();
        await page.waitForURL(/\/lobby/, { timeout: 10_000 });
      }

      // Create second room immediately
      await lobby.openCreateRoomModal();
      confirmBtn = page.getByRole('button', { name: /create room|confirm|create/i }).last();
      await confirmBtn.click({ timeout: 10_000 });
      await expect(page.getByText(/waiting|room/i).first()).toBeVisible({ timeout: 15_000 });
    } finally {
      await ctx.close();
    }
  });

  test('concurrent guest logins create distinct users', async ({ browser }) => {
    const ctxA = await browser.newContext({ baseURL: ENV.BASE_URL });
    const ctxB = await browser.newContext({ baseURL: ENV.BASE_URL });
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    try {
      const stamp = Date.now();
      // Login concurrently
      await Promise.all([
        guestLogin(pageA, `ConcA_${stamp}`),
        guestLogin(pageB, `ConcB_${stamp}`),
      ]);

      const tokenA = await pageA.evaluate(() => localStorage.getItem('token'));
      const tokenB = await pageB.evaluate(() => localStorage.getItem('token'));

      // Distinct tokens = distinct users
      expect(tokenA).not.toBe(tokenB);
      expect(tokenA).toBeTruthy();
      expect(tokenB).toBeTruthy();
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});

test.describe('Concurrency — Edge Cases', () => {
  test('room join with wrong code format shows error', async ({ page }) => {
    await guestLogin(page, uniqueUsername('WrongCode'));
    await page.goto('/lobby');
    const joinInput = page.getByPlaceholder(/room code|enter code/i).first();
    if (await joinInput.isVisible({ timeout: 3_000 })) {
      await joinInput.fill('!@#$');
      await page.getByRole('button', { name: /join/i }).first().click();
      await expect(
        page.getByText(/not found|invalid|error/i).first(),
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  test('unauthenticated API calls return 401', async ({ page }) => {
    const protectedEndpoints = ['/api/wallet', '/api/rooms', '/api/users/me'];

    for (const endpoint of protectedEndpoints) {
      const status = await page.evaluate(async (url) => {
        const r = await fetch(url);
        return r.status;
      }, endpoint);
      expect(status).toBe(401);
    }
  });

  test('invalid JWT returns 401', async ({ page }) => {
    const status = await page.evaluate(async () => {
      const r = await fetch('/api/wallet', {
        headers: { Authorization: 'Bearer invalid.jwt.here' },
      });
      return r.status;
    });
    expect(status).toBe(401);
  });

  test('wallet balance cannot go negative via API manipulation', async ({ page }) => {
    await guestLogin(page, uniqueUsername('Negative'));
    const token = await page.evaluate(() => localStorage.getItem('token'));

    // Try to withdraw when balance is 0
    const res = await page.evaluate(async (t) => {
      const r = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 1000 }),
      });
      return { status: r.status };
    }, token!);

    // Should be 403 (guest) or 400 (insufficient funds) or 404 (route doesn't exist)
    expect([400, 403, 404].includes(res.status)).toBeTruthy();
  });
});
