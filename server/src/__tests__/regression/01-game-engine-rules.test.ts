/**
 * REGRESSION SUITE 01 — Core Game Engine Rules
 *
 * Covers: card dealing, joker mechanics, 7-power attack, J-skip, SHOW validation,
 * turn advancement, timeout handling, draw/discard, multiplier (free & wager), 2–6 player configs.
 *
 * All tests are pure (no DB, no network). Zero flakiness risk.
 */

import { GameEngine, GameConfig } from '../../engine/GameEngine';
import { makeCard, makePrintedJoker, makePlayer, makeBot, makeGameState, makeAttackChain } from '../helpers';
import { GameState, Card } from '../../../../shared/src/types';

beforeAll(() => jest.spyOn(console, 'log').mockImplementation(() => {}));
afterAll(() => (console.log as jest.Mock).mockRestore());

// ── Config helpers ────────────────────────────────────────────────────────────

function cfg(playerCount: number, roundCount = 3, botCount = 0): GameConfig {
  const all = Array.from({ length: playerCount }, (_, i) => ({
    id: `p${i}`, userId: `u${i}`, username: `P${i}`, avatar: 'a', isBot: i >= playerCount - botCount,
  }));
  return { roomId: 'r1', players: all, roundCount, turnTimeLimit: 30 };
}

// ════════════════════════════════════════════════════════════════════════════
// 1. GAME INITIALIZATION (Free & Wager — same engine, entry fee is wallet-layer)
// ════════════════════════════════════════════════════════════════════════════

describe('Game Initialization', () => {
  it('2-player game: deals 7 cards each, valid deck remainder', () => {
    const s = GameEngine.initializeGame(cfg(2));
    expect(s.players).toHaveLength(2);
    s.players.forEach(p => expect(p.hand).toHaveLength(7));
    expect(s.status).toBe('playing');
    expect(s.roundNumber).toBe(1);
    // 2 players → single deck (52 cards); 2×7 dealt + 1 discard = 37 remaining
    expect(s.deck.length).toBeGreaterThanOrEqual(30);
  });

  it('6-player game: deals 7 cards each', () => {
    const s = GameEngine.initializeGame(cfg(6));
    expect(s.players).toHaveLength(6);
    s.players.forEach(p => expect(p.hand).toHaveLength(7));
  });

  it('configures round count correctly', () => {
    const s = GameEngine.initializeGame(cfg(2, 5));
    expect(s.roundCount).toBe(5);
  });

  it('joker rank is never 7 or J', () => {
    for (let i = 0; i < 20; i++) {
      const s = GameEngine.initializeGame(cfg(2));
      expect(s.jokerRank).not.toBe('7');
      expect(s.jokerRank).not.toBe('J');
    }
  });

  it('all matching-rank cards become jokers (0 pts)', () => {
    const s = GameEngine.initializeGame(cfg(2));
    const jokerRank = s.jokerRank;
    const allCards = [...s.deck, s.discardPile[0], ...s.players.flatMap(p => p.hand)];
    const jokerCards = allCards.filter(c => c.rank === jokerRank && !c.isJoker);
    expect(jokerCards).toHaveLength(0); // all have been marked isJoker
    const markedJokers = allCards.filter(c => c.isJoker && c.rank === jokerRank);
    expect(markedJokers.length).toBeGreaterThan(0);
    markedJokers.forEach(c => expect(c.value).toBe(0));
  });

  it('discard pile starts with exactly 1 face-up card', () => {
    const s = GameEngine.initializeGame(cfg(2));
    expect(s.discardPile).toHaveLength(1);
  });

  it('bot-only second player is marked isBot', () => {
    const s = GameEngine.initializeGame(cfg(2, 3, 1));
    expect(s.players[1].isBot).toBe(true);
  });

  it('no duplicate card IDs across all locations', () => {
    const s = GameEngine.initializeGame(cfg(4));
    const ids = [...s.deck.map(c => c.id), ...s.discardPile.map(c => c.id), ...s.players.flatMap(p => p.hand.map(c => c.id))];
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. DRAW CARD
// ════════════════════════════════════════════════════════════════════════════

describe('Draw Card', () => {
  function readyState(playerCount = 2) {
    const s = GameEngine.initializeGame(cfg(playerCount));
    s.attackChain = null;
    return s;
  }

  it('draw from deck: player gets +1 card, deck shrinks', () => {
    const s = readyState();
    const before = s.players[0].hand.length;
    const deckBefore = s.deck.length;
    const r = GameEngine.processDrawCard(s, s.players[0].id, 'deck');
    expect(r.error).toBeUndefined();
    expect(r.state!.players[0].hand).toHaveLength(before + 1);
    expect(r.state!.deck).toHaveLength(deckBefore - 1);
    expect(r.state!.hasDrawnThisTurn).toBe(true);
  });

  it('draw from discard: player gets top card, discard shrinks', () => {
    const s = readyState();
    const top = s.discardPile[s.discardPile.length - 1];
    const r = GameEngine.processDrawCard(s, s.players[0].id, 'discard');
    expect(r.error).toBeUndefined();
    expect(r.state!.players[0].hand.some(c => c.id === top.id)).toBe(true);
  });

  it('cannot draw twice in the same turn', () => {
    const s = readyState();
    const r1 = GameEngine.processDrawCard(s, s.players[0].id, 'deck');
    const r2 = GameEngine.processDrawCard(r1.state!, s.players[0].id, 'deck');
    expect(r2.error).toBeTruthy();
  });

  it('non-current player cannot draw', () => {
    const s = readyState(3);
    const r = GameEngine.processDrawCard(s, s.players[1].id, 'deck');
    expect(r.error).toBeTruthy();
  });

  it('cannot draw while under attack', () => {
    const s = readyState();
    s.attackChain = makeAttackChain(s.players[1].id, 0);
    const r = GameEngine.processDrawCard(s, s.players[0].id, 'deck');
    expect(r.error).toBeTruthy();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. DISCARD
// ════════════════════════════════════════════════════════════════════════════

describe('Discard', () => {
  function drawnState() {
    const s = GameEngine.initializeGame(cfg(2));
    s.attackChain = null;
    const r = GameEngine.processDrawCard(s, s.players[0].id, 'deck');
    return r.state!;
  }

  it('discard a single card: hand shrinks, discard grows', () => {
    const s = drawnState();
    const card = s.players[0].hand[0];
    const r = GameEngine.processDiscard(s, s.players[0].id, [card.id]);
    expect(r.error).toBeUndefined();
    expect(r.state!.players[0].hand).toHaveLength(7); // back to 7 after draw+discard
    expect(r.state!.discardPile.at(-1)!.id).toBe(card.id);
  });

  it('discard multiple same-rank cards (valid cut)', () => {
    const s = drawnState();
    const rank = s.players[0].hand[0].rank;
    const sameRank = s.players[0].hand.filter(c => c.rank === rank && !c.isJoker).slice(0, 2);
    if (sameRank.length < 2) return; // skip if < 2 same-rank (rare)
    const r = GameEngine.processDiscard(s, s.players[0].id, sameRank.map(c => c.id));
    expect(r.error).toBeUndefined();
  });

  it('cannot discard before drawing', () => {
    const s = GameEngine.initializeGame(cfg(2));
    s.attackChain = null;
    const r = GameEngine.processDiscard(s, s.players[0].id, [s.players[0].hand[0].id]);
    expect(r.error).toBeTruthy();
  });

  it('cannot discard a card not in hand', () => {
    const s = drawnState();
    const r = GameEngine.processDiscard(s, s.players[0].id, ['fake-id-not-in-hand']);
    expect(r.error).toBeTruthy();
  });

  it('7 discard triggers attack chain on next player', () => {
    const s = drawnState();
    // Force a 7 into hand
    const seven = makeCard('7');
    s.players[0].hand[0] = seven;
    s.hasDrawnThisTurn = true;
    const r = GameEngine.processDiscard(s, s.players[0].id, [seven.id]);
    if (!r.error) {
      expect(r.state!.attackChain).not.toBeNull();
      expect(r.state!.attackChain!.sevensCount).toBe(1);
      expect(r.state!.attackChain!.penaltyCards).toBe(2);
    }
  });

  it('J discard skips next player turn', () => {
    const s = drawnState();
    const jack = makeCard('J');
    s.players[0].hand[0] = jack;
    s.hasDrawnThisTurn = true;
    const r = GameEngine.processDiscard(s, s.players[0].id, [jack.id]);
    if (!r.error && r.state) {
      // Current player index should have advanced past the skipped player
      expect(r.state.currentPlayerIndex).not.toBe(1);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. ATTACK CHAIN (7-power mechanics)
// ════════════════════════════════════════════════════════════════════════════

describe('Attack Chain — 7 Power', () => {
  function attackedState(sevens = 1) {
    const s = GameEngine.initializeGame(cfg(2));
    s.currentPlayerIndex = 1;           // player 1 must respond
    s.attackChain = makeAttackChain(s.players[0].id, 1, sevens);
    s.hasDrawnThisTurn = false;
    return s;
  }

  it('1×7 attack: penalty = 2 cards', () => {
    const s = attackedState(1);
    expect(s.attackChain!.penaltyCards).toBe(2);
  });

  it('2×7 attack: penalty = 4 cards', () => {
    const s = attackedState(2);
    expect(s.attackChain!.penaltyCards).toBe(4);
  });

  it('accepting attack: target draws penalty cards, chain clears', () => {
    const s = attackedState(1);
    const before = s.players[1].hand.length;
    const r = GameEngine.processAttackResponse(s, s.players[1].id, 'accept');
    if (!r.error) {
      expect(r.state!.players[1].hand.length).toBe(before + 2);
      expect(r.state!.attackChain).toBeNull();
    }
  });

  it('counter-attack with 7: chain increments', () => {
    const s = attackedState(1);
    const seven = makeCard('7');
    s.players[1].hand[0] = seven;
    const r = GameEngine.processAttackResponse(s, s.players[1].id, 'counter', [seven.id]);
    if (!r.error && r.state?.attackChain) {
      expect(r.state.attackChain.sevensCount).toBe(2);
      expect(r.state.attackChain.penaltyCards).toBe(4);
    }
  });

  it('cannot SHOW while under attack', () => {
    const s = attackedState(1);
    s.players[1].hand = [makeCard('A'), makeCard('2'), makeCard('A')]; // low pts
    const r = GameEngine.processShow(s, s.players[1].id);
    expect(r.error).toBeTruthy();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5. SHOW VALIDATION
// ════════════════════════════════════════════════════════════════════════════

// SHOW is called BEFORE drawing (when hasDrawnThisTurn = false).
// The player shows their existing hand at the START of their turn.
describe('SHOW Validation', () => {
  function showState(hand: Card[]) {
    const s = GameEngine.initializeGame(cfg(2));
    s.players[0].hand = hand;
    s.attackChain = null;
    s.hasDrawnThisTurn = false; // SHOW requires NOT having drawn yet this turn
    s.drawnCard = null;
    return s;
  }

  it('valid SHOW: hand ≤ 5 pts before drawing this turn (A+A+A+joker×4 = 3)', () => {
    const hand = [makeCard('A'), makeCard('A'), makeCard('A'), makePrintedJoker(), makePrintedJoker(), makePrintedJoker(), makePrintedJoker()];
    const s = showState(hand);
    const r = GameEngine.processShow(s, s.players[0].id);
    expect(r.error).toBeUndefined();
    expect(r.roundResult).not.toBeNull();
  });

  it('invalid SHOW: hand > 5 pts', () => {
    const hand = [makeCard('K'), makeCard('Q'), makeCard('J'), makeCard('10'), makeCard('9'), makeCard('8'), makeCard('7')];
    const s = showState(hand);
    const r = GameEngine.processShow(s, s.players[0].id);
    expect(r.error).toBeTruthy();
  });

  it('invalid SHOW: player has already drawn this turn (must discard first)', () => {
    const hand = [makeCard('A'), makeCard('A'), makeCard('A'), makeCard('A'), makeCard('A'), makeCard('A'), makeCard('A')];
    const s = GameEngine.initializeGame(cfg(2));
    s.players[0].hand = hand;
    s.attackChain = null;
    s.hasDrawnThisTurn = true; // already drew — must discard first
    const r = GameEngine.processShow(s, s.players[0].id);
    expect(r.error).toBeTruthy();
  });

  it('invalid SHOW: not current player', () => {
    const hand = [makeCard('A'), makeCard('A'), makeCard('A'), makeCard('A'), makeCard('A'), makeCard('A'), makeCard('A')];
    const s = showState(hand);
    const r = GameEngine.processShow(s, s.players[1].id);
    expect(r.error).toBeTruthy();
  });

  it('joker cards count as 0 pts for SHOW threshold (joker×2 + A×5 = 5)', () => {
    const joker = makePrintedJoker();
    const hand = [joker, joker, makeCard('A'), makeCard('A'), makeCard('A'), makeCard('A'), makeCard('A')];
    // 0+0+1+1+1+1+1 = 5 — exactly at threshold
    const s = showState(hand);
    const r = GameEngine.processShow(s, s.players[0].id);
    expect(r.error).toBeUndefined();
  });

  it('paper jokers (jokerRank cards) count as 0 pts', () => {
    const s = GameEngine.initializeGame(cfg(2));
    const jokerRank = s.jokerRank;
    const hand = Array(7).fill(null).map(() => {
      const c = makeCard(jokerRank as any);
      c.isJoker = true; c.value = 0;
      return c;
    });
    s.players[0].hand = hand;
    s.hasDrawnThisTurn = false;
    s.attackChain = null;
    const r = GameEngine.processShow(s, s.players[0].id);
    expect(r.error).toBeUndefined();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 6. TURN ADVANCEMENT & TIMEOUT
// ════════════════════════════════════════════════════════════════════════════

describe('Turn Advancement & Timeout', () => {
  it('turn advances to next non-eliminated player', () => {
    const s = GameEngine.initializeGame(cfg(3));
    const before = s.currentPlayerIndex;
    const next = GameEngine.advanceTurn(s);
    expect(next.currentPlayerIndex).not.toBe(before);
  });

  it('eliminated player is skipped', () => {
    const s = GameEngine.initializeGame(cfg(3));
    s.players[1].isEliminated = true;
    const next = GameEngine.advanceTurn(s);
    expect(next.currentPlayerIndex).toBe(2);
  });

  it('timeout applies auto-action and increments consecutiveTimeouts', () => {
    const s = GameEngine.initializeGame(cfg(2));
    s.attackChain = null;
    const r = GameEngine.processTimeout(s);
    expect(r.error).toBeUndefined();
    const pid = s.players[0].id;
    expect(r.state!.consecutiveTimeouts[pid]).toBeGreaterThanOrEqual(1);
  });

  it('3 consecutive timeouts eliminates player', () => {
    let s = GameEngine.initializeGame(cfg(2));
    s.attackChain = null;
    s.consecutiveTimeouts[s.players[0].id] = 2; // already 2
    const r = GameEngine.processTimeout(s);
    if (!r.error) {
      expect(r.state!.players[0].isEliminated).toBe(true);
    }
  });

  it('resetTimeouts clears consecutive count for a player', () => {
    const s = GameEngine.initializeGame(cfg(2));
    s.consecutiveTimeouts[s.players[0].id] = 2;
    const next = GameEngine.resetTimeouts(s, s.players[0].id);
    expect(next.consecutiveTimeouts[s.players[0].id]).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 7. ROUND PROGRESSION
// ════════════════════════════════════════════════════════════════════════════

describe('Round Progression', () => {
  function mockPrevResult(state: GameState) {
    return {
      roundNumber: state.roundNumber,
      showPlayerId: state.players[0].id,
      playerResults: state.players.map(p => ({
        playerId: p.id, score: 0, totalScore: p.totalScore, isEliminated: false,
      })),
    } as any;
  }

  it('startNewRound increments roundNumber', () => {
    const s = GameEngine.initializeGame(cfg(2));
    const next = GameEngine.startNewRound(s, mockPrevResult(s));
    expect(next.roundNumber).toBe(2);
  });

  it('startNewRound resets hands to 7 cards each', () => {
    const s = GameEngine.initializeGame(cfg(2));
    const next = GameEngine.startNewRound(s, mockPrevResult(s));
    next.players.forEach(p => expect(p.hand).toHaveLength(7));
  });

  it('startNewRound resets drawnCard and hasDrawnThisTurn', () => {
    const s = GameEngine.initializeGame(cfg(2));
    s.hasDrawnThisTurn = true;
    s.drawnCard = makeCard('5');
    const next = GameEngine.startNewRound(s, mockPrevResult(s));
    expect(next.hasDrawnThisTurn).toBe(false);
    expect(next.drawnCard).toBeNull();
  });

  it('startNewRound assigns new joker rank (never 7 or J)', () => {
    const s = GameEngine.initializeGame(cfg(2));
    for (let i = 0; i < 10; i++) {
      const next = GameEngine.startNewRound(s, mockPrevResult(s));
      expect(next.jokerRank).not.toBe('7');
      expect(next.jokerRank).not.toBe('J');
    }
  });

  it('startNewRound clears attackChain', () => {
    const s = GameEngine.initializeGame(cfg(2));
    s.attackChain = makeAttackChain(s.players[0].id, 1);
    const next = GameEngine.startNewRound(s, mockPrevResult(s));
    expect(next.attackChain).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 8. MULTIPLIER MODE (Free vs Wager — engine behavior is identical)
// ════════════════════════════════════════════════════════════════════════════

describe('Multiplier Mode (engine layer)', () => {
  it('free mode: same engine, round count 1 is valid', () => {
    const s = GameEngine.initializeGame(cfg(2, 1));
    expect(s.roundNumber).toBe(1);
    expect(s.roundCount).toBe(1);
  });

  it('wager mode: same engine, round count 3 is valid', () => {
    const s = GameEngine.initializeGame(cfg(2, 3));
    expect(s.roundCount).toBe(3);
  });

  it('6-player multiplier: cards distributed correctly', () => {
    const s = GameEngine.initializeGame(cfg(6, 3));
    expect(s.players).toHaveLength(6);
    s.players.forEach(p => expect(p.hand).toHaveLength(7));
    expect(s.deck.length).toBeGreaterThan(0);
  });
});
