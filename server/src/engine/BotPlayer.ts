/**
 * BotPlayer — Tournament-grade expert AI (target: ~85% win rate).
 *
 * Core principles:
 *  1. SHOW the instant hand total ≤ 5 — zero hesitation, always.
 *  2. Optimal discard: score every possible discard option, pick the one
 *     that minimises the remaining hand total. Same-rank group discards
 *     (e.g. two Kings at once) are evaluated and preferred when superior.
 *  3. Attack proactively: 7s are "dual-purpose" — they remove 7 pts from
 *     our hand AND add penalty cards to the opponent. Use them early.
 *  4. Skip opponent turns with J whenever they're within striking range.
 *  5. Sniper draw: take from discard pile when it enables a show next turn
 *     or completes a pair for a higher-value combined discard.
 *  6. Always cut — never skip a free discard that matches the top card.
 *
 * Turn execution order (unchanged interface for gameHandler):
 *  1. Respond to 7-attack chain first.
 *  2. SHOW if eligible (≤5 pts, hasDrawnThisTurn = false).
 *  3. Cut: discard matching cards without drawing.
 *  4. Draw (deck or discard — sniper logic).
 *  5. Discard using the full scoring engine.
 */

import { GameState, Card, DrawSource } from '../../../shared/src/types';
import { DeckManager } from './DeckManager';

export interface BotDecision {
  action: 'draw' | 'discard' | 'show' | 'attack_throw' | 'attack_take';
  source?: DrawSource;
  cardIds?: string[];
}

export type BotPersonality = 'safe' | 'aggressive' | 'bluff' | 'smart' | 'boss';

// ── Per-personality config ────────────────────────────────────────────────────

interface PersonalityConfig {
  thinkBaseMs:       number;
  thinkJitterMs:     number;
  showThreshold:     number; // show when hand total ≤ this
  attackAllAt:       number; // throw all 7s when opponent has ≤ X cards
  attackOneAt:       number; // throw one 7 when opponent has ≤ X cards
  skipAt:            number; // skip with J when opponent has ≤ X cards
  randomPlayChance:  number; // 0-1: probability of making a random (suboptimal) move
  alwaysAttack:      boolean;
}

const PERSONALITY: Record<BotPersonality, PersonalityConfig> = {
  safe: {
    thinkBaseMs: 1200, thinkJitterMs: 600,
    showThreshold: 12,
    attackAllAt: 0, attackOneAt: 0, skipAt: 0, // never attacks
    randomPlayChance: 0.30,
    alwaysAttack: false,
  },
  aggressive: {
    thinkBaseMs: 280, thinkJitterMs: 200,
    showThreshold: 7,
    attackAllAt: 4, attackOneAt: 7, skipAt: 5,
    randomPlayChance: 0.05,
    alwaysAttack: true,
  },
  bluff: {
    thinkBaseMs: 600, thinkJitterMs: 500,
    showThreshold: 8,
    attackAllAt: 2, attackOneAt: 4, skipAt: 3,
    randomPlayChance: 0.40, // high randomness — unpredictable
    alwaysAttack: false,
  },
  smart: {
    thinkBaseMs: 480, thinkJitterMs: 340,
    showThreshold: 5,
    attackAllAt: 2, attackOneAt: 5, skipAt: 4,
    randomPlayChance: 0,
    alwaysAttack: false,
  },
  boss: {
    thinkBaseMs: 180, thinkJitterMs: 120,
    showThreshold: 4,
    attackAllAt: 3, attackOneAt: 6, skipAt: 5,
    randomPlayChance: 0,
    alwaysAttack: true,
  },
};

// ── Config ────────────────────────────────────────────────────────────────────

const THINK_BASE_MS          = 480;   // faster than before — feels skilled
const THINK_JITTER_MS        = 340;   // human-like variance

// Attack thresholds (opponent card count)
const ATTACK_ALL_THRESHOLD   = 2;     // ≤2 → throw every 7 we have
const ATTACK_ONE_THRESHOLD   = 5;     // ≤5 → throw one 7 to disrupt
const SKIP_THRESHOLD         = 4;     // ≤4 → skip with J (no 7s available)

// Draw-source: how many pts must we save vs our worst card to take from discard
const DISCARD_SAVE_THRESHOLD = 1;     // save ≥1 pt → take from discard pile

// ─────────────────────────────────────────────────────────────────────────────

export class BotPlayer {

  static getThinkDelay(personality: BotPersonality = 'smart'): number {
    const cfg = PERSONALITY[personality];
    return cfg.thinkBaseMs + Math.random() * cfg.thinkJitterMs;
  }

  // ── Threat Analysis ──────────────────────────────────────────────────────────

  private static assessThreat(state: GameState, botPlayerId: string) {
    const bot      = state.players.find(p => p.id === botPlayerId)!;
    const botIndex = state.players.indexOf(bot);
    const total    = state.players.length;

    const opponents = state.players.filter(p => !p.isEliminated && p.id !== botPlayerId);
    const minOpponentCards = opponents.length > 0
      ? Math.min(...opponents.map(p => p.handCount))
      : Infinity;

    let nextIdx = botIndex;
    let guard   = total * 2;
    do {
      nextIdx = (nextIdx + 1) % total;
    } while (state.players[nextIdx].isEliminated && --guard > 0);

    const nextPlayer      = state.players[nextIdx];
    const nextPlayerCards = (nextPlayer && !nextPlayer.isEliminated)
      ? nextPlayer.handCount
      : Infinity;

    return { minOpponentCards, nextPlayerCards };
  }

  // ── Hand Scoring Helpers ─────────────────────────────────────────────────────

  /** Hand total that would remain if `toDiscard` cards were removed. */
  private static scoreAfterDiscard(hand: Card[], toDiscard: Card[]): number {
    const ids = new Set(toDiscard.map(c => c.id));
    return hand
      .filter(c => !ids.has(c.id))
      .reduce((s, c) => s + DeckManager.getCardValue(c), 0);
  }

  /**
   * Build every valid discard option from a post-draw hand:
   *   • Each individual card as a singleton discard.
   *   • Every complete same-rank group (2+ cards) as a combined discard.
   *
   * Same-rank group discards remove more total pts in a single action and
   * are often the correct play (e.g. two Kings → −20 pts in one turn).
   */
  private static buildDiscardCandidates(hand: Card[]): Card[][] {
    const byRank: Record<string, Card[]> = {};
    for (const card of hand) {
      if (!byRank[card.rank]) byRank[card.rank] = [];
      byRank[card.rank].push(card);
    }

    const candidates: Card[][] = [];
    for (const group of Object.values(byRank)) {
      for (const card of group) {
        candidates.push([card]);               // singleton
      }
      if (group.length > 1) {
        candidates.push(group);                // full group (all same rank)
        // Also add pairs from larger groups (take 2 of 3+)
        if (group.length >= 3) {
          for (let i = 0; i < group.length; i++) {
            for (let j = i + 1; j < group.length; j++) {
              candidates.push([group[i], group[j]]);
            }
          }
        }
      }
    }
    return candidates;
  }

  /**
   * Find the discard option (from non-power cards) that most reduces the hand.
   * Power cards (real 7s, real Js) are excluded here; handled separately via
   * attack/skip logic so their strategic value isn't wasted on pure reduction.
   */
  private static bestReductionDiscard(hand: Card[]): { cards: Card[]; score: number } {
    const currentTotal = DeckManager.calculateHandTotal(hand);
    const isRealPower  = (c: Card) =>
      !c.isJoker && (c.rank === '7' || c.rank === 'J');

    const normalCards = hand.filter(c => !isRealPower(c));
    const candidates  = BotPlayer.buildDiscardCandidates(normalCards);

    let best: Card[] = [];
    let bestScore    = currentTotal; // baseline: no discard

    for (const option of candidates) {
      const remaining = BotPlayer.scoreAfterDiscard(hand, option);
      if (remaining < bestScore) {
        bestScore = remaining;
        best      = option;
      }
    }
    return { cards: best, score: bestScore };
  }

  // ── Draw Source ──────────────────────────────────────────────────────────────

  /**
   * Expert draw-source selection.
   *
   * Takes from discard pile when:
   *  (a) the card is worth 0 pts (joker / joker-rank) — always an improvement;
   *  (b) it completes a same-rank pair we hold, enabling a group discard later;
   *  (c) it would allow us to reach ≤5 after swapping our worst card (sniper);
   *  (d) it is strictly cheaper than our current worst card by ≥1 pt.
   */
  static decideDrawSource(state: GameState, botPlayerId: string): DrawSource {
    const bot        = state.players.find(p => p.id === botPlayerId)!;
    const topDiscard = state.discardPile[state.discardPile.length - 1];
    if (!topDiscard) return 'deck';

    // 7 and J (real) cannot be taken from discard
    if (!topDiscard.isJoker && (topDiscard.rank === '7' || topDiscard.rank === 'J')) {
      return 'deck';
    }
    // Printed joker on top — we can't pick it up to help our hand (value already 0 on our jokers)
    if (topDiscard.rank === 'Joker') return 'deck';

    const discardValue = DeckManager.getCardValue(topDiscard);
    const hand         = bot.hand;
    const handTotal    = DeckManager.calculateHandTotal(hand);

    // (a) Always take 0-pt cards — free hand improvement
    if (discardValue === 0) return 'discard';

    // (b) Completes a same-rank pair → future group discard opportunity
    const hasSameRank = hand.some(c =>
      c.rank === topDiscard.rank && !c.isJoker && c.rank !== '7' && c.rank !== 'J'
    );
    if (hasSameRank && discardValue >= 2) return 'discard';

    // Find our worst (highest-value) card
    const nonJokers  = hand.filter(c => !c.isJoker);
    if (nonJokers.length === 0) return 'deck';
    const worstCard  = nonJokers.reduce(
      (w, c) => DeckManager.getCardValue(c) > DeckManager.getCardValue(w) ? c : w
    );
    const worstValue = DeckManager.getCardValue(worstCard);

    // (c) Sniper draw: taking this + discarding worst → hand ≤ 5 (show next turn!)
    if (discardValue < worstValue) {
      const projected = handTotal - worstValue + discardValue;
      if (projected <= 5) return 'discard';
    }

    // (d) Saves at least DISCARD_SAVE_THRESHOLD pts vs our worst card
    if (discardValue <= worstValue - DISCARD_SAVE_THRESHOLD) return 'discard';

    return 'deck';
  }

  // ── Discard Selection ────────────────────────────────────────────────────────

  /**
   * Full scoring-engine discard decision.
   *
   * Priority order:
   *  P1  Any normal discard that brings hand to ≤5 → do it immediately.
   *  P2  Opponent ≤ ATTACK_ALL_THRESHOLD cards → throw ALL 7s (maximum chain).
   *  P3  Discarding a 7 would bring hand to ≤5 → throw it (reduce + attack).
   *  P4  Opponent ≤ ATTACK_ONE_THRESHOLD → throw one 7 (reduce 7 pts + disrupt).
   *  P5  Opponent ≤ SKIP_THRESHOLD, no 7s → skip with J.
   *  P6  Best normal discard (lowest remaining hand total).
   *  P7  Only power cards left — sacrifice least valuable.
   */
  static decideDiscard(state: GameState, botPlayerId: string, personality: BotPersonality = 'smart'): string[] {
    const bot  = state.players.find(p => p.id === botPlayerId)!;
    const hand = bot.hand;
    const cfg  = PERSONALITY[personality];

    // Random play: safe/bluff bots sometimes make suboptimal choices
    if (cfg.randomPlayChance > 0 && Math.random() < cfg.randomPlayChance) {
      const nonPower = hand.filter(c => !c.isJoker && c.rank !== '7' && c.rank !== 'J');
      if (nonPower.length > 0) {
        return [nonPower[Math.floor(Math.random() * nonPower.length)].id];
      }
    }

    const { minOpponentCards, nextPlayerCards } =
      BotPlayer.assessThreat(state, botPlayerId);

    const isRealSeven = (c: Card) => c.rank === '7' && !c.isJoker;
    const isRealJack  = (c: Card) => c.rank === 'J' && !c.isJoker;

    const sevens = hand.filter(isRealSeven);
    const jacks  = hand.filter(isRealJack);

    const { cards: normalBest, score: normalBestScore } =
      BotPlayer.bestReductionDiscard(hand);

    // ── P1: Normal discard reaches show-ready ─────────────────────────────────
    if (normalBestScore <= cfg.showThreshold && normalBest.length > 0) {
      return normalBest.map(c => c.id);
    }

    if (cfg.attackAllAt === 0) {
      // SAFE bot — never attacks, just reduces hand
    } else {
      // ── P2: Maximum aggression ─────────────────────────────────────────────
      if (minOpponentCards <= cfg.attackAllAt && sevens.length > 0) {
        return sevens.map(c => c.id);
      }

      // ── P3: Attack AND show-setup ──────────────────────────────────────────
      if (sevens.length > 0) {
        const scoreWith7 = BotPlayer.scoreAfterDiscard(hand, [sevens[0]]);
        if (scoreWith7 <= cfg.showThreshold) return [sevens[0].id];
      }

      // ── P4: Pressure attack ────────────────────────────────────────────────
      if (minOpponentCards <= cfg.attackOneAt && sevens.length > 0) {
        const scoreWith7 = BotPlayer.scoreAfterDiscard(hand, [sevens[0]]);
        if (scoreWith7 <= normalBestScore + 3) return [sevens[0].id];
      }

      // ── P5: Skip with J ───────────────────────────────────────────────────
      if (nextPlayerCards <= cfg.skipAt && jacks.length > 0 && sevens.length === 0) {
        const scoreWithJ = BotPlayer.scoreAfterDiscard(hand, [jacks[0]]);
        if (scoreWithJ <= normalBestScore + 2) return [jacks[0].id];
      }
    }

    // ── P6: Best normal discard ───────────────────────────────────────────────
    if (normalBest.length > 0) return normalBest.map(c => c.id);

    // ── P7: Only power cards remain ───────────────────────────────────────────
    if (sevens.length > 1) return [sevens[0].id];
    if (jacks.length > 0)  return [jacks[0].id];
    if (sevens.length === 1) return [sevens[0].id];

    const highest = hand.reduce(
      (h, c) => DeckManager.getCardValue(c) > DeckManager.getCardValue(h) ? c : h,
      hand[0]
    );
    return [highest.id];
  }

  // ── Show Decision ────────────────────────────────────────────────────────────

  static shouldCallShow(state: GameState, botPlayerId: string, personality: BotPersonality = 'smart'): boolean {
    const bot   = state.players.find(p => p.id === botPlayerId)!;
    const total = DeckManager.calculateHandTotal(bot.hand);
    const threshold = PERSONALITY[personality].showThreshold;
    // Bluff bot: sometimes refuses to show even when eligible (bluffing)
    if (personality === 'bluff' && total <= threshold) {
      return Math.random() > 0.25; // 25% chance to hold even when eligible
    }
    return total <= threshold;
  }

  // ── Attack Response ──────────────────────────────────────────────────────────

  /**
   * Always counter a 7 attack if we hold any 7s.
   * Countering: removes our 7s from hand (reducing our score) AND shifts the
   * penalty chain to the next player. A pure win-win.
   *
   * Exception: if countering would be impossible (no 7s), take the penalty.
   */
  static decideAttackResponse(
    state: GameState,
    botPlayerId: string,
  ): { action: 'throw' | 'take'; cardIds?: string[] } {
    const bot    = state.players.find(p => p.id === botPlayerId)!;
    const sevens = bot.hand.filter(c => c.rank === '7' && !c.isJoker);

    if (sevens.length > 0) {
      return { action: 'throw', cardIds: sevens.map(c => c.id) };
    }
    return { action: 'take' };
  }

  // ── Main Decision Tree ───────────────────────────────────────────────────────

  static decide(state: GameState, botPlayerId: string, personality: BotPersonality = 'smart'): BotDecision {
    const bot = state.players.find(p => p.id === botPlayerId);
    if (!bot) return { action: 'draw', source: 'deck' };

    // 1. Respond to active 7-attack chain — highest priority
    if (state.attackChain &&
        state.attackChain.targetPlayerIndex === state.players.indexOf(bot)) {
      const resp = BotPlayer.decideAttackResponse(state, botPlayerId);
      return resp.action === 'throw'
        ? { action: 'attack_throw', cardIds: resp.cardIds }
        : { action: 'attack_take' };
    }

    // 2. SHOW — personality-specific threshold
    if (!state.hasDrawnThisTurn && BotPlayer.shouldCallShow(state, botPlayerId, personality)) {
      return { action: 'show' };
    }

    if (!state.hasDrawnThisTurn) {
      // 3. Cut: if top discard matches cards in hand
      const topDiscard   = state.discardPile[state.discardPile.length - 1];
      const isRealSeven  = (c: Card) => c.rank === '7' && !c.isJoker;
      if (topDiscard && !isRealSeven(topDiscard) && !topDiscard.isJoker) {
        const matching = bot.hand.filter(
          c => !c.isJoker && c.rank === topDiscard.rank && !isRealSeven(c)
        );
        if (matching.length > 0) {
          const cutValue = matching.reduce((s, c) => s + DeckManager.getCardValue(c), 0);
          if (cutValue >= 2) {
            return { action: 'discard', cardIds: matching.map(c => c.id) };
          }
        }
      }

      // 4. Draw
      return { action: 'draw', source: BotPlayer.decideDrawSource(state, botPlayerId) };
    }

    // 5. Post-draw: personality-aware discard
    return { action: 'discard', cardIds: BotPlayer.decideDiscard(state, botPlayerId, personality) };
  }
}
