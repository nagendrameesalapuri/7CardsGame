/**
 * BotPlayer — Pro-level AI decision logic.
 *
 * Core strategy:
 *  1. Take from discard to complete a pair (enables double-discard next turn)
 *  2. Discard the highest-value single card; preserve valuable pairs
 *  3. Call SHOW aggressively based on game stage
 *  4. Cut any matching cards from the table (even 1 pt)
 *  5. Keep 7s only when better discard options exist
 */

import { GameState, Card, DrawSource } from '../../../shared/src/types';
import { DeckManager } from './DeckManager';

export interface BotDecision {
  action: 'draw' | 'discard' | 'show' | 'attack_throw' | 'attack_take';
  source?: DrawSource;
  cardIds?: string[];
}

export class BotPlayer {
  private static THINK_DELAY_MS = 900;

  static getThinkDelay(): number {
    return BotPlayer.THINK_DELAY_MS + Math.random() * 600;
  }

  /**
   * Decide draw source.
   * Takes from discard if it completes a pair (huge value) or saves 2+ pts vs highest card.
   */
  static decideDrawSource(state: GameState, botPlayerId: string): DrawSource {
    const bot = state.players.find(p => p.id === botPlayerId)!;
    const topDiscard = state.discardPile[state.discardPile.length - 1];
    if (!topDiscard) return 'deck';

    // Power cards (7, J) can't be taken from discard — they'd trigger powers
    if (!topDiscard.isJoker && (topDiscard.rank === '7' || topDiscard.rank === 'J')) return 'deck';
    if (topDiscard.isJoker) return 'deck';

    const discardValue = DeckManager.getCardValue(topDiscard);
    const nonJokers = bot.hand.filter(c => !c.isJoker);
    if (nonJokers.length === 0) return 'deck';

    // Take if it completes a pair with a card already in hand (value ≥ 5 per card)
    // Completing a pair means we can discard both next turn — saves 2× the card value
    const pairPartner = nonJokers.find(c => c.rank === topDiscard.rank);
    if (pairPartner && discardValue >= 5) return 'discard';

    // Take if it replaces the highest card and saves ≥ 2 pts
    const highestValue = Math.max(...nonJokers.map(c => DeckManager.getCardValue(c)));
    if (discardValue < highestValue - 1) return 'discard';

    return 'deck';
  }

  /**
   * Decide which card(s) to discard after drawing.
   *
   * Rules (in priority order):
   * 1. Never discard Jokers (value 0 and very scarce)
   * 2. Prefer discarding the highest-value SINGLE over breaking a high-value pair
   *    — unless the pair's per-card value > the best single (discard the pair to save more pts)
   * 3. Keep 7s only when there's a better target to drop; otherwise 7 = 7 pts dead weight
   */
  static decideDiscard(state: GameState, botPlayerId: string): string[] {
    const bot = state.players.find(p => p.id === botPlayerId)!;
    const hand = bot.hand;

    // Build rank groups (no Jokers)
    const byRank: Record<string, Card[]> = {};
    for (const card of hand) {
      if (card.isJoker) continue;
      if (!byRank[card.rank]) byRank[card.rank] = [];
      byRank[card.rank].push(card);
    }

    // Separate singles from pairs/triples; handle 7s specially
    let bestSingle: Card | null = null;
    let bestSingleValue = -1;
    let bestGroup: Card[] = [];
    let bestGroupValue = -1;

    for (const group of Object.values(byRank)) {
      const isSeven = group[0].rank === '7';
      const totalValue = group.reduce((s, c) => s + DeckManager.getCardValue(c), 0);

      if (group.length === 1) {
        if (!isSeven && totalValue > bestSingleValue) {
          bestSingleValue = totalValue;
          bestSingle = group[0];
        }
        // Treat 7 as a fallback single (lower priority than other singles)
      } else {
        // Pairs and triples
        if (totalValue > bestGroupValue) {
          bestGroupValue = totalValue;
          bestGroup = group;
        }
      }
    }

    // Decision: single vs group
    if (bestSingle && bestGroup.length > 0) {
      const perCard = bestGroupValue / bestGroup.length;
      // Discard the group if it saves more total points
      // BUT: keep a valuable pair (≥ 7/card) when we have a comparable single to drop
      // This preserves pairs for potential future triple cuts
      if (bestSingleValue >= perCard && perCard >= 7) {
        return [bestSingle.id]; // drop the single, keep the pair
      }
      if (bestGroupValue > bestSingleValue) {
        return bestGroup.map(c => c.id);
      }
      return [bestSingle.id];
    }

    if (bestSingle) return [bestSingle.id];
    if (bestGroup.length > 0) return bestGroup.map(c => c.id);

    // No regular singles/groups — consider 7s
    // Find 7 with lowest strategic value (if we have two 7s, one is expendable)
    const sevens = hand.filter(c => c.rank === '7' && !c.isJoker);
    if (sevens.length > 0) return [sevens[0].id];

    // Absolute fallback: highest remaining card
    const highest = hand.reduce(
      (h, c) => DeckManager.getCardValue(c) > DeckManager.getCardValue(h) ? c : h,
      hand[0]
    );
    return [highest.id];
  }

  /**
   * Should the bot call SHOW?
   * Accounts for game stage: late game → show more aggressively.
   */
  static shouldCallShow(state: GameState, botPlayerId: string): boolean {
    const bot = state.players.find(p => p.id === botPlayerId)!;
    const total = DeckManager.calculateHandTotal(bot.hand);

    // Estimate game stage from how many turns have been played
    const turnsPlayed = Math.floor(state.discardPile.length / Math.max(state.players.length, 1));
    const lateGame = turnsPlayed >= 6;

    if (total === 0) return true;
    if (total <= 2) return true;
    if (total <= 4) return Math.random() < 0.93;
    if (total <= 5) return Math.random() < (lateGame ? 0.82 : 0.60);
    if (total <= 7 && lateGame) return Math.random() < 0.40;
    return false;
  }

  /**
   * Respond to a 7 attack.
   * Always throw back a 7 if available (never take the penalty when avoidable).
   */
  static decideAttackResponse(
    state: GameState,
    botPlayerId: string,
  ): { action: 'throw' | 'take'; cardIds?: string[] } {
    const bot = state.players.find(p => p.id === botPlayerId)!;
    const sevens = bot.hand.filter(c => c.rank === '7' && !c.isJoker);
    if (sevens.length > 0) return { action: 'throw', cardIds: [sevens[0].id] };
    return { action: 'take' };
  }

  /** Full decision tree for the bot's current turn. */
  static decide(state: GameState, botPlayerId: string): BotDecision {
    const bot = state.players.find(p => p.id === botPlayerId);
    if (!bot) return { action: 'draw', source: 'deck' };

    // Respond to attack first
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
      // Cut any non-zero value match (even 1 pt — every point matters)
      const topDiscard = state.discardPile[state.discardPile.length - 1];
      const isRealSeven = (c: Card) => c.rank === '7' && !c.isJoker;
      if (topDiscard && !isRealSeven(topDiscard) && !topDiscard.isJoker) {
        const matching = bot.hand.filter(
          c => !c.isJoker && c.rank === topDiscard.rank && !isRealSeven(c)
        );
        const matchValue = matching.reduce((s, c) => s + DeckManager.getCardValue(c), 0);
        if (matching.length > 0 && matchValue >= 1) {
          return { action: 'discard', cardIds: matching.map(c => c.id) };
        }
      }
      return { action: 'draw', source: BotPlayer.decideDrawSource(state, botPlayerId) };
    }

    // After drawing: show if eligible, else discard
    if (BotPlayer.shouldCallShow(state, botPlayerId)) {
      return { action: 'show' };
    }

    return { action: 'discard', cardIds: BotPlayer.decideDiscard(state, botPlayerId) };
  }
}
