import { Card, Rank, Suit } from '../../../shared/src/types';
import { v4 as uuidv4 } from 'uuid';

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// Ranks that cannot be selected as joker (7 and J are power cards)
const INVALID_JOKER_RANKS: Set<Rank> = new Set(['7', 'J']);

const BASE_VALUES: Record<Rank, number> = {
  A: 1, '2': 2, '3': 3, '4': 4, '5': 5,
  '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  J: 10, Q: 10, K: 10, Joker: 0,
};

export class DeckManager {
  /**
   * Create a deck with the given number of copies.
   * Each copy = 52 standard cards + 2 printed jokers = 54 cards.
   * Use copies=1 for 2–3 players (54 cards) and copies=2 for 4+ players (108 cards).
   */
  static createDeck(copies: number = 1): Card[] {
    const deck: Card[] = [];
    for (let copy = 0; copy < copies; copy++) {
      for (const suit of SUITS) {
        for (const rank of RANKS) {
          deck.push({
            id: `${suit[0]}${rank}-${copy}-${uuidv4().slice(0, 6)}`,
            suit,
            rank,
            value: BASE_VALUES[rank],
            isJoker: false,
          });
        }
      }
      // 2 printed jokers per deck copy (52 + 2 = 54 per copy)
      for (let i = 0; i < 2; i++) {
        deck.push({
          id: `pj${copy}-${i}-${uuidv4().slice(0, 6)}`,
          suit: 'none',
          rank: 'Joker',
          value: 0,
          isJoker: true,
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
   * Draw a random card from the deck to determine the paper joker rank.
   * 7 and J are invalid paper joker selections (they're power cards).
   * If the drawn card is a printed joker (rank='Joker'), Ace becomes the paper joker.
   * Returns the jokerRank, the jokerCard (removed from deck), and the remaining deck.
   */
  static selectJoker(deck: Card[]): { jokerRank: Rank; jokerCard: Card; remainingDeck: Card[] } {
    const candidates = deck.filter(c => !INVALID_JOKER_RANKS.has(c.rank));
    if (candidates.length === 0) throw new Error('No valid joker candidates in deck');

    const jokerCard = candidates[Math.floor(Math.random() * candidates.length)];
    // Printed joker selected → Ace becomes the paper joker (standard Indian card rule)
    const jokerRank: Rank = jokerCard.rank === 'Joker' ? 'A' : jokerCard.rank;
    const remainingDeck = deck.filter(c => c.id !== jokerCard.id);
    return { jokerRank, jokerCard, remainingDeck };
  }

  /** Mark every card whose rank matches jokerRank — value becomes 0.
   *  Printed jokers (rank='Joker') are already isJoker=true; skip them. */
  static applyJoker(cards: Card[], jokerRank: Rank): Card[] {
    return cards.map(c => {
      if (c.rank === 'Joker') return c; // printed joker — already marked
      return c.rank === jokerRank ? { ...c, isJoker: true, value: 0 } : c;
    });
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
    return { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠', none: '' }[suit] ?? '';
  }

  static isRed(suit: Suit): boolean {
    return suit === 'hearts' || suit === 'diamonds';
  }
}
