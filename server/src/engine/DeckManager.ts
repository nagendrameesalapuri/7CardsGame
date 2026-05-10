import { Card, Rank, Suit } from '../../../shared/src/types';
import { v4 as uuidv4 } from 'uuid';

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// Ranks that cannot be selected as joker
const INVALID_JOKER_RANKS: Set<Rank> = new Set(['7', 'J']);

const BASE_VALUES: Record<Rank, number> = {
  A: 1, '2': 2, '3': 3, '4': 4, '5': 5,
  '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  J: 10, Q: 10, K: 10,
};

export class DeckManager {
  /** Create a fresh 52-card deck (unshuffled, no jokers assigned). */
  static createDeck(): Card[] {
    const deck: Card[] = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({
          id: `${suit[0]}${rank}-${uuidv4().slice(0, 6)}`,
          suit,
          rank,
          value: BASE_VALUES[rank],
          isJoker: false,
        });
      }
    }
    return deck;
  }

  /** Fisher-Yates shuffle. */
  static shuffleDeck(deck: Card[]): Card[] {
    const d = [...deck];
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }

  /**
   * Draw a random card from the deck to determine the joker rank.
   * Joker rank cannot be 7 or J — redraws until valid.
   * Returns the jokerRank, the jokerCard (removed from deck), and the remaining deck.
   */
  static selectJoker(deck: Card[]): { jokerRank: Rank; jokerCard: Card; remainingDeck: Card[] } {
    const candidates = deck.filter(c => !INVALID_JOKER_RANKS.has(c.rank));
    if (candidates.length === 0) throw new Error('No valid joker candidates in deck');

    const jokerCard = candidates[Math.floor(Math.random() * candidates.length)];
    const jokerRank = jokerCard.rank;
    const remainingDeck = deck.filter(c => c.id !== jokerCard.id);
    return { jokerRank, jokerCard, remainingDeck };
  }

  /** Mark every card whose rank matches jokerRank — value becomes 0. */
  static applyJoker(cards: Card[], jokerRank: Rank): Card[] {
    return cards.map(c =>
      c.rank === jokerRank ? { ...c, isJoker: true, value: 0 } : c
    );
  }

  /**
   * Deal 7 cards to each player in round-robin order.
   * Returns hands array and the remaining deck.
   */
  static dealCards(
    deck: Card[],
    playerCount: number
  ): { hands: Card[][]; remainingDeck: Card[] } {
    const hands: Card[][] = Array.from({ length: playerCount }, () => []);
    const d = [...deck];
    for (let round = 0; round < 7; round++) {
      for (let p = 0; p < playerCount; p++) {
        const card = d.shift();
        if (card) hands[p].push(card);
      }
    }
    return { hands, remainingDeck: d };
  }

  static getCardValue(card: Card): number {
    return card.isJoker ? 0 : card.value;
  }

  static calculateHandTotal(hand: Card[]): number {
    return hand.reduce((sum, c) => sum + DeckManager.getCardValue(c), 0);
  }

  /** Suit symbol for display. */
  static suitSymbol(suit: Suit): string {
    return { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }[suit];
  }

  static isRed(suit: Suit): boolean {
    return suit === 'hearts' || suit === 'diamonds';
  }
}
