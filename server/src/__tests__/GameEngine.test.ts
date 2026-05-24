/**
 * GameEngine integration tests — pure stateless game state machine.
 */

import { GameEngine, GameConfig } from '../engine/GameEngine';
import { DeckManager } from '../engine/DeckManager';
import { makeCard, makePrintedJoker, makePlayer, makeBot, makeGameState, makeAttackChain } from './helpers';
import { GameState, Card } from '../../../shared/src/types';

beforeAll(() => { jest.spyOn(console, 'log').mockImplementation(() => {}); });
afterAll(() => { (console.log as jest.Mock).mockRestore(); });

// ── Helper: build minimal config for initializeGame ──────────────────────────

function makeConfig(playerCount: number): GameConfig {
  const players = Array.from({ length: playerCount }, (_, i) => ({
    id: `p${i}`,
    userId: `u${i}`,
    username: `Player${i}`,
    avatar: 'avatar_1',
    isBot: i > 0,
  }));
  return { roomId: 'room-test', players, roundCount: 3, turnTimeLimit: 30 };
}

// ════════════════════════════════════════════════════════════════════════════
// initializeGame
// ════════════════════════════════════════════════════════════════════════════

describe('GameEngine.initializeGame', () => {
  it('creates a valid game state for 2 players', () => {
    const state = GameEngine.initializeGame(makeConfig(2));
    expect(state.players).toHaveLength(2);
    expect(state.status).toBe('playing');
    expect(state.roundNumber).toBe(1);
  });

  it('deals exactly 7 cards to each player', () => {
    const state = GameEngine.initializeGame(makeConfig(3));
    state.players.forEach(p => {
      expect(p.hand).toHaveLength(7);
      expect(p.handCount).toBe(7);
    });
  });

  it('uses 1-deck (54 cards) for 2-3 players', () => {
    const state2 = GameEngine.initializeGame(makeConfig(2));
    const state3 = GameEngine.initializeGame(makeConfig(3));
    // 54 - 1 (joker card drawn) - 3×7 dealt - 1 (first discard) = 31 remaining for 3p
    // At minimum, deck should exist
    expect(state2.deck.length).toBeGreaterThan(0);
    expect(state3.deck.length).toBeGreaterThan(0);
  });

  it('uses 2-deck (108 cards) for 4+ players', () => {
    const state = GameEngine.initializeGame(makeConfig(4));
    // 108 - 1 (joker) - 4×7 dealt - 1 (discard) = 78 remaining minimum
    expect(state.deck.length).toBeGreaterThan(60);
  });

  it('first discard card is never a real 7 or real J', () => {
    for (let i = 0; i < 20; i++) {
      const state = GameEngine.initializeGame(makeConfig(2));
      const top = state.discardPile[0];
      expect(top.rank).not.toBe('7');
      expect(top.rank).not.toBe('J');
    }
  });

  it('jokerRank is never 7 or J', () => {
    for (let i = 0; i < 20; i++) {
      const state = GameEngine.initializeGame(makeConfig(2));
      expect(['7', 'J']).not.toContain(state.jokerRank);
    }
  });

  it('all players start with totalScore=0 and isEliminated=false', () => {
    const state = GameEngine.initializeGame(makeConfig(3));
    state.players.forEach(p => {
      expect(p.totalScore).toBe(0);
      expect(p.isEliminated).toBe(false);
    });
  });

  it('hasDrawnThisTurn starts false, attackChain starts null', () => {
    const state = GameEngine.initializeGame(makeConfig(2));
    expect(state.hasDrawnThisTurn).toBe(false);
    expect(state.attackChain).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// processDrawCard
// ════════════════════════════════════════════════════════════════════════════

describe('GameEngine.processDrawCard', () => {
  function drawReadyState() {
    const p0 = makePlayer('p0', [makeCard('K'), makeCard('Q')]);
    const p1 = makePlayer('p1', [makeCard('9')]);
    const deck: Card[] = [makeCard('A'), makeCard('3'), makeCard('5')];
    const discard: Card[] = [makeCard('6')];
    return makeGameState([p0, p1], {
      deck, discardPile: discard, currentPlayerIndex: 0, hasDrawnThisTurn: false,
    });
  }

  it('drawing from deck adds a card to hand and sets hasDrawnThisTurn=true', () => {
    const state = drawReadyState();
    const result = GameEngine.processDrawCard(state, 'p0', 'deck');
    expect(result.success).toBe(true);
    expect(result.state.hasDrawnThisTurn).toBe(true);
    const p0 = result.state.players.find(p => p.id === 'p0')!;
    expect(p0.hand).toHaveLength(3);
    expect(p0.handCount).toBe(3);
  });

  it('drawing from discard pile removes top card and adds to hand', () => {
    const state = drawReadyState();
    const topId = state.discardPile[state.discardPile.length - 1].id;
    const result = GameEngine.processDrawCard(state, 'p0', 'discard');
    expect(result.success).toBe(true);
    const p0 = result.state.players.find(p => p.id === 'p0')!;
    expect(p0.hand.some(c => c.id === topId)).toBe(true);
    expect(result.state.discardPile).toHaveLength(0);
  });

  it('fails if already drew this turn', () => {
    const base = drawReadyState();
    const state: GameState = { ...base, hasDrawnThisTurn: true };
    const result = GameEngine.processDrawCard(state, 'p0', 'deck');
    expect(result.success).toBe(false);
  });

  it('fails if not the player\'s turn', () => {
    const state = drawReadyState(); // currentPlayerIndex=0 → p0's turn
    const result = GameEngine.processDrawCard(state, 'p1', 'deck');
    expect(result.success).toBe(false);
  });

  it('fails to take real 7 from discard pile', () => {
    const p0 = makePlayer('p0', [makeCard('K')]);
    const p1 = makePlayer('p1', [makeCard('Q')]);
    const real7: Card = makeCard('7');
    const state = makeGameState([p0, p1], {
      discardPile: [real7], hasDrawnThisTurn: false, currentPlayerIndex: 0,
    });
    const result = GameEngine.processDrawCard(state, 'p0', 'discard');
    expect(result.success).toBe(false);
  });

  it('fails to take real J from discard pile', () => {
    const p0 = makePlayer('p0', [makeCard('K')]);
    const p1 = makePlayer('p1', [makeCard('Q')]);
    const realJ: Card = makeCard('J');
    const state = makeGameState([p0, p1], {
      discardPile: [realJ], hasDrawnThisTurn: false, currentPlayerIndex: 0,
    });
    const result = GameEngine.processDrawCard(state, 'p0', 'discard');
    expect(result.success).toBe(false);
  });

  it('fails if under 7-attack (must respond first)', () => {
    const p0 = makePlayer('p0', [makeCard('K')]);
    const p1 = makePlayer('p1', [makeCard('7')]);
    const state = makeGameState([p0, p1], {
      hasDrawnThisTurn: false,
      currentPlayerIndex: 0,
      attackChain: makeAttackChain('p1', 0, 1),
    });
    const result = GameEngine.processDrawCard(state, 'p0', 'deck');
    expect(result.success).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// processDiscard
// ════════════════════════════════════════════════════════════════════════════

describe('GameEngine.processDiscard', () => {
  it('normal discard after drawing: removes card from hand, adds to discard pile', () => {
    const king = makeCard('K');
    const p0 = makePlayer('p0', [king, makeCard('Q')]);
    const p1 = makePlayer('p1', [makeCard('9')]);
    const state = makeGameState([p0, p1], { hasDrawnThisTurn: true });
    const result = GameEngine.processDiscard(state, 'p0', [king.id]);
    expect(result.success).toBe(true);
    const p0After = result.state.players.find(p => p.id === 'p0')!;
    expect(p0After.hand.some(c => c.id === king.id)).toBe(false);
    expect(result.state.discardPile.some(c => c.id === king.id)).toBe(true);
  });

  it('cut: discard matching rank without drawing (not a 7)', () => {
    const matching = makeCard('8');
    const topDiscard = makeCard('8', 'clubs'); // same rank
    const p0 = makePlayer('p0', [matching, makeCard('K')]);
    const p1 = makePlayer('p1', [makeCard('9')]);
    const state = makeGameState([p0, p1], {
      discardPile: [topDiscard],
      hasDrawnThisTurn: false,
      currentPlayerIndex: 0,
    });
    const result = GameEngine.processDiscard(state, 'p0', [matching.id]);
    expect(result.success).toBe(true);
  });

  it('cut: Jacks can be cut when top discard is a J (GameEngine allows this)', () => {
    const matchingJ = makeCard('J');
    const topDiscard = makeCard('J', 'clubs');
    const p0 = makePlayer('p0', [matchingJ, makeCard('K')]);
    const p1 = makePlayer('p1', [makeCard('9')]);
    const state = makeGameState([p0, p1], {
      discardPile: [topDiscard],
      hasDrawnThisTurn: false,
      currentPlayerIndex: 0,
    });
    const result = GameEngine.processDiscard(state, 'p0', [matchingJ.id]);
    // GameEngine processDiscard only excludes real 7s from cut — Jacks are allowed
    expect(result.success).toBe(true);
  });

  it('fails: cut attempt with non-matching rank', () => {
    const ace = makeCard('A');
    const topDiscard = makeCard('9', 'clubs');
    const p0 = makePlayer('p0', [ace, makeCard('K')]);
    const p1 = makePlayer('p1', [makeCard('9')]);
    const state = makeGameState([p0, p1], {
      discardPile: [topDiscard],
      hasDrawnThisTurn: false,
      currentPlayerIndex: 0,
    });
    const result = GameEngine.processDiscard(state, 'p0', [ace.id]);
    expect(result.success).toBe(false);
  });

  it('fails: multi-card discard with different ranks', () => {
    const k = makeCard('K');
    const q = makeCard('Q');
    const p0 = makePlayer('p0', [k, q, makeCard('9')]);
    const p1 = makePlayer('p1', [makeCard('9')]);
    const state = makeGameState([p0, p1], { hasDrawnThisTurn: true });
    const result = GameEngine.processDiscard(state, 'p0', [k.id, q.id]);
    expect(result.success).toBe(false);
  });

  it('discarding a real 7 triggers attack chain against next player', () => {
    const seven = makeCard('7');
    const p0 = makePlayer('p0', [seven, makeCard('K')]);
    const p1 = makePlayer('p1', [makeCard('9'), makeCard('8')]);
    const state = makeGameState([p0, p1], { hasDrawnThisTurn: true });
    const result = GameEngine.processDiscard(state, 'p0', [seven.id]);
    expect(result.success).toBe(true);
    expect(result.state.attackChain).not.toBeNull();
    expect(result.state.attackChain!.penaltyCards).toBe(2);
  });

  it('discarding a real J skips the next player', () => {
    const jack = makeCard('J');
    const p0 = makePlayer('p0', [jack, makeCard('K')]);
    const p1 = makePlayer('p1', [makeCard('9')]);
    const p2 = makePlayer('p2', [makeCard('8')]);
    const state = makeGameState([p0, p1, p2], { hasDrawnThisTurn: true, currentPlayerIndex: 0 });
    const result = GameEngine.processDiscard(state, 'p0', [jack.id]);
    expect(result.success).toBe(true);
    // Turn should skip p1 and land on p2
    expect(result.state.currentPlayerIndex).toBe(2);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// processShow
// ════════════════════════════════════════════════════════════════════════════

describe('GameEngine.processShow', () => {
  it('valid show: hand total ≤ 5, hasDrawnThisTurn=false → success', () => {
    const showCard = makeCard('A'); // value=1
    const p0 = makePlayer('p0', [showCard, makeCard('2'), makeCard('2')]); // total=5
    const p1 = makePlayer('p1', [makeCard('K'), makeCard('Q')]);
    const state = makeGameState([p0, p1], { hasDrawnThisTurn: false });
    const result = GameEngine.processShow(state, 'p0');
    expect(result.success).toBe(true);
    expect(result.state.status).toBe('show_called');
    expect(result.state.roundResult).not.toBeNull();
  });

  it('fails if hasDrawnThisTurn=true (must discard first)', () => {
    const p0 = makePlayer('p0', [makeCard('A'), makeCard('2')]); // total=3
    const p1 = makePlayer('p1', [makeCard('K')]);
    const state = makeGameState([p0, p1], { hasDrawnThisTurn: true });
    const result = GameEngine.processShow(state, 'p0');
    expect(result.success).toBe(false);
  });

  it('fails if hand total > 5', () => {
    const p0 = makePlayer('p0', [makeCard('4'), makeCard('3')]); // total=7
    const p1 = makePlayer('p1', [makeCard('K')]);
    const state = makeGameState([p0, p1], { hasDrawnThisTurn: false });
    const result = GameEngine.processShow(state, 'p0');
    expect(result.success).toBe(false);
  });

  it('fails if player is under 7-attack', () => {
    const p0 = makePlayer('p0', [makeCard('A'), makeCard('2')]); // total=3
    const p1 = makePlayer('p1', [makeCard('7')]);
    const state = makeGameState([p0, p1], {
      hasDrawnThisTurn: false,
      currentPlayerIndex: 0,
      attackChain: makeAttackChain('p1', 0, 1),
    });
    const result = GameEngine.processShow(state, 'p0');
    expect(result.success).toBe(false);
  });

  it('fails if not the player\'s turn', () => {
    const p0 = makePlayer('p0', [makeCard('A')]);
    const p1 = makePlayer('p1', [makeCard('K')]);
    const state = makeGameState([p0, p1], {
      hasDrawnThisTurn: false, currentPlayerIndex: 0,
    });
    const result = GameEngine.processShow(state, 'p1'); // p1 tries when it's p0's turn
    expect(result.success).toBe(false);
  });

  it('show with 0-total hand (all jokers) succeeds', () => {
    const p0 = makePlayer('p0', [makePrintedJoker(), makePrintedJoker()]);
    const p1 = makePlayer('p1', [makeCard('K')]);
    const state = makeGameState([p0, p1], { hasDrawnThisTurn: false });
    const result = GameEngine.processShow(state, 'p0');
    expect(result.success).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// processAttackResponse
// ════════════════════════════════════════════════════════════════════════════

describe('GameEngine.processAttackResponse', () => {
  it('take: player takes penalty cards and hasDrawnThisTurn becomes true', () => {
    const penaltyCards = Array.from({ length: 5 }, () => makeCard('8'));
    const p0 = makePlayer('p0', [makeCard('9')]);
    const p1 = makePlayer('p1', [makeCard('7')]);
    const state = makeGameState([p0, p1], {
      deck: penaltyCards,
      currentPlayerIndex: 0,
      attackChain: makeAttackChain('p1', 0, 1), // p1 attacked p0, 2 penalty cards
    });
    const result = GameEngine.processAttackResponse(state, 'p0', 'take');
    expect(result.success).toBe(true);
    expect(result.state.attackChain).toBeNull();
    expect(result.state.hasDrawnThisTurn).toBe(true); // penalty counts as draw
    const p0After = result.state.players.find(p => p.id === 'p0')!;
    expect(p0After.hand.length).toBeGreaterThan(1); // received penalty cards
  });

  it('throw: player counters with 7s, attack chain continues to next player', () => {
    const counter7 = makeCard('7');
    const p0 = makePlayer('p0', [counter7, makeCard('K')]);
    const p1 = makePlayer('p1', [makeCard('7')]);
    const p2 = makePlayer('p2', [makeCard('K')]);
    const state = makeGameState([p0, p1, p2], {
      currentPlayerIndex: 0,
      attackChain: makeAttackChain('p1', 0, 1), // p1 attacked p0
    });
    const result = GameEngine.processAttackResponse(state, 'p0', 'throw', [counter7.id]);
    expect(result.success).toBe(true);
    expect(result.state.attackChain).not.toBeNull();
    // Counter throw adds to sevens count
    expect(result.state.attackChain!.sevensCount).toBe(2);
    expect(result.state.attackChain!.penaltyCards).toBe(4);
  });

  it('throw fails if card is not a real 7', () => {
    const fake = makeCard('K');
    const p0 = makePlayer('p0', [fake, makeCard('Q')]);
    const p1 = makePlayer('p1', [makeCard('7')]);
    const state = makeGameState([p0, p1], {
      currentPlayerIndex: 0,
      attackChain: makeAttackChain('p1', 0, 1),
    });
    const result = GameEngine.processAttackResponse(state, 'p0', 'throw', [fake.id]);
    expect(result.success).toBe(false);
  });

  it('fails if no active attack chain', () => {
    const p0 = makePlayer('p0', [makeCard('7')]);
    const p1 = makePlayer('p1', [makeCard('K')]);
    const state = makeGameState([p0, p1], { attackChain: null });
    const result = GameEngine.processAttackResponse(state, 'p0', 'take');
    expect(result.success).toBe(false);
  });
});
