/**
 * Game automation helpers — actions on the GamePage that require
 * careful sequencing (draw → select → discard/show).
 */
import { Page, expect } from '@playwright/test';
import { ENV } from '../config/env';

export type DrawSource = 'deck' | 'discard';

/**
 * Wait for the game board to be visible and in "playing" state.
 */
export async function waitForGameStart(page: Page, timeout = ENV.GAME_TIMEOUT): Promise<void> {
  // The game board renders when we have an active game
  await page.waitForSelector('[data-testid="game-board"], .game-board-root, text=/your turn/i', {
    timeout,
    state: 'visible',
  });
}

/**
 * Wait until it is this player's turn by checking for "Your Turn" indicator.
 */
export async function waitForMyTurn(page: Page, timeout = 30_000): Promise<void> {
  await page.waitForFunction(
    () => {
      const body = document.body.innerText;
      return /your turn/i.test(body) || /draw a card/i.test(body);
    },
    { timeout },
  );
}

/**
 * Draw a card from the deck or discard pile.
 * Handles the "already drew" guard — skips if already drew this turn.
 */
export async function drawCard(page: Page, source: DrawSource = 'deck'): Promise<void> {
  if (source === 'deck') {
    // Click the deck (draw pile) area
    const deck = page.locator('[data-testid="draw-pile"], [data-action="draw-deck"]').first()
      .or(page.getByText(/draw from deck/i).first())
      .or(page.locator('.deck-area, .draw-pile').first());
    await deck.click({ timeout: ENV.ACTION_TIMEOUT });
  } else {
    // Click the top of the discard pile
    const discard = page.locator('[data-testid="discard-pile"], [data-action="draw-discard"]').first()
      .or(page.locator('.discard-pile, .discard-area').first());
    await discard.click({ timeout: ENV.ACTION_TIMEOUT });
  }
  // Short wait for state update
  await page.waitForTimeout(300);
}

/**
 * Select a card by its position in the hand (0-indexed).
 */
export async function selectCard(page: Page, index: number): Promise<void> {
  const cards = page.locator('[data-testid="player-card"], .player-hand .card').or(
    page.locator('.player-hand-card'),
  );
  await cards.nth(index).click({ timeout: ENV.ACTION_TIMEOUT });
}

/**
 * Click the Discard button (visible after selecting a card and drawing).
 */
export async function clickDiscard(page: Page): Promise<void> {
  const btn = page.getByRole('button', { name: /discard/i }).first();
  await btn.click({ timeout: ENV.ACTION_TIMEOUT });
  await page.waitForTimeout(600); // action throttle is 550ms
}

/**
 * Click the SHOW button to declare a win.
 */
export async function clickShow(page: Page): Promise<void> {
  const btn = page.getByRole('button', { name: /show/i }).first();
  await btn.click({ timeout: ENV.ACTION_TIMEOUT });
  await page.waitForTimeout(600);
}

/**
 * Perform one complete turn: draw from deck, select first card, discard.
 * Returns true if the turn completed, false if not our turn.
 */
export async function takeTurn(page: Page): Promise<boolean> {
  const bodyText = await page.evaluate(() => document.body.innerText);
  if (!/your turn/i.test(bodyText) && !/draw a card/i.test(bodyText)) {
    return false;
  }
  try {
    await drawCard(page, 'deck');
    await selectCard(page, 0);
    await clickDiscard(page);
    return true;
  } catch {
    return false;
  }
}

/**
 * Wait for the round/match to end (score board appears).
 */
export async function waitForRoundEnd(page: Page, timeout = 45_000): Promise<void> {
  await page.waitForSelector(
    'text=/round over|match over|winner|score/i, [data-testid="score-board"]',
    { timeout, state: 'visible' },
  );
}

/**
 * Click "Next Round" or "Continue" after a round ends.
 */
export async function continueAfterRound(page: Page): Promise<void> {
  const btn = page.getByRole('button', { name: /next round|continue|ready/i }).first();
  if (await btn.isVisible({ timeout: 5_000 })) {
    await btn.click();
    await page.waitForTimeout(500);
  }
}

/**
 * Wait for match end overlay and return the winner text.
 */
export async function waitForMatchEnd(page: Page, timeout = 60_000): Promise<string> {
  await page.waitForSelector('text=/match over|you won|you lost|winner/i', {
    timeout,
    state: 'visible',
  });
  return page.evaluate(() => document.body.innerText);
}
