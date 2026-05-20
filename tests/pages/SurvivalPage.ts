import { Page, Locator, expect } from '@playwright/test';
import { ENV } from '../config/env';

export type SurvivalTier = 'beginner' | 'pro' | 'elite' | 'boss_arena';

export interface SurvivalStageResult {
  stage: number;
  won: boolean;
  pointsEarned: number;
}

export class SurvivalPage {
  readonly page: Page;

  // Tier selection cards
  readonly beginnerCard: Locator;
  readonly proCard: Locator;
  readonly eliteCard: Locator;
  readonly bossArenaCard: Locator;

  // Action buttons
  readonly startBtn: Locator;
  readonly continueBtn: Locator;
  readonly abandonBtn: Locator;
  readonly confirmAbandonBtn: Locator;
  readonly backToLobbyBtn: Locator;

  // Info
  readonly stageIndicator: Locator;
  readonly pointsDisplay: Locator;
  readonly tierLabel: Locator;
  readonly stageResultOverlay: Locator;
  readonly tournamentCompleteOverlay: Locator;
  readonly activeStatus: Locator;
  readonly guestMessage: Locator;

  constructor(page: Page) {
    this.page = page;

    this.beginnerCard            = page.getByText(/beginner/i).first();
    this.proCard                 = page.getByText(/^pro$/i).first();
    this.eliteCard               = page.getByText(/^elite$/i).first();
    this.bossArenaCard           = page.getByText(/boss arena/i).first();

    this.startBtn                = page.getByRole('button', { name: /start|enter|play/i }).first();
    this.continueBtn             = page.getByRole('button', { name: /continue|next stage/i }).first();
    this.abandonBtn              = page.getByRole('button', { name: /abandon|quit/i }).first();
    this.confirmAbandonBtn       = page.getByRole('button', { name: /yes.*abandon|confirm abandon/i }).first();
    this.backToLobbyBtn          = page.getByRole('button', { name: /back to lobby/i });

    this.stageIndicator          = page.locator('text=/stage \d/i').first();
    this.pointsDisplay           = page.locator('text=/pts|points/i').first();
    this.tierLabel               = page.locator('text=/beginner|pro|elite|boss arena/i').first();
    this.stageResultOverlay      = page.locator('text=/stage.*complete|stage result/i').first();
    this.tournamentCompleteOverlay = page.locator('text=/tournament complete|you completed|final result/i').first();
    this.activeStatus            = page.locator('text=/active|in progress|resume/i').first();
    this.guestMessage            = page.getByText(/guest|sign in to play/i).first();
  }

  async goto() {
    await this.page.goto('/survival');
    await this.page.waitForLoadState('networkidle');
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL(/\/survival/);
    await this.page.waitForSelector(
      'text=/bot tournament|survival/i',
      { state: 'visible', timeout: 10_000 },
    );
  }

  // ── Tier selection ─────────────────────────────────────────────────────────

  async selectTier(tier: SurvivalTier): Promise<void> {
    const tierMap: Record<SurvivalTier, Locator> = {
      beginner:   this.beginnerCard,
      pro:        this.proCard,
      elite:      this.eliteCard,
      boss_arena: this.bossArenaCard,
    };
    await tierMap[tier].click({ timeout: ENV.ACTION_TIMEOUT });
    await this.page.waitForTimeout(300);
  }

  async startTournament(tier: SurvivalTier): Promise<void> {
    await this.selectTier(tier);
    await this.startBtn.click({ timeout: ENV.ACTION_TIMEOUT });
    // Wait for navigation to game or for stage intro
    await this.page.waitForURL(/\/game|\/survival/, { timeout: ENV.GAME_TIMEOUT });
  }

  // ── In-tournament actions ──────────────────────────────────────────────────

  async continueToNextStage(): Promise<void> {
    await this.continueBtn.waitFor({ state: 'visible', timeout: ENV.GAME_TIMEOUT });
    await this.continueBtn.click();
    await this.page.waitForURL(/\/game/, { timeout: ENV.GAME_TIMEOUT });
  }

  async abandonTournament(): Promise<void> {
    await this.abandonBtn.click({ timeout: ENV.ACTION_TIMEOUT });
    // Confirm dialog
    await this.confirmAbandonBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await this.confirmAbandonBtn.click();
    await this.page.waitForURL(/\/survival|\/lobby/, { timeout: 15_000 });
  }

  // ── State inspection ───────────────────────────────────────────────────────

  async getCurrentStage(): Promise<number> {
    const text = await this.stageIndicator.textContent().catch(() => '1');
    const match = text?.match(/\d+/);
    return match ? parseInt(match[0]) : 1;
  }

  async isActiveTournament(): Promise<boolean> {
    return this.activeStatus.isVisible({ timeout: 3_000 }).catch(() => false);
  }

  async isGuestBlocked(): Promise<boolean> {
    return this.guestMessage.isVisible({ timeout: 3_000 }).catch(() => false);
  }

  async getTotalPoints(): Promise<number> {
    const text = await this.pointsDisplay.textContent().catch(() => '0');
    const match = text?.match(/[\d,]+/);
    return match ? parseInt(match[0].replace(/,/g, '')) : 0;
  }

  async waitForStageResult(timeout = 60_000): Promise<void> {
    await this.page.waitForURL(/\/survival/, { timeout });
    await this.stageResultOverlay.waitFor({ state: 'visible', timeout: 15_000 });
  }

  async waitForTournamentComplete(timeout = 300_000): Promise<void> {
    await this.tournamentCompleteOverlay.waitFor({ state: 'visible', timeout });
  }

  // ── History tab ────────────────────────────────────────────────────────────

  async openHistoryTab(): Promise<void> {
    await this.page.getByRole('button', { name: /history/i }).first().click();
    await this.page.waitForTimeout(500);
  }

  async getHistoryEntries(): Promise<string[]> {
    const rows = this.page.locator('.history-row, [data-testid="history-row"]').or(
      this.page.locator('table tbody tr'),
    );
    return rows.allTextContents();
  }
}
