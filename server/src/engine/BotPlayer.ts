/**
 * BotPlayer — Simple AI decision logic.
 * The bot always plays optimally to minimize its hand total.
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
   * Look at top discard card — take it if it reduces hand total, else draw from deck.
   */
  static decideDrawSource(state: GameState, botPlayerId: string): DrawSource {
    const bot = state.players.find(p => p.id === botPlayerId)!;
    const topDiscard = state.discardPile[state.discardPile.length - 1];
    if (!topDiscard) return 'deck';

    // 7 and J cannot be taken from the discard pile
    if (!topDiscard.isJoker && (topDiscard.rank === '7' || topDiscard.rank === 'J')) {
      return 'deck';
    }

    const highestCard = bot.hand.reduce(
      (h, c) => (DeckManager.getCardValue(c) > DeckManager.getCardValue(h) ? c : h),
      bot.hand[0]
    );

    // Take from discard if it saves points
    if (
      DeckManager.getCardValue(topDiscard) < DeckManager.getCardValue(highestCard) &&
      DeckManager.getCardValue(topDiscard) < 5
    ) {
      return 'discard';
    }

    return 'deck';
  }

  /**
   * Decide which card to discard.
   * Priority: discard highest value card, but prefer using 7/J power cards strategically.
   */
  static decideDiscard(state: GameState, botPlayerId: string): string[] {
    const bot = state.players.find(p => p.id === botPlayerId)!;
    const hand = bot.hand;

    // Group cards by rank
    const byRank: Record<string, Card[]> = {};
    for (const card of hand) {
      if (!byRank[card.rank]) byRank[card.rank] = [];
      byRank[card.rank].push(card);
    }

    // Find the rank group whose combined value is highest (most points to shed)
    let bestGroup: Card[] = [];
    let bestValue = -1;

    for (const group of Object.values(byRank)) {
      const groupValue = group.reduce((sum, c) => sum + DeckManager.getCardValue(c), 0);
      if (groupValue > bestValue) {
        bestValue = groupValue;
        bestGroup = group;
      }
    }

    return bestGroup.map(c => c.id);
  }

  /**
   * Should the bot call SHOW?
   * Call show aggressively when hand ≤ 3 to secure wins.
   */
  static shouldCallShow(state: GameState, botPlayerId: string): boolean {
    const bot = state.players.find(p => p.id === botPlayerId)!;
    const total = DeckManager.calculateHandTotal(bot.hand);
    return total <= 3;
  }

  /**
   * Respond to a 7 attack.
   * Throw a 7 if available, else take penalty.
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
      // Check for cut opportunity: discard matching cards without drawing
      const topDiscard = state.discardPile[state.discardPile.length - 1];
      const isRealSeven = (c: Card) => c.rank === '7' && !c.isJoker;
      if (topDiscard && !isRealSeven(topDiscard)) {
        const matching = bot.hand.filter(c => c.rank === topDiscard.rank && !isRealSeven(c));
        const matchValue = matching.reduce((sum, c) => sum + DeckManager.getCardValue(c), 0);
        // Cut if the matching cards have meaningful point value (worth shedding)
        if (matching.length > 0 && matchValue >= 5) {
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
