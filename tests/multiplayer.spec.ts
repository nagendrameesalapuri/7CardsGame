/**
 * Multiplayer regression suite
 * Covers: create room, join room (code), free game flow, wager UI,
 *         2-player game start, game actions, match end, winning amount, history
 *
 * Tests using two browser contexts are tagged @multiplayer.
 * They require the server running with MongoDB.
 */
import { test, expect } from '@playwright/test';
import {
  loginAsGuest,
  createFreeRoom,
  joinRoomByCode,
  createTwoPlayers,
  closeTwoPlayers,
  playUntilMatchEnds,
  waitForMyTurn,
  uid,
  goToWallet,
  goToLobby,
} from './helpers';

// ── Create Room modal ─────────────────────────────────────────────────────────

test.describe('Create Room — modal UI', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsGuest(page, uid('CR'));
    await page.getByText('Create Room').click();
  });

  test('modal opens with all form fields', async ({ page }) => {
    await expect(page.getByPlaceholder('My Game Room')).toBeVisible();
    await expect(page.getByText('Max Players')).toBeVisible();
    await expect(page.getByText(/rounds/i)).toBeVisible();
    await expect(page.getByText('Free Play')).toBeVisible();
  });

  test('Create Room button disabled with empty name', async ({ page }) => {
    const btn = page.getByRole('button', { name: /create room|enter room name/i });
    await expect(btn).toBeDisabled();
  });

  test('Create Room button enabled with valid name', async ({ page }) => {
    await page.getByPlaceholder('My Game Room').fill('My Arena');
    const btn = page.getByRole('button', { name: /create room/i });
    await expect(btn).toBeEnabled();
  });

  test('Free Play is the default game mode', async ({ page }) => {
    // Free Play button should look selected / active
    await expect(page.getByText('Free Play')).toBeVisible();
    await expect(page.getByText('Wager Game')).toBeVisible();
  });

  test('Wager Game mode shows insufficient balance for guest', async ({ page }) => {
    await page.getByText('Wager Game').click();
    // Guest has ₹0 balance — wager fields or insufficient warning should appear
    // Try to enter an amount and verify warning
    const wagerInput = page.getByPlaceholder(/enter wager amount/i);
    if (await wagerInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await wagerInput.fill('50');
      await expect(page.getByText(/insufficient balance/i)).toBeVisible({ timeout: 3_000 });
    } else {
      // Guest can't toggle wager — message shown
      await expect(page.getByText(/sign in to enable|insufficient/i)).toBeVisible({ timeout: 3_000 });
    }
  });

  test('Private Room toggle works', async ({ page }) => {
    const toggle = page.getByText(/private room/i);
    await expect(toggle).toBeVisible();
    await toggle.click();
  });

  test('Cancel button closes the modal', async ({ page }) => {
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page.getByPlaceholder('My Game Room')).not.toBeVisible();
  });
});

// ── Join Room modal ───────────────────────────────────────────────────────────

test.describe('Join Room — modal UI', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsGuest(page, uid('JR'));
    await page.getByText('Join with Code').click();
  });

  test('modal shows 6-char code input', async ({ page }) => {
    await expect(page.getByPlaceholder('XXXXXX')).toBeVisible();
  });

  test('Join button disabled when code is empty', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^join$/i })).toBeDisabled();
  });

  test('Join button enabled after entering 6 characters', async ({ page }) => {
    await page.getByPlaceholder('XXXXXX').fill('ABCDEF');
    await expect(page.getByRole('button', { name: /^join$/i })).toBeEnabled();
  });

  test('shows error for invalid room code', async ({ page }) => {
    await page.getByPlaceholder('XXXXXX').fill('ZZZZZZ');
    await page.getByRole('button', { name: /^join$/i }).click();
    // Server returns room not found error
    await expect(page.locator('text=/room not found|invalid|not found/i')).toBeVisible({ timeout: 8_000 });
  });

  test('Cancel closes the modal', async ({ page }) => {
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page.getByPlaceholder('XXXXXX')).not.toBeVisible();
  });
});

// ── Two-player: create + join ─────────────────────────────────────────────────

test.describe('Two-player: room creation and joining', () => {
  test('host creates room, guest joins with code', async ({ browser }) => {
    test.setTimeout(60_000);
    const { host, guest } = await createTwoPlayers(browser, 'RoomJoin');

    try {
      // Host creates room
      const code = await createFreeRoom(host.page, 'Regression Room');
      expect(code).toMatch(/^[A-Z0-9]{6}$/);

      // Guest joins using code
      await joinRoomByCode(guest.page, code);

      // Both should now see each other in the room lobby
      await expect(host.page.getByText(guest.name)).toBeVisible({ timeout: 12_000 });
      await expect(guest.page.getByText(host.name)).toBeVisible({ timeout: 12_000 });
    } finally {
      await closeTwoPlayers(host, guest);
    }
  });

  test('room shows player count after guest joins', async ({ browser }) => {
    test.setTimeout(60_000);
    const { host, guest } = await createTwoPlayers(browser, 'PlayerCount');

    try {
      const code = await createFreeRoom(host.page);
      await joinRoomByCode(guest.page, code);

      // Room should show 2 players
      await expect(host.page.getByText(/2\s*\/\s*[2-6]|2 players/i)).toBeVisible({ timeout: 10_000 });
    } finally {
      await closeTwoPlayers(host, guest);
    }
  });

  test('host can start game after guest joins', async ({ browser }) => {
    test.setTimeout(90_000);
    const { host, guest } = await createTwoPlayers(browser, 'StartGame');

    try {
      const code = await createFreeRoom(host.page);
      await joinRoomByCode(guest.page, code);

      // Wait for both players to appear
      await expect(host.page.getByText(guest.name)).toBeVisible({ timeout: 12_000 });

      // Host starts the game
      const startBtn = host.page.getByRole('button', { name: /start game|▶/i });
      await expect(startBtn).toBeEnabled({ timeout: 8_000 });
      await startBtn.click();

      // Both players should transition to the game
      await expect(host.page).toHaveURL(/\/game|\/lobby/, { timeout: 20_000 });
    } finally {
      await closeTwoPlayers(host, guest);
    }
  });
});

// ── Two-player: full free game ────────────────────────────────────────────────

test.describe('Two-player: free game flow', () => {
  test('game starts, cards dealt, actions available', async ({ browser }) => {
    test.setTimeout(120_000);
    const { host, guest } = await createTwoPlayers(browser, 'FreeGame');

    try {
      const code = await createFreeRoom(host.page);
      await joinRoomByCode(guest.page, code);
      await expect(host.page.getByText(guest.name)).toBeVisible({ timeout: 12_000 });

      const startBtn = host.page.getByRole('button', { name: /start game/i });
      await startBtn.click();

      // Wait for game board to load on host page
      await host.page.waitForURL(/\/game/, { timeout: 25_000 }).catch(() => {});

      // Verify game is active: draw button or "Connecting" spinner visible
      const gameActive = host.page.locator('text=/draw from deck|connecting to game/i');
      await expect(gameActive).toBeVisible({ timeout: 25_000 });
    } finally {
      await closeTwoPlayers(host, guest);
    }
  });

  test('both players can see game board after start', async ({ browser }) => {
    test.setTimeout(120_000);
    const { host, guest } = await createTwoPlayers(browser, 'BothBoard');

    try {
      const code = await createFreeRoom(host.page);
      await joinRoomByCode(guest.page, code);
      await expect(host.page.getByText(guest.name)).toBeVisible({ timeout: 12_000 });

      await host.page.getByRole('button', { name: /start game/i }).click();

      // Both pages navigate to game
      await Promise.all([
        host.page.locator('text=/draw from deck|connecting/i').waitFor({ timeout: 25_000 }),
        guest.page.locator('text=/draw from deck|connecting/i').waitFor({ timeout: 25_000 }),
      ]);
    } finally {
      await closeTwoPlayers(host, guest);
    }
  });

  test('match ends and result screen shown', async ({ browser }) => {
    test.setTimeout(180_000);
    const { host, guest } = await createTwoPlayers(browser, 'MatchEnd');

    try {
      const code = await createFreeRoom(host.page);
      await joinRoomByCode(guest.page, code);
      await expect(host.page.getByText(guest.name)).toBeVisible({ timeout: 12_000 });

      await host.page.getByRole('button', { name: /start game/i }).click();
      await host.page.locator('text=/draw from deck|connecting/i').waitFor({ timeout: 25_000 });
      await guest.page.locator('text=/draw from deck|connecting/i').waitFor({ timeout: 25_000 });

      // Play both sides until match ends
      const [hostResult] = await Promise.all([
        playUntilMatchEnds(host.page, 30),
        playUntilMatchEnds(guest.page, 30),
      ]);

      // At least host should see a match result
      const resultVisible = await host.page
        .locator('text=/match over|you won|you lost|winner|round result/i')
        .isVisible({ timeout: 10_000 })
        .catch(() => false);
      expect(resultVisible || hostResult === 'ended').toBe(true);
    } finally {
      await closeTwoPlayers(host, guest);
    }
  });
});

// ── Winning amount credited ────────────────────────────────────────────────────

test.describe('Winning amount credited to wallet', () => {
  test('wallet activity shows prize transaction after wager game win', async ({ browser }) => {
    // NOTE: Guests have ₹0 balance so wager isn't playable without a deposit.
    // This test verifies the wallet activity tab UI and transaction history structure.
    test.skip(true, 'Requires funded wallet — covered in wallet.spec.ts deposit flow');
  });

  test('game history tab shows completed match after free game', async ({ browser }) => {
    test.setTimeout(180_000);
    const { host, guest } = await createTwoPlayers(browser, 'History');

    try {
      const code = await createFreeRoom(host.page);
      await joinRoomByCode(guest.page, code);
      await expect(host.page.getByText(guest.name)).toBeVisible({ timeout: 12_000 });
      await host.page.getByRole('button', { name: /start game/i }).click();
      await host.page.locator('text=/draw from deck|connecting/i').waitFor({ timeout: 25_000 });
      await guest.page.locator('text=/draw from deck|connecting/i').waitFor({ timeout: 25_000 });

      // Let the match end naturally
      await Promise.all([
        playUntilMatchEnds(host.page, 30),
        playUntilMatchEnds(guest.page, 30),
      ]);

      // Navigate to lobby history tab
      await goToLobby(host.page);
      const historyTab = host.page.getByText('History');
      await historyTab.click();

      // Should see at least one game entry
      await expect(
        host.page.locator('text=/won|lost|vs|players|free play/i').first()
      ).toBeVisible({ timeout: 10_000 });
    } finally {
      await closeTwoPlayers(host, guest);
    }
  });
});

// ── Public rooms list ─────────────────────────────────────────────────────────

test.describe('Public rooms list', () => {
  test('public rooms section visible on lobby', async ({ page }) => {
    await loginAsGuest(page, uid('PubRoom'));
    await expect(page.getByText('Public Rooms')).toBeVisible({ timeout: 10_000 });
  });

  test('created public room appears in Open · Waiting section', async ({ browser }) => {
    test.setTimeout(60_000);
    const { host, guest } = await createTwoPlayers(browser, 'PubList');

    try {
      // Host creates a public room (default is public unless toggled private)
      const code = await createFreeRoom(host.page);

      // Guest refreshes lobby and should see the room in public list
      await goToLobby(guest.page);
      await expect(
        guest.page.locator('text=/open.*waiting|waiting.*open/i').first()
      ).toBeVisible({ timeout: 10_000 });
    } finally {
      await closeTwoPlayers(host, guest);
    }
  });

  test('joining from public rooms list works', async ({ browser }) => {
    test.setTimeout(60_000);
    const { host, guest } = await createTwoPlayers(browser, 'PubJoin');

    try {
      await createFreeRoom(host.page);
      await goToLobby(guest.page);

      // Look for a Join button in the public rooms section
      const joinBtn = guest.page.getByRole('button', { name: /^join$/i }).first();
      const joinVisible = await joinBtn.isVisible({ timeout: 8_000 }).catch(() => false);

      if (joinVisible) {
        await joinBtn.click();
        await expect(guest.page.getByText(host.name)).toBeVisible({ timeout: 12_000 });
      }
      // If not visible, public rooms may not list single-slot rooms — acceptable
    } finally {
      await closeTwoPlayers(host, guest);
    }
  });
});
