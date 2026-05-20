import { Page, Locator, expect } from '@playwright/test';

export class SpectatorPage {
  readonly page: Page;

  readonly spectatorBadge: Locator;
  readonly gameBoard: Locator;
  readonly leaveBtn: Locator;
  readonly playerLabels: Locator;
  readonly chatPanel: Locator;

  constructor(page: Page) {
    this.page = page;
    this.spectatorBadge = page.locator('text=/spectator|watching/i').first();
    this.gameBoard      = page.locator('.game-board, [data-testid="game-board"]').first();
    this.leaveBtn       = page.getByRole('button', { name: /leave|exit/i }).first();
    this.playerLabels   = page.locator('.player-label, [data-testid="player-name"]');
    this.chatPanel      = page.locator('.chat-panel, [data-testid="chat"]').first();
  }

  async goto(roomCode: string) {
    await this.page.goto(`/spectate/${roomCode}`);
    await this.page.waitForLoadState('networkidle');
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL(/\/spectate\//);
    // Either spectator badge or game board must appear
    await this.page.waitForSelector(
      'text=/spectator|watching/i, .game-board',
      { state: 'visible', timeout: 15_000 },
    );
  }

  async getPlayerCount(): Promise<number> {
    return this.playerLabels.count();
  }
}
