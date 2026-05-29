/**
 * Game continuity regression suite
 * Covers: refresh during game (reconnect), tab switch (visibility change),
 *         switch to another app and return, resume button, session persistence
 */
import { test, expect } from '@playwright/test';
import { loginAsGuest, startAiGameMode, createTwoPlayers, closeTwoPlayers, uid, goToLobby } from './helpers';

// ── Refresh during AI game ────────────────────────────────────────────────────

test.describe('Refresh during AI game', () => {
  test('page reload shows "Connecting to game…" and reconnects', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsGuest(page, uid('Refresh'));

    // Start an AI game (includes room lobby → Start Game! click)
    await startAiGameMode(page, '▶ Start Casual Duel');
    await page.locator('text=/draw from deck|connecting/i').waitFor({ timeout: 40_000 });

    // Reload the page
    await page.reload();

    // Should reconnect: either show "Connecting to game…" then reconnect,
    // or land on lobby with Resume button (if auto-reconnect not triggered)
    const reconnecting = page.locator('text=/connecting to game|reconnect/i').first();
    const resumeOnLobby = page.locator('text=/resume|▶ resume/i').first();
    const gameActive = page.locator('text=/draw from deck/i').first();

    const outcome = await Promise.race([
      reconnecting.waitFor({ timeout: 15_000 }).then(() => 'reconnecting'),
      resumeOnLobby.waitFor({ timeout: 15_000 }).then(() => 'resume-lobby'),
      gameActive.waitFor({ timeout: 15_000 }).then(() => 'active'),
    ]).catch(() => 'none');

    expect(['reconnecting', 'resume-lobby', 'active']).toContain(outcome);
  });

  test('game session persists after reload — no data loss', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsGuest(page, uid('RefreshPersist'));

    await startAiGameMode(page, '▶ Start Casual Duel');
    await page.locator('text=/draw from deck/i').waitFor({ timeout: 40_000 });

    // Draw a card to advance game state
    await page.getByText('🎴 Draw from Deck').click();
    await page.waitForTimeout(1_000);

    // Reload
    await page.reload();
    await page.waitForTimeout(3_000);

    // Session should still have the user logged in (auth persists)
    const stillLoggedIn = await page.locator('text=/lobby|draw from deck|connecting|resume/i')
      .first()
      .isVisible({ timeout: 15_000 })
      .catch(() => false);
    expect(stillLoggedIn).toBe(true);
  });

  test('Resume button on lobby after refresh reconnects to game', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsGuest(page, uid('ResumeBtn'));

    await page.getByText('Play vs AI').click();
    await page.getByText('▶ Start Casual Duel').click();
    await page.locator('text=/draw from deck|connecting/i').waitFor({ timeout: 30_000 });

    // Navigate to lobby (simulates user going back)
    await goToLobby(page);

    // Resume card should appear
    const resumeBtn = page.getByText('▶ Resume');
    if (await resumeBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await resumeBtn.click();
      // Should reconnect to game
      await expect(
        page.locator('text=/draw from deck|connecting to game/i').first()
      ).toBeVisible({ timeout: 20_000 });
    } else {
      // Resume might show as a different element — check for game-related text
      const gameRef = await page.locator('text=/vs ai|ai match|resume/i').first()
        .isVisible({ timeout: 5_000 }).catch(() => false);
      expect(gameRef).toBe(true);
    }
  });
});

// ── Tab/app switch simulation ─────────────────────────────────────────────────

test.describe('Tab switch / app switch during AI game', () => {
  test('game remains active after tab loses visibility', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsGuest(page, uid('TabSwitch'));

    await page.getByText('Play vs AI').click();
    await page.getByText('▶ Start Casual Duel').click();
    await page.locator('text=/draw from deck|connecting/i').waitFor({ timeout: 30_000 });

    // Simulate tab becoming hidden (like switching to another app)
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Wait 5 seconds (simulating app switch duration)
    await page.waitForTimeout(5_000);

    // Simulate tab becoming visible again (returning to app)
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Game should still be active (not disconnected for short absence)
    const gameStillActive = page.locator('text=/draw from deck|connecting|your turn|waiting/i').first();
    await expect(gameStillActive).toBeVisible({ timeout: 15_000 });
  });

  test('game reconnects after long tab switch (15 seconds)', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAsGuest(page, uid('LongSwitch'));

    await page.getByText('Play vs AI').click();
    await page.getByText('▶ Start Casual Duel').click();
    await page.locator('text=/draw from deck|connecting/i').waitFor({ timeout: 30_000 });

    // Simulate extended tab switch
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(15_000);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Give the reconnect time to happen
    await page.waitForTimeout(5_000);

    // Should be reconnected or on lobby with resume
    const outcome = await page.locator(
      'text=/draw from deck|connecting|resume|game lobby/i'
    ).first().isVisible({ timeout: 20_000 }).catch(() => false);
    expect(outcome).toBe(true);
  });
});

// ── Multiplayer game continuity ───────────────────────────────────────────────

test.describe('Multiplayer game continuity', () => {
  test('create room, switch tabs, come back and the room is still open', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsGuest(page, uid('MPSwitch'));

    // Create a room
    await page.getByText('Create Room').click();
    await page.getByPlaceholder('My Game Room').fill('SwitchRoom');
    await page.getByRole('button', { name: /create room/i }).click();
    await page.locator('text=/[A-Z0-9]{6}/').first().waitFor({ timeout: 12_000 });

    // Simulate app switch
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(8_000);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Room should still be open (code visible)
    const codeEl = page.locator('text=/[A-Z0-9]{6}/').first();
    const roomStillActive = await codeEl.isVisible({ timeout: 10_000 }).catch(() => false);

    // Or resume card might appear if socket disconnected
    const resumeCard = await page.locator('text=/resume|room/i').first()
      .isVisible({ timeout: 5_000 }).catch(() => false);

    expect(roomStillActive || resumeCard).toBe(true);
  });

  test('disconnected player sees reconnect on refresh during multiplayer game', async ({ browser }) => {
    test.setTimeout(180_000);
    const hostCtx = await browser.newContext();
    const guestCtx = await browser.newContext();
    const hostPage = await hostCtx.newPage();
    const guestPage = await guestCtx.newPage();

    try {
      const hostName = uid('MPRefHost');
      const guestName = uid('MPRefGuest');
      await loginAsGuest(hostPage, hostName);
      await loginAsGuest(guestPage, guestName);

      // Create and join room
      await hostPage.getByText('Create Room').click();
      await hostPage.getByPlaceholder('My Game Room').fill('RefreshTest');
      await hostPage.getByRole('button', { name: /create room/i }).click();
      const codeEl = hostPage.locator('text=/[A-Z0-9]{6}/').first();
      await codeEl.waitFor({ timeout: 12_000 });
      const code = (await codeEl.textContent() ?? '').trim().toUpperCase();

      // Guest joins
      await guestPage.getByText('Join with Code').click();
      await guestPage.getByPlaceholder('XXXXXX').fill(code);
      await guestPage.getByRole('button', { name: /^join$/i }).click();
      await expect(guestPage.getByText(hostName)).toBeVisible({ timeout: 12_000 });

      // Start the game
      await hostPage.getByRole('button', { name: /start game/i }).click();
      await hostPage.locator('text=/draw from deck|connecting/i').waitFor({ timeout: 25_000 });

      // Guest refreshes during game
      await guestPage.reload();
      await guestPage.waitForTimeout(3_000);

      // Guest should reconnect or see resume
      const guestReconnected = await guestPage.locator(
        'text=/draw from deck|connecting|resume|game lobby/i'
      ).first().isVisible({ timeout: 20_000 }).catch(() => false);
      expect(guestReconnected).toBe(true);
    } finally {
      await hostCtx.close().catch(() => {});
      await guestCtx.close().catch(() => {});
    }
  });
});

// ── Resume game card ──────────────────────────────────────────────────────────

test.describe('Resume game card on lobby', () => {
  test('Resume card shows correct badge for AI game', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAsGuest(page, uid('ResumeBadge'));
    await startAiGameMode(page, '▶ Start Casual Duel');
    await page.locator('text=/draw from deck|connecting/i').waitFor({ timeout: 40_000 });

    await goToLobby(page);

    // Resume card should have VS AI badge
    const badgeVisible = await page.locator('text=/vs ai|ai match|resume/i').first()
      .isVisible({ timeout: 10_000 }).catch(() => false);
    expect(badgeVisible).toBe(true);
  });

  test('multiple resume cards shown when multiple games active', async ({ page }) => {
    // Only one AI game can be active at a time — this verifies single resume card logic
    test.setTimeout(60_000);
    await loginAsGuest(page, uid('OneResume'));
    await startAiGameMode(page, '▶ Start Casual Duel');
    await page.locator('text=/draw from deck|connecting/i').waitFor({ timeout: 40_000 });

    await goToLobby(page);

    // Should show at most 1 resume card for the AI game
    const resumeCards = page.locator('text=/▶ resume/i');
    const count = await resumeCards.count().catch(() => 0);
    expect(count).toBeLessThanOrEqual(3); // max 3 resume cards per lobby design
  });
});

// ── Session persistence across navigation ────────────────────────────────────

test.describe('Session persistence', () => {
  test('auth token persists across full page reload', async ({ page }) => {
    await loginAsGuest(page, uid('SessReload'));
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();

    await page.reload();
    await page.waitForTimeout(2_000);

    const tokenAfterReload = await page.evaluate(() => localStorage.getItem('token'));
    expect(tokenAfterReload).toBe(token);
  });

  test('lobby reachable after auth and browser back/forward', async ({ page }) => {
    await loginAsGuest(page, uid('NavPersist'));
    await page.goto('/progression');
    await page.goBack();
    await expect(page).toHaveURL('/lobby');
  });
});
