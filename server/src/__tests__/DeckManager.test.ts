import { DeckManager } from '../engine/DeckManager';
import { Card } from '../../../shared/src/types';

describe('DeckManager', () => {

  // ── createDeck ──────────────────────────────────────────────────────────────

  describe('createDeck', () => {
    it('creates 54 cards for 1 copy (52 standard + 2 printed jokers)', () => {
      const deck = DeckManager.createDeck(1);
      expect(deck).toHaveLength(54);
    });

    it('creates 108 cards for 2 copies', () => {
      const deck = DeckManager.createDeck(2);
      expect(deck).toHaveLength(108);
    });

    it('includes exactly 2 printed jokers per copy (rank=Joker)', () => {
      const deck1 = DeckManager.createDeck(1);
      const jokers1 = deck1.filter(c => c.rank === 'Joker');
      expect(jokers1).toHaveLength(2);

      const deck2 = DeckManager.createDeck(2);
      const jokers2 = deck2.filter(c => c.rank === 'Joker');
      expect(jokers2).toHaveLength(4);
    });

    it('all printed jokers have isJoker=true and value=0', () => {
      const deck = DeckManager.createDeck(1);
      deck.filter(c => c.rank === 'Joker').forEach(c => {
        expect(c.isJoker).toBe(true);
        expect(c.value).toBe(0);
      });
    });

    it('all standard cards have isJoker=false', () => {
      const deck = DeckManager.createDeck(1);
      deck.filter(c => c.rank !== 'Joker').forEach(c => {
        expect(c.isJoker).toBe(false);
      });
    });

    it('all cards have unique IDs', () => {
      const deck = DeckManager.createDeck(2);
      const ids = new Set(deck.map(c => c.id));
      expect(ids.size).toBe(deck.length);
    });

    it('each suit has 13 cards per copy', () => {
      const deck = DeckManager.createDeck(1);
      const heartCount = deck.filter(c => c.suit === 'hearts').length;
      expect(heartCount).toBe(13);
    });

    it('Aces have value 1', () => {
      const deck = DeckManager.createDeck(1);
      deck.filter(c => c.rank === 'A' && !c.isJoker).forEach(c => {
        expect(c.value).toBe(1);
      });
    });

    it('face cards (J, Q, K) have value 10', () => {
      const deck = DeckManager.createDeck(1);
      (['J', 'Q', 'K'] as const).forEach(rank => {
        deck.filter(c => c.rank === rank).forEach(c => {
          expect(c.value).toBe(10);
        });
      });
    });
  });

  // ── shuffleDeck ─────────────────────────────────────────────────────────────

  describe('shuffleDeck', () => {
    it('returns the same number of cards', () => {
      const deck = DeckManager.createDeck(1);
      const shuffled = DeckManager.shuffleDeck(deck);
      expect(shuffled).toHaveLength(deck.length);
    });

    it('contains the same card IDs after shuffling', () => {
      const deck = DeckManager.createDeck(1);
      const shuffled = DeckManager.shuffleDeck(deck);
      const origIds = new Set(deck.map(c => c.id));
      const shuffleIds = new Set(shuffled.map(c => c.id));
      expect(shuffleIds).toEqual(origIds);
    });

    it('does not mutate the original deck array', () => {
      const deck = DeckManager.createDeck(1);
      const firstCard = deck[0].id;
      DeckManager.shuffleDeck(deck);
      expect(deck[0].id).toBe(firstCard);
    });
  });

  // ── selectJoker ─────────────────────────────────────────────────────────────

  describe('selectJoker', () => {
    it('never selects 7 or J as paper joker rank', () => {
      for (let i = 0; i < 50; i++) {
        const deck = DeckManager.shuffleDeck(DeckManager.createDeck(1));
        const { jokerRank } = DeckManager.selectJoker(deck);
        expect(['7', 'J']).not.toContain(jokerRank);
      }
    });

    it('uses "A" as joker rank when a printed joker is drawn', () => {
      // Force a printed joker to be the selected jokerCard
      const deckWithJokerFirst: Card[] = [
        { id: 'pj-0', suit: 'none', rank: 'Joker', value: 0, isJoker: true },
        ...DeckManager.createDeck(1).filter(c => c.rank !== 'Joker'),
      ];
      // selectJoker picks randomly from candidates — mock to pick first candidate
      const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0);
      try {
        const { jokerRank } = DeckManager.selectJoker(deckWithJokerFirst);
        expect(jokerRank).toBe('A');
      } finally {
        mockRandom.mockRestore();
      }
    });

    it('reduces deck size by exactly 1 (joker card removed)', () => {
      const deck = DeckManager.createDeck(1);
      const { remainingDeck } = DeckManager.selectJoker(deck);
      expect(remainingDeck).toHaveLength(deck.length - 1);
    });

    it('throws if no valid candidates exist', () => {
      const onlySevensAndJacks: Card[] = [
        { id: '7h', suit: 'hearts', rank: '7', value: 7, isJoker: false },
        { id: 'Jh', suit: 'hearts', rank: 'J', value: 10, isJoker: false },
      ];
      expect(() => DeckManager.selectJoker(onlySevensAndJacks)).toThrow();
    });
  });

  // ── applyJoker ──────────────────────────────────────────────────────────────

  describe('applyJoker', () => {
    it('marks cards matching jokerRank as isJoker=true, value=0', () => {
      const cards: Card[] = [
        { id: '5h', suit: 'hearts', rank: '5', value: 5, isJoker: false },
        { id: '5d', suit: 'diamonds', rank: '5', value: 5, isJoker: false },
        { id: 'Kh', suit: 'hearts', rank: 'K', value: 10, isJoker: false },
      ];
      const result = DeckManager.applyJoker(cards, '5');
      const fives = result.filter(c => c.rank === '5');
      fives.forEach(c => {
        expect(c.isJoker).toBe(true);
        expect(c.value).toBe(0);
      });
      const king = result.find(c => c.rank === 'K')!;
      expect(king.isJoker).toBe(false);
      expect(king.value).toBe(10);
    });

    it('leaves printed jokers (rank=Joker) unchanged', () => {
      const joker: Card = { id: 'pj', suit: 'none', rank: 'Joker', value: 0, isJoker: true };
      const result = DeckManager.applyJoker([joker], 'A');
      expect(result[0].isJoker).toBe(true);
      expect(result[0].rank).toBe('Joker');
    });

    it('does not mutate original card objects (returns new array)', () => {
      const card: Card = { id: 'Ah', suit: 'hearts', rank: 'A', value: 1, isJoker: false };
      const result = DeckManager.applyJoker([card], 'A');
      expect(card.isJoker).toBe(false); // original unchanged
      expect(result[0].isJoker).toBe(true);
    });
  });

  // ── dealCards ───────────────────────────────────────────────────────────────

  describe('dealCards', () => {
    it('deals exactly 7 cards to each player', () => {
      const deck = DeckManager.createDeck(1);
      const { hands } = DeckManager.dealCards(deck, 4);
      hands.forEach(hand => expect(hand).toHaveLength(7));
    });

    it('deals round-robin (player 0 gets cards 0,4,8,... from deck)', () => {
      const deck = DeckManager.createDeck(1);
      const { hands } = DeckManager.dealCards(deck, 2);
      // First card dealt to player 0 should be deck[0]
      expect(hands[0][0].id).toBe(deck[0].id);
      // Second card dealt to player 1 should be deck[1]
      expect(hands[1][0].id).toBe(deck[1].id);
    });

    it('remaining deck is smaller by playerCount × 7 cards', () => {
      const deck = DeckManager.createDeck(1);
      const playerCount = 3;
      const { remainingDeck } = DeckManager.dealCards(deck, playerCount);
      expect(remainingDeck).toHaveLength(deck.length - playerCount * 7);
    });
  });

  // ── getCardValue / calculateHandTotal ────────────────────────────────────────

  describe('getCardValue', () => {
    it('returns 0 for any joker (isJoker=true)', () => {
      const printedJoker: Card = { id: 'pj', suit: 'none', rank: 'Joker', value: 0, isJoker: true };
      const paperJoker: Card  = { id: 'ph', suit: 'hearts', rank: '6', value: 0, isJoker: true };
      expect(DeckManager.getCardValue(printedJoker)).toBe(0);
      expect(DeckManager.getCardValue(paperJoker)).toBe(0);
    });

    it('returns card.value for non-jokers', () => {
      const ace: Card = { id: 'Ah', suit: 'hearts', rank: 'A', value: 1, isJoker: false };
      const king: Card = { id: 'Kh', suit: 'hearts', rank: 'K', value: 10, isJoker: false };
      expect(DeckManager.getCardValue(ace)).toBe(1);
      expect(DeckManager.getCardValue(king)).toBe(10);
    });
  });

  describe('calculateHandTotal', () => {
    it('sums all card values', () => {
      const hand: Card[] = [
        { id: 'Ah', suit: 'hearts', rank: 'A', value: 1, isJoker: false },
        { id: '5d', suit: 'diamonds', rank: '5', value: 5, isJoker: false },
        { id: 'Kc', suit: 'clubs', rank: 'K', value: 10, isJoker: false },
      ];
      expect(DeckManager.calculateHandTotal(hand)).toBe(16);
    });

    it('jokers contribute 0 to total', () => {
      const hand: Card[] = [
        { id: 'pj', suit: 'none', rank: 'Joker', value: 0, isJoker: true },
        { id: '9h', suit: 'hearts', rank: '9', value: 9, isJoker: false },
      ];
      expect(DeckManager.calculateHandTotal(hand)).toBe(9);
    });

    it('empty hand returns 0', () => {
      expect(DeckManager.calculateHandTotal([])).toBe(0);
    });

    it('hand of all jokers returns 0', () => {
      const hand: Card[] = Array.from({ length: 7 }, (_, i) => ({
        id: `pj${i}`,
        suit: 'none' as const,
        rank: 'Joker' as const,
        value: 0,
        isJoker: true,
      }));
      expect(DeckManager.calculateHandTotal(hand)).toBe(0);
    });
  });
});
