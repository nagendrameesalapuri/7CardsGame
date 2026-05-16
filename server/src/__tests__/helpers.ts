/**
 * Shared test factory functions for game engine unit tests.
 */
import { Card, GameState, PlayerState, Rank, Suit, AttackChain } from '../../../shared/src/types';
import { OpponentProfile } from '../engine/BotPlayer';

let idCounter = 0;
const uid = () => `t${++idCounter}`;

export function makeCard(
  rank: Rank,
  suit: Suit = 'hearts',
  opts: { isJoker?: boolean; value?: number } = {},
): Card {
  const BASE: Record<string, number> = {
    A: 1, '2': 2, '3': 3, '4': 4, '5': 5,
    '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
    J: 10, Q: 10, K: 10, Joker: 0,
  };
  const isJoker = opts.isJoker ?? false;
  return {
    id: `${suit[0]}${rank}-${uid()}`,
    suit,
    rank,
    value: isJoker ? 0 : (opts.value ?? BASE[rank] ?? 0),
    isJoker,
  };
}

/** Printed joker (rank='Joker', isJoker=true, value=0). */
export function makePrintedJoker(): Card {
  return { id: `pj-${uid()}`, suit: 'none', rank: 'Joker', value: 0, isJoker: true };
}

/** Paper joker — a normal rank card that is the joker rank (isJoker=true). */
export function makePaperJoker(rank: Rank, suit: Suit = 'hearts'): Card {
  return { id: `pj${rank}-${uid()}`, suit, rank, value: 0, isJoker: true };
}

export function makePlayer(
  id: string,
  hand: Card[],
  opts: Partial<PlayerState> = {},
): PlayerState {
  return {
    id,
    userId: `user_${id}`,
    username: `Player_${id}`,
    avatar: 'avatar_1',
    hand,
    handCount: hand.length,
    totalScore: 0,
    roundScore: null,
    isConnected: true,
    isEliminated: false,
    seatIndex: 0,
    isBot: false,
    isReady: true,
    ...opts,
  };
}

export function makeBot(
  id: string,
  hand: Card[],
  opts: Partial<PlayerState> = {},
): PlayerState {
  return makePlayer(id, hand, { ...opts, isBot: true });
}

export function makeGameState(
  players: PlayerState[],
  opts: Partial<GameState> = {},
): GameState {
  const topDiscard = makeCard('5');
  return {
    id: 'game-test',
    roomId: 'room-test',
    status: 'playing',
    players,
    deck: Array.from({ length: 20 }, () => makeCard('8')),
    discardPile: [topDiscard],
    jokerRank: 'Q',
    jokerCard: makeCard('Q'),
    currentPlayerIndex: 0,
    turnNumber: 1,
    turnStartTime: new Date().toISOString(),
    turnTimeLimit: 30,
    attackChain: null,
    roundCount: 3,
    roundNumber: 1,
    drawnCard: null,
    hasDrawnThisTurn: false,
    showPlayerId: null,
    roundResult: null,
    chatMessages: [],
    consecutiveTimeouts: {},
    ...opts,
  };
}

export function makeAttackChain(
  sourcePlayerId: string,
  targetPlayerIndex: number,
  sevensCount = 1,
): AttackChain {
  return {
    sourcePlayerId,
    targetPlayerIndex,
    sevensCount,
    penaltyCards: sevensCount * 2,
  };
}

export function makeOpponent(
  userId: string,
  opts: Partial<OpponentProfile> = {},
): OpponentProfile {
  return {
    userId,
    handCount: 7,
    recentDraws: 0,
    recentCuts: 0,
    recentShows: 0,
    recentAttackThrows: 0,
    recentAttackTakes: 0,
    handCountHistory: [7, 7, 7],
    ...opts,
  };
}

/** Suppress console output during tests that exercise fallback/error paths. */
export function silenceConsole(): void {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
}

/** Restore console after silencing. */
export function restoreConsole(): void {
  (console.log as jest.Mock).mockRestore?.();
  (console.warn as jest.Mock).mockRestore?.();
  (console.error as jest.Mock).mockRestore?.();
}
