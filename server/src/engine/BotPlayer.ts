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

import { GameState, Card, DrawSource } from "../../../shared/src/types";
import { DeckManager } from "./DeckManager";

export interface BotDecision {
  action: "draw" | "discard" | "show" | "attack_throw" | "attack_take";
  source?: DrawSource;
  cardIds?: string[];
}

export type BotPersonality = "safe" | "aggressive" | "bluff" | "smart" | "boss";
export type PlayerArchetype =
  | "aggressive"
  | "defensive"
  | "combo_hoarder"
  | "fast_show"
  | "trap"
  | "hold_7s"
  | "unknown";

export interface OpponentProfile {
  userId: string;
  handCount: number;
  archetype?: PlayerArchetype;
  recentDraws: number;
  recentCuts: number;
  recentShows: number;
  recentAttackThrows: number;
  recentAttackTakes: number;
  handCountHistory: number[];
}

export type BossSubpersonality =
  | "neutral"
  | "aggressive"
  | "defensive"
  | "trap"
  | "anti_show";

// ── Per-personality config ────────────────────────────────────────────────────

interface PersonalityConfig {
  thinkBaseMs: number;
  thinkJitterMs: number;
  showBias: number; // adjusts AI appetite for calling SHOW
  riskTolerance: number; // lower = more conservative about risk
  bluffFactor: number; // higher = more intentional deception
  attackAllAt: number; // throw all 7s when opponent has ≤ X cards
  attackOneAt: number; // throw one 7 when opponent has ≤ X cards
  skipAt: number; // skip with J when opponent has ≤ X cards
  randomPlayChance: number; // 0-1: probability of making a random quality move
  alwaysAttack: boolean;
  comboPreservation: number; // higher = value keeping pairs for future turns
  pressureBias: number; // higher = more likely to punish weak opponents
  tacticalVariance: number; // degree of near-optimal variation
}

const PERSONALITY: Record<BotPersonality, PersonalityConfig> = {
  safe: {
    thinkBaseMs: 1200,
    thinkJitterMs: 600,
    showBias: -0.28,
    riskTolerance: 0.78,
    bluffFactor: 0.28,
    attackAllAt: 0,
    attackOneAt: 0,
    skipAt: 0,
    randomPlayChance: 0.3,
    alwaysAttack: false,
    comboPreservation: 0.95,
    pressureBias: 0.18,
    tacticalVariance: 0.24,
  },
  aggressive: {
    thinkBaseMs: 280,
    thinkJitterMs: 220,
    showBias: 0.06,
    riskTolerance: 0.38,
    bluffFactor: 0.1,
    attackAllAt: 4,
    attackOneAt: 7,
    skipAt: 5,
    randomPlayChance: 0.08,
    alwaysAttack: true,
    comboPreservation: 0.28,
    pressureBias: 0.75,
    tacticalVariance: 0.1,
  },
  bluff: {
    thinkBaseMs: 620,
    thinkJitterMs: 520,
    showBias: -0.12,
    riskTolerance: 0.55,
    bluffFactor: 0.5,
    attackAllAt: 2,
    attackOneAt: 4,
    skipAt: 3,
    randomPlayChance: 0.42,
    alwaysAttack: false,
    comboPreservation: 0.6,
    pressureBias: 0.4,
    tacticalVariance: 0.3,
  },
  smart: {
    thinkBaseMs: 480,
    thinkJitterMs: 340,
    showBias: 0.18,
    riskTolerance: 0.42,
    bluffFactor: 0.1,
    attackAllAt: 2,
    attackOneAt: 5,
    skipAt: 4,
    randomPlayChance: 0,
    alwaysAttack: false,
    comboPreservation: 0.55,
    pressureBias: 0.52,
    tacticalVariance: 0.08,
  },
  boss: {
    thinkBaseMs: 180,
    thinkJitterMs: 140,
    showBias: 0.28,
    riskTolerance: 0.32,
    bluffFactor: 0.12,
    attackAllAt: 3,
    attackOneAt: 6,
    skipAt: 5,
    randomPlayChance: 0.08,
    alwaysAttack: true,
    comboPreservation: 0.65,
    pressureBias: 0.82,
    tacticalVariance: 0.12,
  },
};

// ── Config ────────────────────────────────────────────────────────────────────

const THINK_BASE_MS = 480; // faster than before — feels skilled
const THINK_JITTER_MS = 340; // human-like variance

// Attack thresholds (opponent card count)
const ATTACK_ALL_THRESHOLD = 2; // ≤2 → throw every 7 we have
const ATTACK_ONE_THRESHOLD = 5; // ≤5 → throw one 7 to disrupt
const SKIP_THRESHOLD = 4; // ≤4 → skip with J (no 7s available)

// Draw-source: how many pts must we save vs our worst card to take from discard
const DISCARD_SAVE_THRESHOLD = 1; // save ≥1 pt → take from discard pile

const SHOW_CONFIDENCE_MIN = 0.28;
const SHOW_CONFIDENCE_MAX = 0.92;

// ─────────────────────────────────────────────────────────────────────────────

export class BotPlayer {
  private static normalizeBoost(difficultyBoost = 0): number {
    return Math.min(0.35, Math.max(0, difficultyBoost));
  }

  static getThinkDelay(
    personality: BotPersonality = "smart",
    difficultyBoost = 0,
  ): number {
    const cfg = PERSONALITY[personality];
    const boost = BotPlayer.normalizeBoost(difficultyBoost);
    const baseDelay = cfg.thinkBaseMs + Math.random() * cfg.thinkJitterMs;
    return Math.max(400, baseDelay - boost * 320);
  }

  private static bossPersonalityForMode(
    mode: BossSubpersonality,
  ): BotPersonality {
    switch (mode) {
      case "aggressive":
        return "aggressive";
      case "defensive":
        return "safe";
      case "trap":
        return "smart";
      case "anti_show":
        return "bluff";
      default:
        return "boss";
    }
  }

  private static inferOpponentSignals(opponents?: OpponentProfile[]) {
    if (!opponents || opponents.length === 0) {
      return {
        weakSignal: 0,
        trapSignal: 0,
        fastShowSignal: 0,
        aggressiveSignal: 0,
        defensiveSignal: 0,
      };
    }

    let weakSignal = 0;
    let trapSignal = 0;
    let fastShowSignal = 0;
    let aggressiveSignal = 0;
    let defensiveSignal = 0;

    for (const opp of opponents) {
      const aggressiveScore =
        opp.recentAttackThrows - opp.recentAttackTakes + opp.recentDraws * 0.2;
      const defensiveScore =
        opp.recentAttackTakes - opp.recentAttackThrows + opp.recentShows * 0.15;
      const showScore = opp.recentShows + opp.recentCuts * 0.4;
      const trapScore =
        opp.handCountHistory.length > 0
          ? opp.handCountHistory.reduce((sum, v) => sum + v, 0) /
            opp.handCountHistory.length
          : 0;

      if (opp.archetype === "fast_show") fastShowSignal += 1;
      if (opp.archetype === "trap" || opp.archetype === "combo_hoarder")
        trapSignal += 1;
      if (opp.archetype === "aggressive") aggressiveSignal += 1;
      if (opp.archetype === "defensive") defensiveSignal += 1;
      if (opp.archetype === "hold_7s") trapSignal += 0.5;

      if (aggressiveScore > 1.5) aggressiveSignal += 0.6;
      if (defensiveScore > 1.5) defensiveSignal += 0.6;
      if (showScore >= 2) fastShowSignal += 0.5;
      if (trapScore >= 5) trapSignal += 0.5;
      if (opp.recentDraws >= 3 && opp.recentCuts <= 1) weakSignal += 0.6;
      if (opp.recentDraws >= 4 && opp.recentShows <= 1) weakSignal += 0.4;
    }

    const totalOpponents = opponents.length;
    return {
      weakSignal: Math.min(1, weakSignal / totalOpponents),
      trapSignal: Math.min(1, trapSignal / totalOpponents),
      fastShowSignal: Math.min(1, fastShowSignal / totalOpponents),
      aggressiveSignal: Math.min(1, aggressiveSignal / totalOpponents),
      defensiveSignal: Math.min(1, defensiveSignal / totalOpponents),
    };
  }

  private static selectBossMode(
    state: GameState,
    botPlayerId: string,
    opponents?: OpponentProfile[],
  ): BossSubpersonality {
    const signals = BotPlayer.inferOpponentSignals(opponents);
    const bot = state.players.find((p) => p.id === botPlayerId)!;
    const botTotal = DeckManager.calculateHandTotal(bot.hand);
    const bestOpp = state.players
      .filter((p) => !p.isBot && !p.isEliminated)
      .reduce((min, p) => Math.min(min, p.handCount), Infinity);

    if (signals.fastShowSignal >= 0.5) {
      return "anti_show";
    }
    if (signals.trapSignal >= 0.5 && botTotal >= 8) {
      return "trap";
    }
    if (signals.aggressiveSignal >= 0.6) {
      return "defensive";
    }
    if (bestOpp <= 3 && botTotal <= 10) {
      return "aggressive";
    }
    if (botTotal <= 6 && signals.weakSignal >= 0.3) {
      return "aggressive";
    }
    if (botTotal >= 12 && signals.trapSignal >= 0.4) {
      return "defensive";
    }
    return "neutral";
  }

  private static estimateOpponentShowPressure(opponents?: OpponentProfile[]) {
    const signals = BotPlayer.inferOpponentSignals(opponents);
    return signals.fastShowSignal * 0.6 + signals.trapSignal * 0.2;
  }

  private static evaluateFutureDiscardValue(
    hand: Card[],
    discardCards: Card[],
    opponentProfiles?: OpponentProfile[],
    difficultyBoost = 0,
  ): number {
    const remainingScore = BotPlayer.scoreAfterDiscard(hand, discardCards);
    const scoreDelta = DeckManager.calculateHandTotal(hand) - remainingScore;
    const comboRetention =
      BotPlayer.handResilience(hand) -
      BotPlayer.handResilience(
        hand.filter((c) => !discardCards.some((d) => d.id === c.id)),
      );
    const futureThreat =
      BotPlayer.estimateOpponentShowPressure(opponentProfiles);
    const keepSevenPenalty = discardCards.some(
      (c) => c.rank === "7" && !c.isJoker,
    )
      ? 1.2
      : 0;
    const keepComboBonus = Math.max(0, comboRetention) * 0.15;
    const boostFactor = Math.min(0.35, Math.max(0, difficultyBoost));

    return (
      remainingScore -
      keepComboBonus +
      keepSevenPenalty * futureThreat -
      boostFactor * 0.25
    );
  }

  private static adjustBluffDiscardTolerance(
    state: GameState,
    personality: BotPersonality,
    currentTotal: number,
    boost: number,
  ): number {
    if (personality !== "bluff") return 0;
    let adjustment = 0.6;
    if (currentTotal >= 8) adjustment += boost * 1.2;
    if (currentTotal >= 10) adjustment += 0.4;
    return adjustment;
  }

  // ── Threat Analysis ──────────────────────────────────────────────────────────

  private static assessThreat(state: GameState, botPlayerId: string) {
    const bot = state.players.find((p) => p.id === botPlayerId)!;
    const botIndex = state.players.indexOf(bot);
    const total = state.players.length;

    const opponents = state.players.filter(
      (p) => !p.isEliminated && p.id !== botPlayerId,
    );
    const minOpponentCards =
      opponents.length > 0
        ? Math.min(...opponents.map((p) => p.handCount))
        : Infinity;

    let nextIdx = botIndex;
    let guard = total * 2;
    do {
      nextIdx = (nextIdx + 1) % total;
    } while (state.players[nextIdx].isEliminated && --guard > 0);

    const nextPlayer = state.players[nextIdx];
    const nextPlayerCards =
      nextPlayer && !nextPlayer.isEliminated ? nextPlayer.handCount : Infinity;

    return { minOpponentCards, nextPlayerCards };
  }

  // ── Hand Scoring Helpers ─────────────────────────────────────────────────────

  private static scoreAfterDiscard(hand: Card[], toDiscard: Card[]): number {
    const ids = new Set(toDiscard.map((c) => c.id));
    return hand
      .filter((c) => !ids.has(c.id))
      .reduce((s, c) => s + DeckManager.getCardValue(c), 0);
  }

  private static buildDiscardCandidates(hand: Card[]): Card[][] {
    const byRank: Record<string, Card[]> = {};
    for (const card of hand) {
      if (!byRank[card.rank]) byRank[card.rank] = [];
      byRank[card.rank].push(card);
    }

    const candidates: Card[][] = [];
    for (const group of Object.values(byRank)) {
      for (const card of group) {
        candidates.push([card]);
      }
      if (group.length > 1) {
        candidates.push(group);
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

  private static performanceDiscardOptions(
    hand: Card[],
  ): Array<{ cards: Card[]; score: number; comboCount: number }> {
    const options: Array<{ cards: Card[]; score: number; comboCount: number }> =
      [];
    const candidates = BotPlayer.buildDiscardCandidates(hand);
    for (const cards of candidates) {
      const score = BotPlayer.scoreAfterDiscard(hand, cards);
      const comboCount = new Set(cards.map((c) => c.rank)).size;
      options.push({ cards, score, comboCount });
    }
    return options.sort(
      (a, b) => a.score - b.score || a.cards.length - b.cards.length,
    );
  }

  private static bestReductionDiscard(hand: Card[]): {
    cards: Card[];
    score: number;
  } {
    const currentTotal = DeckManager.calculateHandTotal(hand);
    const isRealPower = (c: Card) =>
      !c.isJoker && (c.rank === "7" || c.rank === "J");

    const normalCards = hand.filter((c) => !isRealPower(c));
    const candidates = BotPlayer.buildDiscardCandidates(normalCards);

    let best: Card[] = [];
    let bestScore = currentTotal;

    for (const option of candidates) {
      const remaining = BotPlayer.scoreAfterDiscard(hand, option);
      if (remaining < bestScore) {
        bestScore = remaining;
        best = option;
      }
    }
    return { cards: best, score: bestScore };
  }

  private static handResilience(hand: Card[]): number {
    const byRank: Record<string, number> = {};
    for (const card of hand) {
      if (!card.isJoker) {
        byRank[card.rank] = (byRank[card.rank] || 0) + 1;
      }
    }
    return Object.values(byRank).reduce(
      (sum, count) => sum + Math.max(0, count - 1),
      0,
    );
  }

  private static estimateShowConfidence(
    state: GameState,
    botPlayerId: string,
    personality: BotPersonality,
    difficultyBoost = 0,
    opponents?: OpponentProfile[],
  ): number {
    const bot = state.players.find((p) => p.id === botPlayerId)!;
    const cfg = PERSONALITY[personality];
    const boost = BotPlayer.normalizeBoost(difficultyBoost);
    const total = DeckManager.calculateHandTotal(bot.hand);
    const bestDiscard = BotPlayer.bestReductionDiscard(bot.hand);
    const futurePotential = total - bestDiscard.score;
    const comboBonus = BotPlayer.handResilience(bot.hand) * 0.05;

    let score = 1 - total / 18;
    score += (8 - total) * 0.03;
    score += comboBonus;
    score += cfg.showBias;
    score += Math.min(0.16, boost * 0.18);
    score -= futurePotential * 0.02;
    score -= cfg.riskTolerance * 0.08;

    const { minOpponentCards } = BotPlayer.assessThreat(state, botPlayerId);
    const oppSignals = BotPlayer.inferOpponentSignals(opponents);
    if (minOpponentCards <= 3) {
      score += cfg.pressureBias * 0.06;
    }
    score += oppSignals.weakSignal * 0.08;
    score -= oppSignals.fastShowSignal * 0.1;
    score -= oppSignals.trapSignal * 0.06;
    if (total >= 12) score -= 0.14;
    if (total >= 10) score -= 0.08;
    if (personality === "bluff") score -= cfg.bluffFactor * 0.12;

    return Math.min(SHOW_CONFIDENCE_MAX, Math.max(SHOW_CONFIDENCE_MIN, score));
  }

  static decideDrawSource(
    state: GameState,
    botPlayerId: string,
    difficultyBoost = 0,
    opponents?: OpponentProfile[],
  ): DrawSource {
    const bot = state.players.find((p) => p.id === botPlayerId)!;
    const boost = BotPlayer.normalizeBoost(difficultyBoost);
    const topDiscard = state.discardPile[state.discardPile.length - 1];
    if (!topDiscard) return "deck";

    if (
      !topDiscard.isJoker &&
      (topDiscard.rank === "7" || topDiscard.rank === "J")
    ) {
      return "deck";
    }
    if (topDiscard.rank === "Joker") return "deck";

    const discardValue = DeckManager.getCardValue(topDiscard);
    const hand = bot.hand;
    const handTotal = DeckManager.calculateHandTotal(hand);
    const nonJokers = hand.filter((c) => !c.isJoker);
    if (nonJokers.length === 0) return "deck";

    const worstCard = nonJokers.reduce((w, c) =>
      DeckManager.getCardValue(c) > DeckManager.getCardValue(w) ? c : w,
    );
    const worstValue = DeckManager.getCardValue(worstCard);

    if (discardValue === 0) return "discard";

    const completesPair = hand.some(
      (c) =>
        c.rank === topDiscard.rank &&
        !c.isJoker &&
        c.rank !== "7" &&
        c.rank !== "J",
    );
    if (completesPair && discardValue <= worstValue) return "discard";

    const projected = handTotal - worstValue + discardValue;
    const oppPressure = BotPlayer.estimateOpponentShowPressure(opponents);
    if (projected <= 5 + Math.floor(boost * 3) - Math.floor(oppPressure * 2))
      return "discard";

    if (boost > 0.12 && discardValue <= worstValue && projected <= 7)
      return "discard";
    if (discardValue <= worstValue - DISCARD_SAVE_THRESHOLD) return "discard";

    const reducedScore = BotPlayer.bestReductionDiscard([
      ...hand,
      topDiscard,
    ]).score;
    if (reducedScore <= 5 && discardValue < worstValue) return "discard";

    return "deck";
  }

  static decideDiscard(
    state: GameState,
    botPlayerId: string,
    personality: BotPersonality = "smart",
    difficultyBoost = 0,
    opponents?: OpponentProfile[],
  ): string[] {
    const bot = state.players.find((p) => p.id === botPlayerId)!;
    const hand = bot.hand;
    const cfg = PERSONALITY[personality];
    const boost = BotPlayer.normalizeBoost(difficultyBoost);

    const isRealSeven = (c: Card) => c.rank === "7" && !c.isJoker;
    const isRealJack = (c: Card) => c.rank === "J" && !c.isJoker;

    const sevens = hand.filter(isRealSeven);
    const jacks = hand.filter(isRealJack);
    const nonPower = hand.filter(
      (c) => !isRealSeven(c) && !isRealJack(c) && !c.isJoker,
    );
    const { minOpponentCards, nextPlayerCards } = BotPlayer.assessThreat(
      state,
      botPlayerId,
    );

    const currentTotal = DeckManager.calculateHandTotal(hand);
    const { cards: normalBest, score: normalBestScore } =
      BotPlayer.bestReductionDiscard(hand);
    const discardOptions = BotPlayer.performanceDiscardOptions(hand);

    if (Math.random() < cfg.randomPlayChance && nonPower.length > 0) {
      return [nonPower[Math.floor(Math.random() * nonPower.length)].id];
    }

    if (normalBestScore <= 5 && normalBest.length > 0) {
      return normalBest.map((c) => c.id);
    }

    const preserveCombo =
      BotPlayer.handResilience(hand) * cfg.comboPreservation;
    const shouldKeepPair =
      preserveCombo >
      1.2 +
        BotPlayer.adjustBluffDiscardTolerance(
          state,
          personality,
          currentTotal,
          boost,
        );
    const oppPressure = BotPlayer.estimateOpponentShowPressure(opponents);
    const keepSevenThreshold = boost > 0.18 ? 8 : 6;

    if (
      cfg.alwaysAttack ||
      (minOpponentCards <= cfg.attackAllAt && sevens.length > 0)
    ) {
      return sevens.map((c) => c.id);
    }

    if (
      personality === "bluff" &&
      oppPressure >= 0.35 &&
      sevens.length > 0 &&
      currentTotal <= 11
    ) {
      const bluffKeep = hand
        .filter((c) => c.rank !== "7" || c.isJoker)
        .sort(
          (a, b) => DeckManager.getCardValue(b) - DeckManager.getCardValue(a),
        );
      if (bluffKeep.length > 0) return [bluffKeep[0].id];
    }

    if (sevens.length > 0) {
      const sevenDiscardScore = BotPlayer.scoreAfterDiscard(hand, [sevens[0]]);
      const futurePenalty = oppPressure * 1.5;
      if (
        sevenDiscardScore <= 8 ||
        (minOpponentCards <= cfg.attackOneAt &&
          normalBestScore - sevenDiscardScore <= 3) ||
        (boost > 0.12 &&
          minOpponentCards <= cfg.attackOneAt + 1 &&
          sevenDiscardScore <= normalBestScore + 4) ||
        (sevenDiscardScore <= keepSevenThreshold && futurePenalty <= 0.7)
      ) {
        if (
          !(
            shouldKeepPair &&
            hand.filter((c) => c.rank === sevens[0].rank).length > 1
          )
        ) {
          return [sevens[0].id];
        }
      }
    }

    if (
      jacks.length > 0 &&
      sevens.length === 0 &&
      nextPlayerCards <= cfg.skipAt + (boost > 0.18 ? 2 : 0)
    ) {
      const jackDiscardScore = BotPlayer.scoreAfterDiscard(hand, [jacks[0]]);
      if (jackDiscardScore <= normalBestScore + 3 + (boost > 0.18 ? 2 : 0)) {
        return [jacks[0].id];
      }
    }

    if (
      minOpponentCards <= cfg.attackOneAt &&
      sevens.length > 0 &&
      currentTotal - 7 <= normalBestScore + 5
    ) {
      return [sevens[0].id];
    }

    if (
      oppPressure >= 0.45 &&
      sevens.length > 0 &&
      currentTotal - 7 <= normalBestScore + 8
    ) {
      return [sevens[0].id];
    }

    if (
      boost > 0.18 &&
      sevens.length > 0 &&
      currentTotal - 7 <= normalBestScore + 8
    ) {
      return [sevens[0].id];
    }

    if (normalBest.length > 0 && (!shouldKeepPair || normalBest.length === 1)) {
      return normalBest.map((c) => c.id);
    }

    if (discardOptions.length > 0) {
      return discardOptions[0].cards.map((c) => c.id);
    }

    if (sevens.length > 0) return [sevens[0].id];
    if (jacks.length > 0) return [jacks[0].id];

    const highest = hand.reduce(
      (h, c) =>
        DeckManager.getCardValue(c) > DeckManager.getCardValue(h) ? c : h,
      hand[0],
    );
    return [highest.id];
  }

  static shouldCallShow(
    state: GameState,
    botPlayerId: string,
    personality: BotPersonality = "smart",
    difficultyBoost = 0,
    opponents?: OpponentProfile[],
  ): boolean {
    const bot = state.players.find((p) => p.id === botPlayerId)!;
    const total = DeckManager.calculateHandTotal(bot.hand);
    const cfg = PERSONALITY[personality];
    const boost = BotPlayer.normalizeBoost(difficultyBoost);

    if (total <= 5) return true;
    if (total >= 9) return false;

    const confidence = BotPlayer.estimateShowConfidence(
      state,
      botPlayerId,
      personality,
      boost,
      opponents,
    );
    const oppSignals = BotPlayer.inferOpponentSignals(opponents);
    const threshold =
      0.56 -
      cfg.showBias * 0.12 -
      Math.min(0.24, boost * 0.18) +
      oppSignals.trapSignal * 0.08 -
      oppSignals.weakSignal * 0.04;
    const decision = confidence >= threshold;

    if (boost > 0.18 && total <= 8 && confidence >= threshold - 0.05) {
      return true;
    }

    if (personality === "bluff" && total <= 7) {
      if (oppSignals.fastShowSignal > 0.4) {
        return decision && Math.random() > 0.4;
      }
      return Math.random() > 0.3 ? decision : !decision;
    }
    return decision;
  }

  static decideAttackResponse(
    state: GameState,
    botPlayerId: string,
  ): { action: "throw" | "take"; cardIds?: string[] } {
    const bot = state.players.find((p) => p.id === botPlayerId)!;
    const sevens = bot.hand.filter((c) => c.rank === "7" && !c.isJoker);

    if (sevens.length > 0) {
      return { action: "throw", cardIds: sevens.map((c) => c.id) };
    }
    return { action: "take" };
  }

  static decide(
    state: GameState,
    botPlayerId: string,
    personality: BotPersonality = "smart",
    difficultyBoost = 0,
    opponents?: OpponentProfile[],
  ): BotDecision {
    const bot = state.players.find((p) => p.id === botPlayerId);
    if (!bot) return { action: "draw", source: "deck" };

    const bossMode =
      personality === "boss"
        ? BotPlayer.selectBossMode(state, botPlayerId, opponents)
        : "neutral";
    const effectivePersonality =
      personality === "boss"
        ? BotPlayer.bossPersonalityForMode(bossMode)
        : personality;

    if (
      state.attackChain &&
      state.attackChain.targetPlayerIndex === state.players.indexOf(bot)
    ) {
      const resp = BotPlayer.decideAttackResponse(state, botPlayerId);
      return resp.action === "throw"
        ? { action: "attack_throw", cardIds: resp.cardIds }
        : { action: "attack_take" };
    }

    if (
      !state.hasDrawnThisTurn &&
      BotPlayer.shouldCallShow(
        state,
        botPlayerId,
        effectivePersonality,
        difficultyBoost,
        opponents,
      )
    ) {
      return { action: "show" };
    }

    if (!state.hasDrawnThisTurn) {
      const topDiscard = state.discardPile[state.discardPile.length - 1];
      const isRealSeven = (c: Card) => c.rank === "7" && !c.isJoker;
      if (topDiscard && !isRealSeven(topDiscard) && !topDiscard.isJoker) {
        const matching = bot.hand.filter(
          (c) => !c.isJoker && c.rank === topDiscard.rank && !isRealSeven(c),
        );
        if (matching.length > 0) {
          const cutValue = matching.reduce(
            (s, c) => s + DeckManager.getCardValue(c),
            0,
          );
          if (cutValue >= 2) {
            return { action: "discard", cardIds: matching.map((c) => c.id) };
          }
        }
      }

      return {
        action: "draw",
        source: BotPlayer.decideDrawSource(
          state,
          botPlayerId,
          difficultyBoost,
          opponents,
        ),
      };
    }

    return {
      action: "discard",
      cardIds: BotPlayer.decideDiscard(
        state,
        botPlayerId,
        effectivePersonality,
        difficultyBoost,
        opponents,
      ),
    };
  }
}
