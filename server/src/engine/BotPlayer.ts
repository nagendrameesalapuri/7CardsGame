/**
 * BotPlayer — Pro-level AI with threat-aware decision making.
 *
 * CRITICAL: GameEngine.processShow requires hasDrawnThisTurn = false.
 * SHOW must be declared at the START of the turn, BEFORE drawing.
 *
 * Turn priority order:
 *  1. Respond to 7 attack (throw back ALL 7s, or take penalty)
 *  2. SHOW if hand ≤ 5 pts (checked before drawing — engine requires this)
 *  3. Cut matching cards from discard (skip drawing entirely)
 *  4. Draw (deck or discard depending on value analysis)
 *  5. After drawing: discard using threat-aware priority engine
 *
 * Threat-aware discard priority:
 *  P1  Any opponent ≤2 cards → throw ALL 7s for maximum attack chain
 *  P2  Next player ≤2 cards, no 7s → skip them with J
 *  P3  Any opponent ≤3 cards → throw ONE 7 to apply pressure
 *  P4  Next player ≤3 cards, no 7s → skip with J
 *  P5  Normal: discard highest-value single, preserve pairs for future cuts
 *  P6  Last resort: discard a 7 (one kept for defense if two exist)
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

  // ── Threat Analysis ──────────────────────────────────────────────────────────

  /**
   * Assess the danger level from opponents.
   * Returns: minimum opponent card count, and next player's card count.
   */
  private static assessThreat(state: GameState, botPlayerId: string): {
    minOpponentCards: number;
    nextPlayerCards: number;
  } {
    const bot = state.players.find(p => p.id === botPlayerId)!;
    const botIndex = state.players.indexOf(bot);
    const count = state.players.length;

    const opponents = state.players.filter(p => !p.isEliminated && p.id !== botPlayerId);
    const minOpponentCards = opponents.length > 0
      ? Math.min(...opponents.map(p => p.handCount))
      : Infinity;

    // Find next active player in circular turn order
    let nextIdx = (botIndex + 1) % count;
    let safety = 0;
    while (state.players[nextIdx].isEliminated && ++safety < count) {
      nextIdx = (nextIdx + 1) % count;
    }
    const nextPlayer = state.players[nextIdx];
    const nextPlayerCards = (nextPlayer && !nextPlayer.isEliminated)
      ? nextPlayer.handCount
      : Infinity;

    return { minOpponentCards, nextPlayerCards };
  }

  // ── Draw Source ──────────────────────────────────────────────────────────────

  /**
   * Choose deck vs discard pile.
   * Takes from discard if it: completes a pair, is 0-value (joker rank), or saves ≥2 pts.
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

    // Take if it's a joker-rank card (0 pts — reduces hand total for free)
    if (discardValue === 0) return 'discard';

    // Take if it completes a pair (can discard both next turn for double-value removal)
    const pairPartner = nonJokers.find(c => c.rank === topDiscard.rank);
    if (pairPartner && discardValue >= 4) return 'discard';

    // Take if it saves ≥2 pts vs our current worst card
    const highestValue = Math.max(...nonJokers.map(c => DeckManager.getCardValue(c)));
    if (discardValue < highestValue - 1) return 'discard';

    return 'deck';
  }

  // ── Discard Selection ────────────────────────────────────────────────────────

  /**
   * Choose which card(s) to discard after drawing.
   *
   * Threat-aware priority engine:
   *   P1: Immediate threat (opp ≤2 cards) → throw ALL 7s
   *   P2: Next player ≤2 cards, no 7s → skip with J
   *   P3: Medium threat (opp ≤3 cards) → throw ONE 7
   *   P4: Next player ≤3 cards, no 7s → skip with J
   *   P5: Normal — drop highest single, preserve pairs
   *   P6: Fallback — sacrifice a 7 (keep one if two exist)
   */
  static decideDiscard(state: GameState, botPlayerId: string): string[] {
    const bot = state.players.find(p => p.id === botPlayerId)!;
    const hand = bot.hand;

    const { minOpponentCards, nextPlayerCards } = BotPlayer.assessThreat(state, botPlayerId);
    const sevens = hand.filter(c => c.rank === '7' && !c.isJoker);
    const jacks = hand.filter(c => c.rank === 'J' && !c.isJoker);

    // P1: Immediate threat — throw all 7s for max penalty chain on the target
    if (minOpponentCards <= 2 && sevens.length > 0) {
      return sevens.map(c => c.id);
    }

    // P2: Next player is immediate threat, no 7s to attack — use J to skip them
    if (nextPlayerCards <= 2 && jacks.length > 0 && sevens.length === 0) {
      return [jacks[0].id];
    }

    // P3: Medium threat — apply steady pressure with a single 7
    if (minOpponentCards <= 3 && sevens.length > 0) {
      return [sevens[0].id];
    }

    // P4: Next player is medium threat — skip their turn with J
    if (nextPlayerCards <= 3 && jacks.length > 0 && sevens.length === 0) {
      return [jacks[0].id];
    }

    // P5: Normal discard — analyze hand composition
    const byRank: Record<string, Card[]> = {};
    for (const card of hand) {
      if (card.isJoker) continue;
      if (card.rank === '7' || card.rank === 'J') continue; // handled above
      if (!byRank[card.rank]) byRank[card.rank] = [];
      byRank[card.rank].push(card);
    }

    let bestSingle: Card | null = null;
    let bestSingleValue = -1;
    let bestGroup: Card[] = [];
    let bestGroupValue = -1;

    for (const group of Object.values(byRank)) {
      const totalValue = group.reduce((s, c) => s + DeckManager.getCardValue(c), 0);
      if (group.length === 1) {
        if (totalValue > bestSingleValue) {
          bestSingleValue = totalValue;
          bestSingle = group[0];
        }
      } else {
        if (totalValue > bestGroupValue) {
          bestGroupValue = totalValue;
          bestGroup = group;
        }
      }
    }

    if (bestSingle && bestGroup.length > 0) {
      const perCard = bestGroupValue / bestGroup.length;
      // Keep pair if per-card value ≥7 (pairs enable future cuts — strategic value)
      if (bestSingleValue >= perCard && perCard >= 7) return [bestSingle.id];
      if (bestGroupValue > bestSingleValue) return bestGroup.map(c => c.id);
      return [bestSingle.id];
    }
    if (bestSingle) return [bestSingle.id];
    if (bestGroup.length > 0) return bestGroup.map(c => c.id);

    // P6: Only jokers, 7s, and Js remain — sacrifice a 7 or J (keep one 7 for defense)
    if (sevens.length > 1) return [sevens[0].id];
    if (jacks.length > 0) return [jacks[0].id];
    if (sevens.length === 1) return [sevens[0].id];

    // Absolute fallback
    const highest = hand.reduce(
      (h, c) => DeckManager.getCardValue(c) > DeckManager.getCardValue(h) ? c : h,
      hand[0]
    );
    return [highest.id];
  }

  // ── Show Decision ────────────────────────────────────────────────────────────

  /**
   * Should the bot declare SHOW?
   * Evaluated when hasDrawnThisTurn = false (engine requires this).
   * More aggressive when opponents are close to showing.
   */
  static shouldCallShow(state: GameState, botPlayerId: string): boolean {
    const bot = state.players.find(p => p.id === botPlayerId)!;
    const total = DeckManager.calculateHandTotal(bot.hand);

    const turnsPlayed = Math.floor(state.discardPile.length / Math.max(state.players.length, 1));
    const lateGame = turnsPlayed >= 6;
    const veryLateGame = turnsPlayed >= 10;

    // Always SHOW at 0–2 pts — mathematically safe
    if (total <= 2) return true;
    // Almost always SHOW at 3–4 pts
    if (total <= 4) return Math.random() < 0.97;
    // Threshold at exactly 5 pts — probability scales with game stage
    if (total <= 5) return Math.random() < (veryLateGame ? 0.97 : lateGame ? 0.90 : 0.78);
    return false;
  }

  // ── Attack Response ──────────────────────────────────────────────────────────

  /**
   * Respond to a 7 attack.
   * Throw ALL available 7s back to maximize the counter-attack chain.
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

  // ── Main Decision Tree ───────────────────────────────────────────────────────

  /** Full decision for the bot's current turn step. */
  static decide(state: GameState, botPlayerId: string): BotDecision {
    const bot = state.players.find(p => p.id === botPlayerId);
    if (!bot) return { action: 'draw', source: 'deck' };

    // 1. Respond to 7 attack immediately — top priority
    if (state.attackChain &&
        state.attackChain.targetPlayerIndex === state.players.indexOf(bot)) {
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

    // 5. After drawing: use threat-aware discard engine (cannot SHOW — engine blocks it)
    return { action: 'discard', cardIds: BotPlayer.decideDiscard(state, botPlayerId) };
  }
}
