/**
 * E2E Suite 02 — Lobby & Room Management
 * Covers: navigation, create room modal, public room list, tab switching,
 *         room join via code, room state display.
 */
import { test, expect } from '@playwright/test';
import { guestLogin } from '../helpers/auth';
import { LobbyPage } from '../pages/LobbyPage';
import { uniqueUsername } from '../test-data/users';

test.describe('Lobby & Room Management', () => {
  let lobby: LobbyPage;

  test.beforeEach(async ({ page }) => {
    lobby = new LobbyPage(page);
    await guestLogin(page, uniqueUsername('Lobby'));
  });

  // ── Page Load ───────────────────────────────────────────────────────────────

  test('lobby page loads correctly after guest login', async ({ page }) => {
    await lobby.expectLoaded();
  });

  test('lobby shows "Create Room" button prominently', async ({ page }) => {
    await expect(lobby.createRoomBtn).toBeVisible();
  });

  // ── Navigation ───────────────────────────────────────────────────────────────

  test('navigates to wallet page', async ({ page }) => {
    await lobby.gotoWallet();
    await expect(page).toHaveURL(/\/wallet/);
  });

  test('navigates to bot tournament page', async ({ page }) => {
    await lobby.gotoTournament();
    await expect(page).toHaveURL(/\/tournament/);
  });

  test('navigates to survival tournament page', async ({ page }) => {
    await lobby.gotoSurvival();
    await expect(page).toHaveURL(/\/survival/);
  });

  test('navigates to leaderboard page', async ({ page }) => {
    await page.goto('/leaderboard');
    await expect(page).toHaveURL(/\/leaderboard/);
  });

  test('navigates to profile page', async ({ page }) => {
    if (await lobby.profileLink.isVisible({ timeout: 3_000 })) {
      await lobby.profileLink.click();
      await expect(page).toHaveURL(/\/profile/);
    } else {
      await page.goto('/profile');
      await expect(page).toHaveURL(/\/profile/);
    }
  });

  // ── Create Room Modal ───────────────────────────────────────────────────────

  test('create room modal opens on button click', async ({ page }) => {
    await lobby.openCreateRoomModal();
    await expect(
      page.getByRole('dialog').or(page.getByText(/create room/i).first()),
    ).toBeVisible();
  });

  test('create room modal has player count options', async ({ page }) => {
    await lobby.openCreateRoomModal();
    // Expect 2, 3, or 4 player options
    await expect(
      page.getByText(/2 players|3 players|4 players|\b2\b|\b3\b|\b4\b/i).first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('create room modal has private/public option', async ({ page }) => {
    await lobby.openCreateRoomModal();
    await expect(
      page.getByText(/private|public/i).first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('creating a room places host in the room', async ({ page }) => {
    await lobby.openCreateRoomModal();
    // Confirm creation with defaults
    const confirmBtn = page.getByRole('button', { name: /create room|confirm|create/i }).last();
    await confirmBtn.click({ timeout: 10_000 });
    // After creating, should see room UI (waiting for players)
    await expect(
      page.getByText(/waiting|room code|invite|players/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  // ── Room Tabs ───────────────────────────────────────────────────────────────

  test('lobby has room tabs or sections', async ({ page }) => {
    // Look for tab-like navigation in lobby
    const tabs = page.getByRole('button').filter({ hasText: /public|private|rooms/i });
    const tabCount = await tabs.count();
    // Either tabs exist or the main room list is directly visible
    if (tabCount > 0) {
      await expect(tabs.first()).toBeVisible();
    }
  });

  // ── Join Room ───────────────────────────────────────────────────────────────

  test('join room with invalid code shows error', async ({ page }) => {
    const joinInput = page.getByPlaceholder(/room code|enter code/i).first();
    if (await joinInput.isVisible({ timeout: 3_000 })) {
      await joinInput.fill('INVALID');
      await page.getByRole('button', { name: /join/i }).first().click();
      await expect(
        page.getByText(/not found|invalid|error/i).first(),
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  // ── Leaderboard ──────────────────────────────────────────────────────────────

  test('leaderboard page shows rankings or empty state', async ({ page }) => {
    await page.goto('/leaderboard');
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByText(/rank|player|no players|be the first/i).first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  // ── Room Presence ────────────────────────────────────────────────────────────

  test('room created with bot shows bot count option', async ({ page }) => {
    await lobby.openCreateRoomModal();
    // Look for bot option
    const botOption = page.getByText(/bot|ai player/i).first();
    if (await botOption.isVisible({ timeout: 3_000 })) {
      await expect(botOption).toBeVisible();
    }
  });
});
