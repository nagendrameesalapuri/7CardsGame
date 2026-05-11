/**
 * BotPlayer — AI decision logic.
 * Plays competitively to minimize hand total and win rounds.
 */

import { GameState, Card, DrawSource } from '../../../shared/src/types';
import { DeckManager } from './DeckManager';

export interface BotDecision {
  action: 'draw' | 'discard' | 'show' | 'attack_throw' | 'attack_take';
  source?: DrawSource;
  cardIds?: string[];
}

export class BotPlayer {
  private static THINK_DELAY_MS = 1200;

  static getThinkDelay(): number {
    return BotPlayer.THINK_DELAY_MS + Math.random() * 800;
  }

  /**
   * Decide what to draw.
   * Take from discard if it's strictly better than the highest card in hand.
   */
  static decideDrawSource(state: GameState, botPlayerId: string): DrawSource {
    const bot = state.players.find(p => p.id === botPlayerId)!;
    const topDiscard = state.discardPile[state.discardPile.length - 1];
    if (!topDiscard) return 'deck';

    // Power cards (7, J) can't be taken from discard — they would trigger powers
    if (!topDiscard.isJoker && (topDiscard.rank === '7' || topDiscard.rank === 'J')) {
      return 'deck';
    }

    // Never take a Joker from discard (value 0 but burns a Joker slot; draw for other Jokers)
    if (topDiscard.isJoker) return 'deck';

    const discardValue = DeckManager.getCardValue(topDiscard);
    const highestCard = bot.hand.reduce(
      (h, c) => (DeckManager.getCardValue(c) > DeckManager.getCardValue(h) ? c : h),
      bot.hand[0]
    );
    const highestValue = DeckManager.getCardValue(highestCard);

    // Take if it replaces the highest card and saves at least 2 points
    if (discardValue < highestValue - 1) {
      return 'discard';
    }

    return 'deck';
  }

  /**
   * Decide which card(s) to discard.
   * Never discard Jokers. Discard the highest-value group (same rank).
   * Keep 7s when hand total is already low — they're valuable for attack deflection.
   */
  static decideDiscard(state: GameState, botPlayerId: string): string[] {
    const bot = state.players.find(p => p.id === botPlayerId)!;
    const hand = bot.hand;
    const handTotal = DeckManager.calculateHandTotal(hand);

    // Group non-Joker cards by rank
    const byRank: Record<string, Card[]> = {};
    for (const card of hand) {
      if (card.isJoker) continue; // never discard Jokers
      if (!byRank[card.rank]) byRank[card.rank] = [];
      byRank[card.rank].push(card);
    }

    let bestGroup: Card[] = [];
    let bestValue = -1;

    for (const group of Object.values(byRank)) {
      // Keep 7s when hand is low — useful for attack defense
      if (group[0].rank === '7' && handTotal <= 12) continue;

      const groupValue = group.reduce((sum, c) => sum + DeckManager.getCardValue(c), 0);
      if (groupValue > bestValue) {
        bestValue = groupValue;
        bestGroup = group;
      }
    }

    // Fallback: if all remaining cards are 7s and Jokers, discard a 7
    if (bestGroup.length === 0) {
      const seven = hand.find(c => c.rank === '7' && !c.isJoker);
      if (seven) return [seven.id];
      // Last resort: discard the highest-value card individually
      const highest = hand.reduce(
        (h, c) => (DeckManager.getCardValue(c) > DeckManager.getCardValue(h) ? c : h),
        hand[0]
      );
      return [highest.id];
    }

    return bestGroup.map(c => c.id);
  }

  /**
   * Should the bot call SHOW?
   * Show aggressively at low totals; show with some probability at moderate totals.
   */
  static shouldCallShow(state: GameState, botPlayerId: string): boolean {
    const bot = state.players.find(p => p.id === botPlayerId)!;
    const total = DeckManager.calculateHandTotal(bot.hand);
    if (total === 0) return true;
    if (total <= 2) return true;
    if (total <= 4) return Math.random() < 0.90;
    if (total <= 5) return Math.random() < 0.65;
    return false;
  }

  /**
   * Respond to a 7 attack.
   * Throw a 7 back if available, else take the penalty.
   */
  static decideAttackResponse(
    state: GameState,
    botPlayerId: string,
  ): { action: 'throw' | 'take'; cardIds?: string[] } {
    const bot = state.players.find(p => p.id === botPlayerId)!;
    const sevens = bot.hand.filter(c => c.rank === '7' && !c.isJoker);

    if (sevens.length > 0) {
      return { action: 'throw', cardIds: [sevens[0].id] };
    }
    return { action: 'take' };
  }

  /** Full decision tree for the bot's current turn. */
  static decide(state: GameState, botPlayerId: string): BotDecision {
    const bot = state.players.find(p => p.id === botPlayerId);
    if (!bot) return { action: 'draw', source: 'deck' };

    // Respond to attack
    if (
      state.attackChain &&
      state.attackChain.targetPlayerIndex === state.players.indexOf(bot)
    ) {
      const resp = BotPlayer.decideAttackResponse(state, botPlayerId);
      return resp.action === 'throw'
        ? { action: 'attack_throw', cardIds: resp.cardIds }
        : { action: 'attack_take' };
    }

    if (!state.hasDrawnThisTurn) {
      // Cut opportunity: discard matching cards without drawing
      const topDiscard = state.discardPile[state.discardPile.length - 1];
      const isRealSeven = (c: Card) => c.rank === '7' && !c.isJoker;
      if (topDiscard && !isRealSeven(topDiscard) && !topDiscard.isJoker) {
        const matching = bot.hand.filter(c => !c.isJoker && c.rank === topDiscard.rank && !isRealSeven(c));
        const matchValue = matching.reduce((sum, c) => sum + DeckManager.getCardValue(c), 0);
        // Cut if worth at least 3 points (was 5 — more aggressive)
        if (matching.length > 0 && matchValue >= 3) {
          return { action: 'discard', cardIds: matching.map(c => c.id) };
        }
      }
      return { action: 'draw', source: BotPlayer.decideDrawSource(state, botPlayerId) };
    }

    // After drawing: maybe show, else discard
    if (BotPlayer.shouldCallShow(state, botPlayerId)) {
      return { action: 'show' };
    }

    return { action: 'discard', cardIds: BotPlayer.decideDiscard(state, botPlayerId) };
  }
}
