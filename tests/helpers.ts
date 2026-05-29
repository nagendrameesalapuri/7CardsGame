/**
 * Shared test helpers for the Arena of Sevens E2E regression suite.
 * Every spec file imports from here — keep it stable.
 */
import { Page, Browser, BrowserContext, expect } from '@playwright/test';

// ── Identity ─────────────────────────────────────────────────────────────────

/** Returns a unique name safe to use as a Playwright guest username */
export function uid(prefix = 'P'): string {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 999)}`;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function loginAsGuest(page: Page, username: string): Promise<void> {
  await page.goto('/');
  await page.getByText('Play as Guest').click();
  await page.getByPlaceholder('Your display name').fill(username);
  await page.getByText('Enter the Arena').click();
  await page.waitForURL('**/lobby', { timeout: 15_000 });
  // Wait for lobby to fully render (socket connect + content load) before tests interact
  await page.getByText('Game Lobby').waitFor({ timeout: 12_000 });
  // Dismiss any announcement modal or overlay that may block game interactions
  await dismissOverlays(page);
}

/** Dismiss announcement modal, comeback bonus, and notification dialogs. */
export async function dismissOverlays(page: Page): Promise<void> {
  // Try dismissing overlays up to 3 times (modals may chain)
  for (let round = 0; round < 3; round++) {
    let dismissed = false;

    // Announcement "Got it" button (inside an announcement/modal container)
    const gotIt = page.getByRole('button', { name: /got it/i });
    if (await gotIt.isVisible({ timeout: 600 }).catch(() => false)) {
      await gotIt.click().catch(() => {});
      await page.waitForTimeout(400);
      dismissed = true;
    }

    // Comeback bonus "Start Playing" or "Enter" button
    const startBtn = page.getByRole('button', { name: /start playing/i });
    if (await startBtn.isVisible({ timeout: 400 }).catch(() => false)) {
      await startBtn.click().catch(() => {});
      await page.waitForTimeout(300);
      dismissed = true;
    }

    if (!dismissed) break;
  }
}

/** Create two independent browser contexts, each logged in as a guest. */
export async function createTwoPlayers(browser: Browser, prefix = 'MP'): Promise<{
  host: { ctx: BrowserContext; page: Page; name: string };
  guest: { ctx: BrowserContext; page: Page; name: string };
}> {
  const hostCtx = await browser.newContext();
  const guestCtx = await browser.newContext();
  const hostPage = await hostCtx.newPage();
  const guestPage = await guestCtx.newPage();
  const hostName = uid(`${prefix}Host`);
  const guestName = uid(`${prefix}Guest`);

  await Promise.all([
    loginAsGuest(hostPage, hostName),
    loginAsGuest(guestPage, guestName),
  ]);

  return {
    host: { ctx: hostCtx, page: hostPage, name: hostName },
    guest: { ctx: guestCtx, page: guestPage, name: guestName },
  };
}

/** Close both contexts from createTwoPlayers safely. */
export async function closeTwoPlayers(host: { ctx: BrowserContext }, guest: { ctx: BrowserContext }): Promise<void> {
  await host.ctx.close().catch(() => {});
  await guest.ctx.close().catch(() => {});
}

// ── Room management ──────────────────────────────────────────────────────────

/**
 * Open the Create Room modal, fill the form, and submit.
 * Returns the 6-char room code extracted from the room lobby UI.
 */
export async function createFreeRoom(page: Page, roomName?: string): Promise<string> {
  await page.getByText('Create Room').click();
  await page.getByPlaceholder('My Game Room').fill(roomName ?? `T${Date.now()}`);
  // Ensure Free Play mode is selected (default)
  const freePlayBtn = page.getByText('Free Play');
  if (await freePlayBtn.isVisible({ timeout: 1_000 }).catch(() => false)) await freePlayBtn.click();
  await page.getByRole('button', { name: /create room/i }).click();

  // Room code — 6 uppercase alphanumeric characters shown in room lobby
  const codeLocator = page.locator('text=/[A-Z0-9]{6}/').first();
  await codeLocator.waitFor({ timeout: 12_000 });
  const code = (await codeLocator.textContent() ?? '').trim().toUpperCase().replace(/\s/g, '');
  return code;
}

/** Join a room by entering the code in the Join modal. */
export async function joinRoomByCode(page: Page, code: string): Promise<void> {
  await page.getByText('Join with Code').click();
  const input = page.getByPlaceholder('XXXXXX');
  await input.fill(code);
  await page.getByRole('button', { name: /^join$/i }).click();
  // Wait for room lobby to appear
  await page.getByText(code, { exact: false }).waitFor({ timeout: 12_000 });
}

// ── Game interactions ─────────────────────────────────────────────────────────

/**
 * Start an AI game from the lobby: click the mode button, then click "Start Game!"
 * in the room lobby that appears, then wait for the game board.
 */
export async function startAiGameMode(page: Page, modeLabel: string): Promise<void> {
  // Open the modal
  await page.getByText('Play vs AI').click();
  // Wait for modal and for the start button to be enabled
  await expect(page.getByText(modeLabel)).toBeEnabled({ timeout: 10_000 });
  await page.getByText(modeLabel).click();

  // Room lobby appears — click "Start Game!" to actually start
  const startBtn = page.locator('button').filter({ hasText: /start game/i }).first();
  await expect(startBtn).toBeVisible({ timeout: 20_000 });
  await startBtn.click();
}

/** Wait until it's the player's turn (Draw button visible and enabled). */
export async function waitForMyTurn(page: Page, timeout = 45_000): Promise<void> {
  await page.getByText('🎴 Draw from Deck').waitFor({ state: 'visible', timeout });
}

/** Play a single turn: draw from deck, then discard first selected card or SHOW. */
export async function playOneTurn(page: Page): Promise<'drew' | 'showed'> {
  // Try SHOW first if button is available
  const showBtn = page.getByText('📣 Call SHOW');
  if (await showBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await showBtn.click();
    // Confirm SHOW if dialog appears
    const confirmShow = page.getByRole('button', { name: /confirm show|yes, call show/i });
    if (await confirmShow.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await confirmShow.click();
    }
    return 'showed';
  }

  // Draw from deck
  await page.getByText('🎴 Draw from Deck').click();
  await page.waitForTimeout(800);

  // After drawing, discard a card (click first card in hand)
  const discardBtn = page.getByText('✋ Discard Cards');
  if (await discardBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    // Select a card first (click first hand card)
    const handCard = page.locator('[class*="hand"] [class*="card"], [data-hand] [data-card]').first();
    if (await handCard.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await handCard.click();
    }
    await discardBtn.click();
  }
  return 'drew';
}

/** Play turns until match ends or maxTurns reached. Returns 'ended' | 'timeout'. */
export async function playUntilMatchEnds(page: Page, maxTurns = 20): Promise<'ended' | 'timeout'> {
  for (let i = 0; i < maxTurns; i++) {
    // Check if match already ended
    const matchEnd = page.locator('text=/match over|you won|you lost|round result|winner/i').first();
    if (await matchEnd.isVisible({ timeout: 500 }).catch(() => false)) return 'ended';

    // Wait for my turn (short timeout — if not my turn, continue polling)
    const drawBtn = page.getByText('🎴 Draw from Deck');
    const isMyTurn = await drawBtn.isVisible({ timeout: 3_000 }).catch(() => false);

    if (isMyTurn) {
      await playOneTurn(page);
    } else {
      // Opponent's turn — wait briefly
      await page.waitForTimeout(2_000);
    }
  }

  // Final check for match end
  const ended = await page.locator('text=/match over|you won|you lost|winner/i').isVisible({ timeout: 2_000 }).catch(() => false);
  return ended ? 'ended' : 'timeout';
}

// ── Navigation ────────────────────────────────────────────────────────────────

export async function goToWallet(page: Page): Promise<void> {
  await page.goto('/wallet');
  // ProtectedRoute shows a loading spinner while loadMe() restores auth — wait generously.
  // Use .first() because the balance card renders "Tournament Wallet" twice.
  await expect(page.getByText('Tournament Wallet').first()).toBeVisible({ timeout: 20_000 });
}

export async function goToLobby(page: Page): Promise<void> {
  await page.goto('/lobby');
  await expect(page.getByText('Game Lobby')).toBeVisible({ timeout: 10_000 });
}

export async function goToProgression(page: Page): Promise<void> {
  await page.goto('/progression');
  await expect(page.getByText('My Progression')).toBeVisible({ timeout: 10_000 });
}
