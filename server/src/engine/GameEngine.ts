/**
 * GameEngine — pure stateless functions that transform GameState.
 *
 * Every method takes a state + parameters and returns { success, state, actions }.
 * No I/O, no side effects — makes it easy to test and replay.
 */

import {
  GameState, PlayerState, Card, Rank, AttackChain,
  GameAction, DrawSource, GameStatus,
} from '../../../shared/src/types';
import { DeckManager } from './DeckManager';
import { ScoreEngine } from './ScoreEngine';
import { v4 as uuidv4 } from 'uuid';

export interface GameConfig {
  roomId: string;
  players: Array<{
    id: string;
    userId: string;
    username: string;
    avatar: string;
    isBot: boolean;
  }>;
  roundCount: number;
  turnTimeLimit: number; // seconds
}

export interface ActionResult {
  success: boolean;
  error?: string;
  state: GameState;
  actions: GameAction[];
}

// ─────────────────────────────────────────────────────────────────────────────

export class GameEngine {

  // ── Game Setup ─────────────────────────────────────────────────────────────

  static initializeGame(config: GameConfig): GameState {
    let deck = DeckManager.createDeck();
    deck = DeckManager.shuffleDeck(deck);

    const { jokerRank, jokerCard, remainingDeck } = DeckManager.selectJoker(deck);
    const markedDeck = DeckManager.applyJoker(remainingDeck, jokerRank);

    const { hands, remainingDeck: deckAfterDeal } = DeckManager.dealCards(markedDeck, config.players.length);

    const players: PlayerState[] = config.players.map((p, i) => ({
      id: p.id,
      userId: p.userId,
      username: p.username,
      avatar: p.avatar,
      hand: DeckManager.applyJoker(hands[i], jokerRank),
      handCount: 7,
      totalScore: 0,
      roundScore: null,
      isConnected: true,
      isEliminated: false,
      seatIndex: i,
      isBot: p.isBot,
      isReady: true,
    }));

    // First card of remaining deck becomes the open/discard pile seed
    const d = [...deckAfterDeal];
    const firstDiscard = d.shift()!;

    return {
      id: uuidv4(),
      roomId: config.roomId,
      status: 'playing',
      players,
      deck: d,
      discardPile: [firstDiscard],
      jokerRank,
      jokerCard,
      currentPlayerIndex: 0,
      turnNumber: 0,
      turnStartTime: new Date().toISOString(),
      turnTimeLimit: config.turnTimeLimit,
      attackChain: null,
      roundCount: config.roundCount,
      roundNumber: 1,
      drawnCard: null,
      hasDrawnThisTurn: false,
      showPlayerId: null,
      roundResult: null,
      chatMessages: [],
      consecutiveTimeouts: {},
    };
  }

  // ── Draw Card ───────────────────────────────────────────────────────────────

  /**
   * Player draws one card from the closed deck or the top of the discard pile.
   * Cannot draw if:
   *  - not their turn
   *  - already drawn this turn
   *  - under an active 7 attack (must respond first)
   */
  static processDrawCard(
    state: GameState,
    playerId: string,
    source: DrawSource,
  ): ActionResult {
    const err = GameEngine.validateTurn(state, playerId);
    if (err) return fail(err, state);

    if (state.hasDrawnThisTurn) return fail('Already drew this turn', state);
    if (state.status !== 'playing') return fail('Game not in playing state', state);

    // If this player is the attack target they cannot draw normally
    if (state.attackChain?.targetPlayerIndex === state.currentPlayerIndex) {
      return fail('You must respond to the 7 attack first', state);
    }

    let s = { ...state };
    let drawnCard: Card;

    if (source === 'deck') {
      s = GameEngine.refillDeckIfNeeded(s);
      if (s.deck.length === 0) return fail('Deck is empty', state);
      drawnCard = s.deck[0];
      s = { ...s, deck: s.deck.slice(1) };
    } else {
      if (s.discardPile.length === 0) return fail('Discard pile is empty', state);
      const topCard = s.discardPile[s.discardPile.length - 1];
      // 7 and J (real, not joker) cannot be picked from the discard pile
      if (!topCard.isJoker && (topCard.rank === '7' || topCard.rank === 'J')) {
        return fail(`Cannot take ${topCard.rank} from the discard pile — draw from the deck instead`, state);
      }
      drawnCard = topCard;
      s = { ...s, discardPile: s.discardPile.slice(0, -1) };
    }

    const player = s.players.find(p => p.id === playerId)!;
    s = updatePlayer(s, playerId, {
      hand: [...player.hand, drawnCard],
      handCount: player.handCount + 1,
    });
    s = { ...s, drawnCard, hasDrawnThisTurn: true };

    const actions: GameAction[] = [{
      type: 'draw',
      playerId,
      source,
      cards: [drawnCard],
      message: `${player.username} drew from ${source === 'deck' ? 'the deck' : 'discard pile'}`,
      timestamp: new Date().toISOString(),
    }];

    return { success: true, state: s, actions };
  }

  // ── Discard ─────────────────────────────────────────────────────────────────

  /**
   * Player discards one card (or two Js together for double-skip).
   * Power card effects:
   *   J  → skip next player(s); 1 J = 1 skip, 2 Js = 2 skips
   *   7  → attack next player; each extra 7 in the chain adds 2 penalty cards
   */
  static processDiscard(
    state: GameState,
    playerId: string,
    cardIds: string[],
  ): ActionResult {
    const err = GameEngine.validateTurn(state, playerId);
    if (err) return fail(err, state);

    if (cardIds.length === 0) return fail('Select at least one card to discard', state);

    const player = state.players.find(p => p.id === playerId)!;
    const cardsToDiscard = player.hand.filter(c => cardIds.includes(c.id));

    if (cardsToDiscard.length !== cardIds.length) return fail('Invalid card selection', state);

    // Multi-card discard: all cards must share the same rank
    if (cardIds.length > 1) {
      const firstRank = cardsToDiscard[0].rank;
      if (!cardsToDiscard.every(c => c.rank === firstRank)) {
        return fail('You can only discard multiple cards of the same rank (e.g. two 10s)', state);
      }
    }

    const isRealSeven = (c: Card) => c.rank === '7' && !c.isJoker;

    if (!state.hasDrawnThisTurn) {
      // Cut rule: if every card being discarded matches the rank of the top discard,
      // and none of them are real 7s (attack cards), allow discarding without drawing.
      const top = state.discardPile[state.discardPile.length - 1];
      const isCut = top &&
        !isRealSeven(top) &&
        cardsToDiscard.every(c => c.rank === top.rank && !isRealSeven(c));
      if (!isCut) return fail('Draw a card first — or cut with a card matching the discard pile', state);
    }

    const newHand = player.hand.filter(c => !cardIds.includes(c.id));
    let s: GameState = {
      ...state,
      players: state.players.map(p =>
        p.id === playerId ? { ...p, hand: newHand, handCount: newHand.length } : p
      ),
      discardPile: [...state.discardPile, ...cardsToDiscard],
      hasDrawnThisTurn: false,
      drawnCard: null,
    };

    const actions: GameAction[] = [{
      type: 'discard',
      playerId,
      cards: cardsToDiscard,
      message: `${player.username} discarded ${cardsToDiscard.map(c => `${c.rank}${DeckManager.suitSymbol(c.suit)}`).join(', ')}`,
      timestamp: new Date().toISOString(),
    }];

    // Joker versions of 7 and J lose their power
    const realSevens = cardsToDiscard.filter(c => c.rank === '7' && !c.isJoker);
    const realJacks = cardsToDiscard.filter(c => c.rank === 'J' && !c.isJoker);

    if (realSevens.length > 0) {
      s = GameEngine.startSevenAttack(s, playerId, realSevens.length, actions);
    } else if (realJacks.length > 0) {
      s = GameEngine.applyJSkip(s, playerId, realJacks.length, actions);
    } else {
      s = GameEngine.advanceTurn(s);
    }

    return { success: true, state: s, actions };
  }

  // ── Respond to 7 Attack ────────────────────────────────────────────────────

  /**
   * The player currently targeted by a 7 attack must either:
   *   'throw' — play their own 7(s) to continue the chain
   *   'take'  — draw the penalty cards and end the chain
   */
  static processAttackResponse(
    state: GameState,
    playerId: string,
    action: 'throw' | 'take',
    cardIds?: string[],
  ): ActionResult {
    if (!state.attackChain) return fail('No active attack', state);

    const err = GameEngine.validateTurn(state, playerId);
    if (err) return fail(err, state);

    if (state.attackChain.targetPlayerIndex !== state.currentPlayerIndex) {
      return fail('You are not the current attack target', state);
    }

    const player = state.players.find(p => p.id === playerId)!;
    const actions: GameAction[] = [];
    let s = { ...state };

    if (action === 'throw') {
      if (!cardIds?.length) return fail('Specify 7 cards to throw', state);

      const cardsToThrow = player.hand.filter(c => cardIds.includes(c.id));
      const validSevens = cardsToThrow.filter(c => c.rank === '7' && !c.isJoker);

      if (validSevens.length !== cardIds.length || validSevens.length === 0) {
        return fail('Only real 7 cards can be thrown to counter an attack', state);
      }

      const newHand = player.hand.filter(c => !cardIds.includes(c.id));
      const newSevenCount = state.attackChain.sevensCount + validSevens.length;
      const nextTarget = GameEngine.nextActiveIndex(s, s.currentPlayerIndex, 1);

      s = {
        ...s,
        players: s.players.map(p =>
          p.id === playerId ? { ...p, hand: newHand, handCount: newHand.length } : p
        ),
        discardPile: [...s.discardPile, ...validSevens],
        attackChain: {
          sourcePlayerId: playerId,
          targetPlayerIndex: nextTarget,
          sevensCount: newSevenCount,
          penaltyCards: newSevenCount * 2,
        },
        currentPlayerIndex: nextTarget,
        turnStartTime: new Date().toISOString(),
        hasDrawnThisTurn: false,
      };

      actions.push({
        type: 'attack',
        playerId,
        cards: validSevens,
        targetPlayerIds: [s.players[nextTarget].id],
        message: `${player.username} counters with ${validSevens.length} seven(s)! Penalty is now ${newSevenCount * 2} cards!`,
        timestamp: new Date().toISOString(),
      });

    } else {
      // Take penalty cards
      const penaltyCount = state.attackChain.penaltyCards;
      const penaltyCards: Card[] = [];

      s = GameEngine.refillDeckIfNeeded(s);
      const d = [...s.deck];
      for (let i = 0; i < penaltyCount; i++) {
        if (d.length === 0) break;
        penaltyCards.push(d.shift()!);
      }

      const newHand = [...player.hand, ...penaltyCards];
      s = {
        ...s,
        players: s.players.map(p =>
          p.id === playerId ? { ...p, hand: newHand, handCount: newHand.length } : p
        ),
        deck: d,
        attackChain: null,
        hasDrawnThisTurn: true, // Penalty counts as drawing — player must now discard before turn ends
      };

      actions.push({
        type: 'penalty',
        playerId,
        penaltyCount,
        cards: penaltyCards,
        message: `${player.username} takes ${penaltyCount} penalty card(s) — must now discard a card`,
        timestamp: new Date().toISOString(),
      });
    }

    return { success: true, state: s, actions };
  }

  // ── SHOW ────────────────────────────────────────────────────────────────────

  /**
   * Player declares SHOW.
   * Rules:
   *  - Must have drawn a card this turn
   *  - Total hand points must be ≤ 5
   *  - Cannot SHOW while under a 7 attack
   */
  static processShow(state: GameState, playerId: string): ActionResult {
    const err = GameEngine.validateTurn(state, playerId);
    if (err) return fail(err, state);

    if (state.attackChain?.targetPlayerIndex === state.currentPlayerIndex) {
      return fail('Cannot SHOW while under a 7 attack', state);
    }

    const player = state.players.find(p => p.id === playerId)!;
    const handTotal = DeckManager.calculateHandTotal(player.hand);

    if (handTotal > 5) {
      return fail(`Your hand total is ${handTotal} — must be 5 or less to SHOW`, state);
    }

    const roundResult = ScoreEngine.calculateRoundResult(state, playerId);

    const s: GameState = {
      ...state,
      status: 'show_called',
      showPlayerId: playerId,
      roundResult,
    };

    const actions: GameAction[] = [{
      type: 'show',
      playerId,
      message: `${player.username} calls SHOW! Hand total: ${handTotal}`,
      timestamp: new Date().toISOString(),
    }];

    return { success: true, state: s, actions };
  }

  // ── New Round ───────────────────────────────────────────────────────────────

  static startNewRound(state: GameState, previousResult: NonNullable<GameState['roundResult']>): GameState {
    const updatedPlayers = state.players.map(p => {
      const r = previousResult.playerResults.find(pr => pr.playerId === p.id);
      return r
        ? { ...p, totalScore: r.totalScore, roundScore: null, hand: [], handCount: 0 }
        : p;
    });

    const active = updatedPlayers.filter(p => !p.isEliminated);
    if (active.length <= 1) return { ...state, status: 'match_end', players: updatedPlayers };

    let deck = DeckManager.createDeck();
    deck = DeckManager.shuffleDeck(deck);
    const { jokerRank, jokerCard, remainingDeck } = DeckManager.selectJoker(deck);
    const markedDeck = DeckManager.applyJoker(remainingDeck, jokerRank);
    const { hands, remainingDeck: deckAfterDeal } = DeckManager.dealCards(markedDeck, active.length);

    let activeIndex = 0;
    const newPlayers = updatedPlayers.map(p => {
      if (p.isEliminated) return p;
      const hand = DeckManager.applyJoker(hands[activeIndex++], jokerRank);
      return { ...p, hand, handCount: 7, roundScore: null };
    });

    const d = [...deckAfterDeal];
    const firstDiscard = d.shift()!;
    const winnerSeat = newPlayers.findIndex(p => p.id === previousResult.winnerId);
    const startIndex = winnerSeat >= 0 ? winnerSeat : 0;

    return {
      ...state,
      status: 'playing',
      players: newPlayers,
      deck: d,
      discardPile: [firstDiscard],
      jokerRank,
      jokerCard,
      currentPlayerIndex: startIndex,
      turnNumber: 0,
      turnStartTime: new Date().toISOString(),
      attackChain: null,
      roundNumber: state.roundNumber + 1,
      drawnCard: null,
      hasDrawnThisTurn: false,
      showPlayerId: null,
      roundResult: null,
      consecutiveTimeouts: {},
    };
  }

  // ── Handle turn timeout ─────────────────────────────────────────────────────

  static processTimeout(state: GameState): ActionResult {
    const player = state.players[state.currentPlayerIndex];
    const newCount = (state.consecutiveTimeouts[player.id] ?? 0) + 1;
    const timeouts = { ...state.consecutiveTimeouts, [player.id]: newCount };

    // After 3 consecutive timeouts, remove the player from the game
    if (newCount >= 3 && !player.isBot) {
      const actions: GameAction[] = [{
        type: 'system',
        playerId: player.id,
        message: `${player.username} was removed for being inactive 3 turns in a row`,
        timestamp: new Date().toISOString(),
      }];

      const discardPile = [...state.discardPile, ...player.hand];
      let s: GameState = {
        ...state,
        consecutiveTimeouts: { ...timeouts, [player.id]: 0 },
        discardPile,
        players: state.players.map(p =>
          p.id === player.id ? { ...p, isEliminated: true, hand: [], handCount: 0 } : p
        ),
      };

      const active = s.players.filter(p => !p.isEliminated);
      if (active.length <= 1) {
        return { success: true, state: { ...s, status: 'match_end' }, actions };
      }

      s = GameEngine.advanceTurn(s);
      return { success: true, state: s, actions };
    }

    const actions: GameAction[] = [{
      type: 'system',
      playerId: player.id,
      message: `${player.username}'s turn timed out (${newCount}/3) — auto-action applied`,
      timestamp: new Date().toISOString(),
    }];

    let s = { ...state, consecutiveTimeouts: timeouts };

    if (!state.hasDrawnThisTurn) {
      s = GameEngine.refillDeckIfNeeded(s);
      if (s.deck.length > 0) {
        const drawnCard = s.deck[0];
        const d = s.deck.slice(1);
        const hand = [...player.hand, drawnCard];
        s = {
          ...s,
          deck: d,
          players: s.players.map(p =>
            p.id === player.id ? { ...p, hand, handCount: hand.length } : p
          ),
          drawnCard,
          hasDrawnThisTurn: true,
        };
      }
    }

    // Auto-discard: highest-value non-joker card
    const p = s.players.find(pl => pl.id === player.id)!;
    if (p.hand.length > 0) {
      const sorted = [...p.hand].sort((a, b) => DeckManager.getCardValue(b) - DeckManager.getCardValue(a));
      const toDiscard = sorted[0];
      const newHand = p.hand.filter(c => c.id !== toDiscard.id);
      s = {
        ...s,
        players: s.players.map(pl =>
          pl.id === player.id ? { ...pl, hand: newHand, handCount: newHand.length } : pl
        ),
        discardPile: [...s.discardPile, toDiscard],
        hasDrawnThisTurn: false,
        drawnCard: null,
      };
    }

    s = GameEngine.advanceTurn(s);
    return { success: true, state: s, actions };
  }

  // Reset timeout count when a player takes a real action
  static resetTimeouts(state: GameState, playerId: string): GameState {
    if (!state.consecutiveTimeouts[playerId]) return state;
    return { ...state, consecutiveTimeouts: { ...state.consecutiveTimeouts, [playerId]: 0 } };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private static validateTurn(state: GameState, playerId: string): string | null {
    if (state.status !== 'playing') return 'Game is not in progress';
    if (state.players[state.currentPlayerIndex].id !== playerId) return "It's not your turn";
    return null;
  }

  /** Start a 7 attack chain against the next player. */
  private static startSevenAttack(
    state: GameState,
    attackerId: string,
    sevenCount: number,
    actions: GameAction[],
  ): GameState {
    const targetIndex = GameEngine.nextActiveIndex(state, state.currentPlayerIndex, 1);
    const attacker = state.players.find(p => p.id === attackerId)!;

    actions.push({
      type: 'attack',
      playerId: attackerId,
      targetPlayerIds: [state.players[targetIndex].id],
      message: `${attacker.username} attacks with ${sevenCount} seven(s)! ${sevenCount * 2} penalty cards on the line!`,
      timestamp: new Date().toISOString(),
    });

    return {
      ...state,
      attackChain: {
        sourcePlayerId: attackerId,
        targetPlayerIndex: targetIndex,
        sevensCount: sevenCount,
        penaltyCards: sevenCount * 2,
      },
      currentPlayerIndex: targetIndex,
      turnStartTime: new Date().toISOString(),
      hasDrawnThisTurn: false,
    };
  }

  /** Apply J-skip effect: skip `jCount` players. */
  private static applyJSkip(
    state: GameState,
    playerId: string,
    jCount: number,
    actions: GameAction[],
  ): GameState {
    const player = state.players.find(p => p.id === playerId)!;
    const skipped: string[] = [];

    let idx = state.currentPlayerIndex;
    for (let i = 0; i < jCount; i++) {
      idx = GameEngine.nextActiveIndex(state, idx, 1);
      skipped.push(state.players[idx].username);
    }
    const nextIdx = GameEngine.nextActiveIndex(state, idx, 1);

    actions.push({
      type: 'skip',
      playerId,
      targetPlayerIds: skipped.map(name =>
        state.players.find(p => p.username === name)?.id ?? ''
      ),
      message: `${player.username} plays ${jCount} J — ${skipped.join(', ')} skipped!`,
      timestamp: new Date().toISOString(),
    });

    return {
      ...state,
      currentPlayerIndex: nextIdx,
      turnNumber: state.turnNumber + 1,
      turnStartTime: new Date().toISOString(),
      hasDrawnThisTurn: false,
    };
  }

  static advanceTurn(state: GameState): GameState {
    const nextIdx = GameEngine.nextActiveIndex(state, state.currentPlayerIndex, 1);
    return {
      ...state,
      currentPlayerIndex: nextIdx,
      turnNumber: state.turnNumber + 1,
      turnStartTime: new Date().toISOString(),
      hasDrawnThisTurn: false,
      drawnCard: null,
    };
  }

  /** Walk the player array `steps` positions forward, skipping eliminated players. */
  static nextActiveIndex(state: GameState, from: number, steps: number): number {
    let idx = from;
    let remaining = steps;
    const total = state.players.length;
    let guard = total * 2; // prevent infinite loops in edge cases

    while (remaining > 0 && guard-- > 0) {
      idx = (idx + 1) % total;
      if (!state.players[idx].isEliminated) remaining--;
    }
    return idx;
  }

  /** If the deck runs out, reshuffle the discard pile (except the top card) into the deck. */
  private static refillDeckIfNeeded(state: GameState): GameState {
    if (state.deck.length > 0) return state;
    if (state.discardPile.length <= 1) return state;

    const top = state.discardPile[state.discardPile.length - 1];
    const reshuffled = DeckManager.shuffleDeck(state.discardPile.slice(0, -1));
    return { ...state, deck: reshuffled, discardPile: [top] };
  }
}

// ── Utility helpers ──────────────────────────────────────────────────────────

function fail(error: string, state: GameState): ActionResult {
  return { success: false, error, state, actions: [] };
}

function updatePlayer(state: GameState, playerId: string, updates: Partial<PlayerState>): GameState {
  return {
    ...state,
    players: state.players.map(p => (p.id === playerId ? { ...p, ...updates } : p)),
  };
}
