import { Page, Locator, expect } from '@playwright/test';

export interface RoomConfig {
  name?: string;
  maxPlayers?: 2 | 3 | 4;
  rounds?: number;
  isPrivate?: boolean;
  entryFee?: number;
  botCount?: number;
}

export class LobbyPage {
  readonly page: Page;

  readonly createRoomBtn: Locator;
  readonly joinRoomInput: Locator;
  readonly joinRoomBtn: Locator;
  readonly walletLink: Locator;
  readonly tournamentLink: Locator;
  readonly leaderboardLink: Locator;
  readonly profileLink: Locator;
  readonly logoutBtn: Locator;
  readonly roomList: Locator;
  readonly resumeBanners: Locator;

  constructor(page: Page) {
    this.page = page;
    this.createRoomBtn   = page.getByRole('button', { name: /create/i }).first();
    this.joinRoomInput   = page.getByPlaceholder(/room code/i).first();
    this.joinRoomBtn     = page.getByRole('button', { name: /join/i }).first();
    this.walletLink      = page.getByRole('link', { name: /wallet/i });
    this.tournamentLink  = page.getByText(/bot tournament/i).first();
    this.leaderboardLink = page.getByRole('link', { name: /leaderboard|board/i }).first();
    this.profileLink     = page.getByRole('link', { name: /profile/i });
    this.logoutBtn       = page.getByRole('button', { name: /logout/i });
    this.roomList        = page.locator('.room-list, [data-testid="room-list"]');
    this.resumeBanners   = page.locator('[data-testid="resume-banner"]').or(
      page.getByRole('button', { name: /▶ resume/i }),
    );
  }

  async goto() {
    await this.page.goto('/lobby');
    await this.page.waitForLoadState('networkidle');
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL(/\/lobby/);
    await expect(this.createRoomBtn).toBeVisible();
  }

  // ── Room creation ──────────────────────────────────────────────────────────

  async openCreateRoomModal() {
    await this.createRoomBtn.click();
    // Wait for modal to appear
    await this.page.waitForSelector(
      '[role="dialog"], .modal, text=/create room/i',
      { state: 'visible', timeout: 10_000 },
    );
  }

  async createRoom(config: RoomConfig = {}): Promise<string> {
    await this.openCreateRoomModal();
    const { page } = this;

    // Room name
    if (config.name) {
      const nameInput = page.getByLabel(/room name/i).or(page.getByPlaceholder(/room name/i)).first();
      if (await nameInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await nameInput.fill(config.name);
      }
    }

    // Private toggle
    if (config.isPrivate !== undefined) {
      const toggle = page.getByLabel(/private/i).or(page.getByRole('checkbox', { name: /private/i })).first();
      if (await toggle.isVisible({ timeout: 2_000 }).catch(() => false)) {
        const isChecked = await toggle.isChecked();
        if (isChecked !== config.isPrivate) await toggle.click();
      }
    }

    // Max players
    if (config.maxPlayers) {
      const select = page.getByLabel(/players/i).or(page.locator('select[name*="player"]')).first();
      if (await select.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await select.selectOption(String(config.maxPlayers));
      } else {
        // Button-based player count selector
        const btn = page.getByRole('button', { name: new RegExp(`^${config.maxPlayers}$`) });
        if (await btn.isVisible({ timeout: 2_000 }).catch(() => false)) await btn.click();
      }
    }

    // Entry fee
    if (config.entryFee !== undefined) {
      const feeInput = page.getByLabel(/entry fee/i).or(page.getByPlaceholder(/entry fee/i)).first();
      if (await feeInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await feeInput.fill(String(config.entryFee));
      }
    }

    // Confirm creation
    const confirmBtn = page.getByRole('button', { name: /create room|confirm|create/i }).last();
    await confirmBtn.click();

    // Wait for room code to appear (we've been placed in the room)
    await page.waitForURL(/\/lobby/, { timeout: 15_000 });

    // Extract room code from the UI
    const codeEl = page.locator('[data-testid="room-code"]').or(
      page.getByText(/room code/i).locator('..'),
    ).first();

    const codeText = await codeEl.textContent({ timeout: 10_000 }).catch(() => '');
    const match = codeText?.match(/[A-Z0-9]{4,8}/);
    return match?.[0] ?? '';
  }

  async joinRoom(code: string) {
    // Look for join input in various places
    const input = this.page.getByPlaceholder(/room code|enter code/i).first();
    await input.fill(code.toUpperCase());
    await this.page.getByRole('button', { name: /join/i }).first().click();
    await this.page.waitForURL(/\/lobby/, { timeout: 15_000 });
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  async gotoWallet() {
    await this.walletLink.click();
    await this.page.waitForURL(/\/wallet/, { timeout: 10_000 });
  }

  async gotoTournament() {
    await this.tournamentLink.click();
    await this.page.waitForURL(/\/tournament/, { timeout: 10_000 });
  }

  async gotoSurvival() {
    await this.page.goto('/survival');
    await this.page.waitForLoadState('networkidle');
  }

  async logout() {
    await this.logoutBtn.click();
    await this.page.waitForURL('/', { timeout: 10_000 });
  }

  // ── Room list ──────────────────────────────────────────────────────────────

  async getPublicRooms(): Promise<string[]> {
    const rows = this.page.locator('[data-testid="room-row"]').or(
      this.page.locator('.room-card, .room-item'),
    );
    return rows.allTextContents();
  }

  async hasResumeGame(): Promise<boolean> {
    return this.resumeBanners.first().isVisible({ timeout: 3_000 }).catch(() => false);
  }

  async resumeFirstGame() {
    await this.resumeBanners.first().click();
    await this.page.waitForURL(/\/game/, { timeout: 15_000 });
  }
}
