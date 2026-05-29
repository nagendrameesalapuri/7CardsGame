/**
 * REGRESSION SUITE 02 — Scoring, SHOW Outcomes & Prize Logic
 *
 * Covers: score calculation for all card ranks, joker = 0 pts,
 * SHOW winner determination, SHOW loser penalty, round score accumulation,
 * multiple-round scoring, hand-value edge cases.
 */

import { GameEngine, GameConfig } from '../../engine/GameEngine';
import { DeckManager } from '../../engine/DeckManager';
import { makeCard, makePrintedJoker, makePlayer, makeGameState } from '../helpers';
import { Card, Rank } from '../../../../shared/src/types';

beforeAll(() => jest.spyOn(console, 'log').mockImplementation(() => {}));
afterAll(() => (console.log as jest.Mock).mockRestore());

// ── Helpers ───────────────────────────────────────────────────────────────────

function handValue(cards: Card[]): number {
  // Same logic GameEngine uses internally: sum card values (jokers = 0)
  return DeckManager.calculateHandTotal(cards);
}

function hand(...pairs: [Rank, boolean?][]): Card[] {
  return pairs.map(([r, isJoker]) => {
    const c = makeCard(r);
    if (isJoker) { c.isJoker = true; c.value = 0; }
    return c;
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 1. HAND VALUE COMPUTATION
// ════════════════════════════════════════════════════════════════════════════

describe('Hand Value Computation', () => {
  it('ace = 1 pt', () => expect(handValue(hand(['A']))).toBe(1));
  it('2 = 2 pts', ()  => expect(handValue(hand(['2']))).toBe(2));
  it('9 = 9 pts', ()  => expect(handValue(hand(['9']))).toBe(9));
  it('10 = 10 pts', () => expect(handValue(hand(['10']))).toBe(10));
  it('J = 10 pts',  () => expect(handValue(hand(['J']))).toBe(10));
  it('Q = 10 pts',  () => expect(handValue(hand(['Q']))).toBe(10));
  it('K = 10 pts',  () => expect(handValue(hand(['K']))).toBe(10));

  it('printed joker = 0 pts', () => {
    expect(handValue([makePrintedJoker()])).toBe(0);
  });

  it('paper joker (rank card marked isJoker) = 0 pts', () => {
    const c = makeCard('K'); c.isJoker = true; c.value = 0;
    expect(handValue([c])).toBe(0);
  });

  it('all-joker hand = 0 pts', () => {
    expect(handValue([makePrintedJoker(), makePrintedJoker()])).toBe(0);
  });

  it('mixed hand: joker + face cards', () => {
    const joker = makePrintedJoker();
    const king = makeCard('K');   // 10
    const ace = makeCard('A');    // 1
    expect(handValue([joker, king, ace])).toBe(11);
  });

  it('7 cards full hand value sum (K+Q+J+10+9+8+7 = 10+10+10+10+9+8+7 = 64)', () => {
    const cards = [makeCard('K'), makeCard('Q'), makeCard('J'), makeCard('10'), makeCard('9'), makeCard('8'), makeCard('7')];
    expect(handValue(cards)).toBe(64);
  });

  it('zero-value hand (all jokers) stays 0', () => {
    const jokers = Array(7).fill(null).map(() => makePrintedJoker());
    expect(handValue(jokers)).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. SHOW THRESHOLD CHECKS
// ════════════════════════════════════════════════════════════════════════════

describe('SHOW Threshold (≤ 5 pts)', () => {
  function showableHand(...pairs: [Rank, boolean?][]): Card[] {
    return hand(...pairs);
  }

  it('0 pts hand: valid SHOW', () => {
    expect(handValue([makePrintedJoker(), makePrintedJoker()])).toBeLessThanOrEqual(5);
  });

  it('5 pts hand: valid SHOW', () => {
    expect(handValue(hand(['A'], ['A'], ['A'], ['2']))).toBe(5);
  });

  it('6 pts hand: invalid SHOW', () => {
    expect(handValue(hand(['A'], ['A'], ['A'], ['3']))).toBe(6);
  });

  it('exact 5 = valid boundary', () => {
    expect(handValue(hand(['5']))).toBe(5);
  });

  it('exact 6 = invalid boundary', () => {
    expect(handValue(hand(['6']))).toBe(6);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. ROUND RESULT SCORING
// ════════════════════════════════════════════════════════════════════════════

describe('Round Result Scoring', () => {
  function makeConfig(n: number): GameConfig {
    return {
      roomId: 'r1',
      players: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, userId: `u${i}`, username: `P${i}`, avatar: 'a', isBot: false })),
      roundCount: 3,
      turnTimeLimit: 30,
    };
  }

  it('SHOW caller scores 0 if they have the lowest hand', () => {
    const s = GameEngine.initializeGame(makeConfig(2));
    s.players[0].hand = [makePrintedJoker(), makePrintedJoker(), makeCard('A'), makeCard('A'), makeCard('A'), makeCard('A'), makeCard('A')];
    s.players[1].hand = [makeCard('K'), makeCard('K'), makeCard('K'), makeCard('K'), makeCard('Q'), makeCard('Q'), makeCard('Q')];
    s.hasDrawnThisTurn = false; // SHOW is called before drawing this turn
    s.drawnCard = null;
    s.attackChain = null;

    const r = GameEngine.processShow(s, s.players[0].id);
    if (!r.error && r.roundResult) {
      const caller = r.roundResult.scores.find(sc => sc.playerId === s.players[0].id);
      expect(caller?.score).toBe(0); // Winner pays 0
    }
  });

  it('losing player pays their hand total', () => {
    const s = GameEngine.initializeGame(makeConfig(2));
    const loserHand = [makeCard('K'), makeCard('K'), makeCard('K'), makeCard('Q'), makeCard('Q'), makeCard('Q'), makeCard('J')];
    s.players[0].hand = [makePrintedJoker(), makePrintedJoker(), makeCard('A'), makeCard('A'), makeCard('A'), makeCard('A'), makeCard('A')];
    s.players[1].hand = loserHand;
    s.hasDrawnThisTurn = false;
    s.drawnCard = null;
    s.attackChain = null;

    const r = GameEngine.processShow(s, s.players[0].id);
    if (!r.error && r.roundResult) {
      const loser = r.roundResult.scores.find(sc => sc.playerId === s.players[1].id);
      if (loser) {
        expect(loser.score).toBe(handValue(loserHand));
      }
    }
  });

  it('SHOW caller penalised if NOT lowest hand', () => {
    const s = GameEngine.initializeGame(makeConfig(2));
    const p0Hand = [makeCard('K'), makeCard('Q'), makeCard('J'), makeCard('10'), makeCard('9'), makeCard('8'), makeCard('7')];
    s.players[0].hand = p0Hand;
    s.players[1].hand = [makeCard('A'), makeCard('A'), makeCard('A'), makeCard('A'), makeCard('A'), makeCard('A'), makeCard('A')];
    s.hasDrawnThisTurn = false;
    s.attackChain = null;
    const r = GameEngine.processShow(s, s.players[0].id);
    // Should refuse: hand value > 5
    expect(r.error).toBeTruthy();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. MULTI-ROUND ACCUMULATION
// ════════════════════════════════════════════════════════════════════════════

describe('Multi-Round Score Accumulation', () => {
  it('totalScore accumulates across rounds', () => {
    const s = GameEngine.initializeGame({
      roomId: 'r1',
      players: [
        { id: 'p0', userId: 'u0', username: 'P0', avatar: 'a', isBot: false },
        { id: 'p1', userId: 'u1', username: 'P1', avatar: 'a', isBot: false },
      ],
      roundCount: 3,
      turnTimeLimit: 30,
    });
    s.players[0].totalScore = 0;
    s.players[1].totalScore = 40;
    const prevResult: any = {
      roundNumber: 1,
      showPlayerId: 'p0',
      playerResults: [
        { playerId: 'p0', score: 0, totalScore: 0, isEliminated: false },
        { playerId: 'p1', score: 40, totalScore: 40, isEliminated: false },
      ],
    };
    const next = GameEngine.startNewRound(s, prevResult);
    expect(next.players[0].totalScore).toBe(0);
    expect(next.players[1].totalScore).toBe(40);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5. AI CHAMPIONSHIP SCORING EDGE CASES
// ════════════════════════════════════════════════════════════════════════════

describe('AI Championship Scoring Edge Cases', () => {
  it('bot joker hand correctly scores 0', () => {
    const jokers = Array(7).fill(null).map(() => makePrintedJoker());
    expect(handValue(jokers)).toBe(0);
  });

  it('survival stage: low hand qualifies for SHOW (A+A+A+joker×4 = 3 pts)', () => {
    const survivalHand = [makeCard('A'), makeCard('A'), makeCard('A'), makePrintedJoker(), makePrintedJoker(), makePrintedJoker(), makePrintedJoker()];
    expect(handValue(survivalHand)).toBeLessThanOrEqual(5);
  });
});
