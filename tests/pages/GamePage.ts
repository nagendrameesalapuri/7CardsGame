import { Page, Locator, expect } from '@playwright/test';
import { ENV } from '../config/env';

export type GameStatus = 'waiting' | 'dealing' | 'playing' | 'show_called' | 'round_end' | 'match_end';

export class GamePage {
  readonly page: Page;

  // Action buttons
  readonly drawDeckBtn: Locator;
  readonly discardBtn: Locator;
  readonly showBtn: Locator;
  readonly attackThrowBtn: Locator;
  readonly attackTakeBtn: Locator;
  readonly cutBtn: Locator;
  readonly roundReadyBtn: Locator;

  // Info elements
  readonly turnIndicator: Locator;
  readonly roundNumber: Locator;
  readonly playerHand: Locator;
  readonly discardPile: Locator;
  readonly drawPile: Locator;
  readonly scoreBoard: Locator;
  readonly matchEndOverlay: Locator;
  readonly backToLobbyBtn: Locator;
  readonly leaveRoomBtn: Locator;

  constructor(page: Page) {
    this.page = page;

    this.drawDeckBtn     = page.locator('[data-action="draw-deck"], .draw-pile, [data-testid="draw-pile"]').first();
    this.discardBtn      = page.getByRole('button', { name: /^discard/i }).first();
    this.showBtn         = page.getByRole('button', { name: /✓ show!|show/i }).first();
    this.attackThrowBtn  = page.getByRole('button', { name: /throw|attack/i }).first();
    this.attackTakeBtn   = page.getByRole('button', { name: /take/i }).first();
    this.cutBtn          = page.getByRole('button', { name: /cut/i }).first();
    this.roundReadyBtn   = page.getByRole('button', { name: /ready|next round/i }).first();

    this.turnIndicator   = page.locator('text=/your turn/i, [data-testid="turn-indicator"]').first();
    this.roundNumber     = page.locator('text=/round \d/i').first();
    this.playerHand      = page.locator('.player-hand, [data-testid="player-hand"]').first();
    this.discardPile     = page.locator('.discard-pile, [data-testid="discard-pile"]').first();
    this.drawPile        = page.locator('.draw-pile, [data-testid="draw-pile"]').first();
    this.scoreBoard      = page.locator('.score-board, [data-testid="score-board"]').first();
    this.matchEndOverlay = page.locator('text=/match over|you won|you lost/i').first();
    this.backToLobbyBtn  = page.getByRole('button', { name: /back to lobby/i });
    this.leaveRoomBtn    = page.getByRole('button', { name: /leave|exit/i }).first();
  }

  async goto() {
    await this.page.goto('/game');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL(/\/game/);
    // Either game board is showing or "no active game" fallback
    await this.page.waitForSelector(
      '.game-board, [data-testid="game-board"], text=/no active game/i',
      { state: 'visible', timeout: ENV.GAME_TIMEOUT },
    );
  }

  async waitForMyTurn(timeout = 30_000): Promise<boolean> {
    try {
      await this.turnIndicator.waitFor({ state: 'visible', timeout });
      return true;
    } catch {
      return false;
    }
  }

  async isMyTurn(): Promise<boolean> {
    return this.turnIndicator.isVisible({ timeout: 1_000 }).catch(() => false);
  }

  // ── Card interactions ──────────────────────────────────────────────────────

  async getHandCards(): Promise<Locator[]> {
    const cards = this.page.locator('.player-hand-card, [data-testid^="card-"]');
    const count = await cards.count();
    return Array.from({ length: count }, (_, i) => cards.nth(i));
  }

  async selectCard(index: number): Promise<void> {
    const cards = this.page.locator('.player-hand-card, [data-testid^="card-"]');
    await cards.nth(index).click({ timeout: ENV.ACTION_TIMEOUT });
  }

  async drawFromDeck(): Promise<void> {
    // The DeckArea component — click on the draw pile
    const deck = this.page.locator('.deck-area button, [data-testid="draw-pile"] button').first()
      .or(this.page.locator('button:has-text("Draw")').first());
    await deck.click({ timeout: ENV.ACTION_TIMEOUT });
    await this.page.waitForTimeout(350);
  }

  async drawFromDiscard(): Promise<void> {
    const discardTop = this.page.locator('.discard-pile .card, [data-testid="discard-top"]').first();
    await discardTop.click({ timeout: ENV.ACTION_TIMEOUT });
    await this.page.waitForTimeout(350);
  }

  async discard(): Promise<void> {
    await this.discardBtn.click({ timeout: ENV.ACTION_TIMEOUT });
    await this.page.waitForTimeout(600);
  }

  async showHand(): Promise<void> {
    await this.showBtn.click({ timeout: ENV.ACTION_TIMEOUT });
    await this.page.waitForTimeout(600);
  }

  // ── Round / match flow ─────────────────────────────────────────────────────

  async waitForRoundEnd(timeout = 45_000): Promise<void> {
    await this.page.waitForSelector(
      'text=/round over|show declared|scores/i',
      { state: 'visible', timeout },
    );
  }

  async waitForMatchEnd(timeout = 90_000): Promise<void> {
    await this.matchEndOverlay.waitFor({ state: 'visible', timeout });
  }

  async getMatchWinner(): Promise<string> {
    return (await this.matchEndOverlay.textContent()) ?? '';
  }

  async clickRoundReady(): Promise<void> {
    if (await this.roundReadyBtn.isVisible({ timeout: 3_000 })) {
      await this.roundReadyBtn.click();
      await this.page.waitForTimeout(500);
    }
  }

  async backToLobby(): Promise<void> {
    await this.backToLobbyBtn.click();
    await this.page.waitForURL(/\/lobby/, { timeout: 15_000 });
  }

  // ── State inspection ───────────────────────────────────────────────────────

  async getGameStatus(): Promise<string> {
    return this.page.evaluate(() => {
      try {
        const store = (window as any).__zustand_game_store__;
        return store?.getState?.().game?.status ?? 'unknown';
      } catch { return 'unknown'; }
    });
  }

  async getRoomCode(): Promise<string> {
    return this.page.evaluate(() => {
      try {
        const store = (window as any).__zustand_game_store__;
        return store?.getState?.().room?.code ?? '';
      } catch { return ''; }
    });
  }
}
