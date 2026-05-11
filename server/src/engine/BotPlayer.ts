/**
 * BotPlayer — Pro-level AI decision logic.
 *
 * CRITICAL: GameEngine.processShow requires hasDrawnThisTurn = false.
 * SHOW must be declared at the START of the turn, BEFORE drawing.
 *
 * Pro strategy:
 *  1. SHOW immediately at turn start if hand ≤ 5 pts (before drawing — engine requires this)
 *  2. Cut matching cards from discard without drawing (free point reduction)
 *  3. Draw from discard if it completes a pair or saves ≥ 2 pts vs worst card
 *  4. After drawing, discard the highest-value non-pair single
 *  5. Never discard jokers (0 pts and wild — most valuable cards)
 *  6. Keep 7s for attack defense; discard only when no other option
 *  7. On 7 attack: throw back ALL available 7s to maximize counter damage
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
   * Takes from discard if it completes a pair, saves ≥ 2 pts, or is 0-value (joker rank).
   */
  static decideDrawSource(state: GameState, botPlayerId: string): DrawSource {
    const bot = state.players.find(p => p.id === botPlayerId)!;
    const topDiscard = state.discardPile[state.discardPile.length - 1];
    if (!topDiscard) return 'deck';

    // Never take power cards or printed jokers from discard
    if (!topDiscard.isJoker && (topDiscard.rank === '7' || topDiscard.rank === 'J')) return 'deck';
    if (topDiscard.isJoker) return 'deck';

    const discardValue = DeckManager.getCardValue(topDiscard);
    const nonJokers = bot.hand.filter(c => !c.isJoker);
    if (nonJokers.length === 0) return 'deck';

    // Take if it's a joker-rank card (0 pts — always worth having)
    if (discardValue === 0) return 'discard';

    // Take if it completes a pair with a card in hand (can discard both next turn — saves 2× value)
    const pairPartner = nonJokers.find(c => c.rank === topDiscard.rank);
    if (pairPartner && discardValue >= 4) return 'discard';

    // Take if it saves ≥ 2 pts vs our current worst card
    const highestValue = Math.max(...nonJokers.map(c => DeckManager.getCardValue(c)));
    if (discardValue < highestValue - 1) return 'discard';

    return 'deck';
  }

  /**
   * Decide which card(s) to discard after drawing.
   * Priority: keep jokers → keep pairs → drop highest-value single → drop 7s last resort.
   */
  static decideDiscard(state: GameState, botPlayerId: string): string[] {
    const bot = state.players.find(p => p.id === botPlayerId)!;
    const hand = bot.hand;

    // Build rank groups excluding jokers
    const byRank: Record<string, Card[]> = {};
    for (const card of hand) {
      if (card.isJoker) continue;
      if (!byRank[card.rank]) byRank[card.rank] = [];
      byRank[card.rank].push(card);
    }

    let bestSingle: Card | null = null;
    let bestSingleValue = -1;
    let bestGroup: Card[] = [];
    let bestGroupValue = -1;
    const sevenCards: Card[] = [];

    for (const group of Object.values(byRank)) {
      const isSeven = group[0].rank === '7';
      const totalValue = group.reduce((s, c) => s + DeckManager.getCardValue(c), 0);

      if (isSeven) {
        sevenCards.push(...group);
        continue; // 7s are defense — handle separately
      }

      if (group.length === 1) {
        if (totalValue > bestSingleValue) {
          bestSingleValue = totalValue;
          bestSingle = group[0];
        }
      } else {
        // Pair or triple
        if (totalValue > bestGroupValue) {
          bestGroupValue = totalValue;
          bestGroup = group;
        }
      }
    }

    // Have both a single and a group
    if (bestSingle && bestGroup.length > 0) {
      const perCard = bestGroupValue / bestGroup.length;
      // Keep the pair if per-card value is ≥ 7 and the single covers well
      // Pairs enable future cuts — worth preserving even over a comparable single
      if (bestSingleValue >= perCard && perCard >= 7) {
        return [bestSingle.id];
      }
      if (bestGroupValue > bestSingleValue) {
        return bestGroup.map(c => c.id);
      }
      return [bestSingle.id];
    }

    if (bestSingle) return [bestSingle.id];
    if (bestGroup.length > 0) return bestGroup.map(c => c.id);

    // Only jokers and 7s remain — sacrifice a 7 (keep one for defense if possible)
    if (sevenCards.length > 1) return [sevenCards[0].id];
    if (sevenCards.length === 1) return [sevenCards[0].id];

    // Absolute fallback: highest remaining card
    const highest = hand.reduce(
      (h, c) => DeckManager.getCardValue(c) > DeckManager.getCardValue(h) ? c : h,
      hand[0]
    );
    return [highest.id];
  }

  /**
   * Should the bot call SHOW?
   * NOTE: This is evaluated when hasDrawnThisTurn = false (start of turn, before drawing).
   * Be aggressive — any hand ≤ 5 pts is a winning opportunity.
   */
  static shouldCallShow(state: GameState, botPlayerId: string): boolean {
    const bot = state.players.find(p => p.id === botPlayerId)!;
    const total = DeckManager.calculateHandTotal(bot.hand);

    const turnsPlayed = Math.floor(state.discardPile.length / Math.max(state.players.length, 1));
    const lateGame = turnsPlayed >= 6;
    const veryLateGame = turnsPlayed >= 10;

    // Always SHOW at 0–2 pts — mathematically can't lose
    if (total <= 2) return true;
    // Almost always SHOW at 3–4 pts
    if (total <= 4) return Math.random() < 0.97;
    // SHOW at 5 pts depends on game stage
    if (total <= 5) return Math.random() < (veryLateGame ? 0.97 : lateGame ? 0.90 : 0.78);
    return false;
  }

  /**
   * Respond to a 7 attack.
   * Throw back ALL available 7s to maximize the counter-attack penalty chain.
   */
  static decideAttackResponse(
    state: GameState,
    botPlayerId: string,
  ): { action: 'throw' | 'take'; cardIds?: string[] } {
    const bot = state.players.find(p => p.id === botPlayerId)!;
    const sevens = bot.hand.filter(c => c.rank === '7' && !c.isJoker);
    if (sevens.length > 0) {
      return { action: 'throw', cardIds: sevens.map(c => c.id) };
    }
    return { action: 'take' };
  }

  /** Full decision tree for the bot's current turn. */
  static decide(state: GameState, botPlayerId: string): BotDecision {
    const bot = state.players.find(p => p.id === botPlayerId);
    if (!bot) return { action: 'draw', source: 'deck' };

    // 1. Respond to 7 attack immediately — takes priority over everything
    if (
      state.attackChain &&
      state.attackChain.targetPlayerIndex === state.players.indexOf(bot)
    ) {
      const resp = BotPlayer.decideAttackResponse(state, botPlayerId);
      return resp.action === 'throw'
        ? { action: 'attack_throw', cardIds: resp.cardIds }
        : { action: 'attack_take' };
    }

    // 2. SHOW check — MUST run when hasDrawnThisTurn = false.
    //    GameEngine.processShow REJECTS show when hasDrawnThisTurn = true.
    if (!state.hasDrawnThisTurn && BotPlayer.shouldCallShow(state, botPlayerId)) {
      return { action: 'show' };
    }

    if (!state.hasDrawnThisTurn) {
      // 3. Cut opportunity: discard matching cards directly without drawing
      const topDiscard = state.discardPile[state.discardPile.length - 1];
      const isRealSeven = (c: Card) => c.rank === '7' && !c.isJoker;
      if (topDiscard && !isRealSeven(topDiscard) && !topDiscard.isJoker) {
        const matching = bot.hand.filter(
          c => !c.isJoker && c.rank === topDiscard.rank && !isRealSeven(c)
        );
        if (matching.length > 0) {
          return { action: 'discard', cardIds: matching.map(c => c.id) };
        }
      }
      // 4. Draw
      return { action: 'draw', source: BotPlayer.decideDrawSource(state, botPlayerId) };
    }

    // 5. After drawing: discard worst card (cannot SHOW here — engine blocks it)
    return { action: 'discard', cardIds: BotPlayer.decideDiscard(state, botPlayerId) };
  }
}
