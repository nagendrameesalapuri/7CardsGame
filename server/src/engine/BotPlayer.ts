/**
 * BotPlayer — Strategic Pressure AI (v3).
 *
 * Architecture pillars:
 *  1. Opponent-Benefit Penalty  — every discard is scored for how much it
 *     helps the enemy, not just how much it helps us.
 *  2. Threat Level Engine       — LOW / MEDIUM / HIGH / CRITICAL drives all
 *     decisions; CRITICAL overrides normal optimisation.
 *  3. Show Interruption         — detects imminent SHOW and shifts every bot
 *     resource (7s, Js, discard denial) to prevention.
 *  4. Killer Instinct           — when an opponent is recovering or vulnerable
 *     the bot presses hard instead of playing safe.
 *  5. Discard Denial            — avoids feeding opponents Aces, 2s, 3s,
 *     jokers, or any card that completes their structure.
 *  6. Low-Score Stability       — recognises and preserves stable hands
 *     (0,1,2,3,7) rather than chasing theoretical minimums.
 *  7. Strategic 7 / J usage     — 7s are tempo weapons; Js are turn-deniers.
 *     Neither is wasted automatically.
 *  8. Multi-Turn Lookahead      — 2-turn future simulation for key decisions.
 *  9. Boss Pressure Modes       — six dynamic modes, switched per turn.
 * 10. Pressure Detection        — identifies panic-drawing / unstable opponents
 *     and increases aggression accordingly.
 */

import { GameState, Card, DrawSource } from "../../../shared/src/types";
import { DeckManager } from "./DeckManager";

export interface BotDecision {
  action: "draw" | "discard" | "show" | "attack_throw" | "attack_take";
  source?: DrawSource;
  cardIds?: string[];
}

export type BotPersonality =
  | "safe"
  | "aggressive"
  | "bluff"
  | "smart"
  | "boss"
  | "care";
export type PlayerArchetype =
  | "aggressive"
  | "defensive"
  | "combo_hoarder"
  | "fast_show"
  | "trap"
  | "hold_7s"
  | "panic_player"       // draws repeatedly, hand growing, never cuts — apply max pressure
  | "sacrifice_player"   // deliberately grows hand to shield teammate — target their partner
  | "recovery_baiter"    // fakes weakness to bait bot aggression, then surges — don't rush
  | "defensive_grinder"  // grinds for very low hand targets, rarely shows early — use traps
  | "unknown";

// ── NEW: Threat level ─────────────────────────────────────────────────────────
export type ThreatLevel = "low" | "medium" | "high" | "critical";

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
  | "anti_show"
  | "pressure_mode" // NEW: relentless pressure
  | "killer" // NEW: close out vulnerable opponents
  | "combo_preserve" // NEW: build while denying
  | "tempo_control"; // NEW: manipulate game rhythm

// ── Per-personality config ────────────────────────────────────────────────────

interface PersonalityConfig {
  thinkBaseMs: number;
  thinkJitterMs: number;
  showBias: number;
  riskTolerance: number;
  bluffFactor: number;
  attackAllAt: number;
  attackOneAt: number;
  skipAt: number;
  randomPlayChance: number;
  alwaysAttack: boolean;
  comboPreservation: number;
  pressureBias: number;
  tacticalVariance: number;
  // NEW fields
  denialWeight: number; // 0-1: how much to weight discard-denial vs self-optimisation
  killerInstinct: number; // 0-1: aggression multiplier when opponent is weak
  showInterruptBias: number; // bonus aggression when show threat is high
  sevenSaveThreshold: number; // save 7s until opponent hand ≤ this many cards
  jackUseBias: number; // 0-1: willingness to burn J for tempo denial
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
    randomPlayChance: 0.22,
    alwaysAttack: false,
    comboPreservation: 0.95,
    pressureBias: 0.18,
    tacticalVariance: 0.24,
    denialWeight: 0.28,
    killerInstinct: 0.15,
    showInterruptBias: 0.25,
    sevenSaveThreshold: 3,
    jackUseBias: 0.2,
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
    randomPlayChance: 0.06,
    alwaysAttack: true,
    comboPreservation: 0.28,
    pressureBias: 0.82,
    tacticalVariance: 0.08,
    denialWeight: 0.55,
    killerInstinct: 0.85,
    showInterruptBias: 0.7,
    sevenSaveThreshold: 6,
    jackUseBias: 0.7,
  },
  bluff: {
    thinkBaseMs: 700,
    thinkJitterMs: 680, // very wide jitter — creates psychological suspense
    showBias: -0.12,
    riskTolerance: 0.55,
    bluffFactor: 0.5,
    attackAllAt: 2,
    attackOneAt: 4,
    skipAt: 3,
    randomPlayChance: 0.2, // reduced from 0.32 — bluffing is intentional, not random
    alwaysAttack: false,
    comboPreservation: 0.6,
    pressureBias: 0.42,
    tacticalVariance: 0.28,
    denialWeight: 0.45,
    killerInstinct: 0.45,
    showInterruptBias: 0.55,
    sevenSaveThreshold: 4,
    jackUseBias: 0.5,
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
    randomPlayChance: 0.04, // ~1.2% effective sub-optimal rate (4% trigger × 30% chance to deviate)
    alwaysAttack: false,
    comboPreservation: 0.55,
    pressureBias: 0.62,
    tacticalVariance: 0.06,
    denialWeight: 0.65,
    killerInstinct: 0.6,
    showInterruptBias: 0.65,
    sevenSaveThreshold: 4,
    jackUseBias: 0.6,
  },
  boss: {
    thinkBaseMs: 200,
    thinkJitterMs: 180, // wider jitter for human-like feel
    showBias: 0.28,
    riskTolerance: 0.32,
    bluffFactor: 0.12,
    attackAllAt: 3,
    attackOneAt: 6,
    skipAt: 5,
    randomPlayChance: 0.05,
    alwaysAttack: true,
    comboPreservation: 0.65,
    pressureBias: 0.88,
    tacticalVariance: 0.1,
    denialWeight: 0.82,
    killerInstinct: 0.82, // reduced from 0.92 — controlled imperfection
    showInterruptBias: 0.9,
    sevenSaveThreshold: 5,
    jackUseBias: 0.8,
  },
  // Hyper-defensive: builds the lowest possible hand, never attacks, waits out opponents
  care: {
    thinkBaseMs: 950,
    thinkJitterMs: 420,
    showBias: -0.38,
    riskTolerance: 0.88,
    bluffFactor: 0.04,
    attackAllAt: 0,
    attackOneAt: 0,
    skipAt: 0,
    randomPlayChance: 0.12,
    alwaysAttack: false,
    comboPreservation: 0.97,
    pressureBias: 0.06,
    tacticalVariance: 0.1,
    denialWeight: 0.12,
    killerInstinct: 0.04,
    showInterruptBias: 0.12,
    sevenSaveThreshold: 2,
    jackUseBias: 0.08,
  },
};

const SHOW_CONFIDENCE_MIN = 0.28;
const SHOW_CONFIDENCE_MAX = 0.92;
const DISCARD_SAVE_THRESHOLD = 1;

// Per-personality maximum hand total at which SHOW is ever considered.
// Hard ceiling — confidence logic runs within this range.
const SHOW_HARD_MAX: Record<BotPersonality, number> = {
  safe: 5,
  aggressive: 7,
  bluff: 9,
  smart: 6,
  boss: 5,
  care: 4, // only shows when hand is extremely clean
};

// Low-value cards that are extremely useful to opponents if discarded
const DENIAL_PRIORITY_RANKS = new Set(["A", "2", "3"]);

// ── Emotional Pacing ──────────────────────────────────────────────────────────
// Tracks per-bot rhythm so boss doesn't apply constant suffocation pressure.
export type EmotionalPhase =
  | "building"
  | "pressure"
  | "cooldown"
  | "bait"
  | "surge";

// ── Emotional AI State ────────────────────────────────────────────────────────
// Psychological state that influences aggression, pacing, and decision style.
// Computed each turn from game signals — feels like a living opponent.
export type EmotionalAIState =
  | "confident"   // winning cleanly — slight overconfidence risk
  | "pressured"   // opponent threatening — heightened denial and defense
  | "baiting"     // deliberately passive to lure opponent into overcommitting
  | "frustrated"  // plans have failed repeatedly — aggression spike risk
  | "dominant"    // crushing the opponent — ego pressure + overconfidence
  | "cautious"    // early game or uncertain — safe, measured play
  | "chaotic";    // tilted or chaos-seeded — unpredictable, wide swings

// ── Dynamic Match Modifier ────────────────────────────────────────────────────
// Per-match overlay that subtly alters AI behaviour for replayability.
export type MatchModifier =
  | "none"
  | "chaos_storm"     // frequent random mode switches, wide hesitation swings
  | "slow_pressure"   // extended build phases, pressure arrives late but hard
  | "double_surge"    // surge phases doubled, cooldown shortened
  | "recovery_lock"   // anti-recovery surge windows are permanent
  | "hidden_tempo"    // think delay completely randomised (hard to read)
  | "anti_show_arena"; // heightened show-interruption throughout entire match

// ── Cross-Match Memory ────────────────────────────────────────────────────────
// Persists across games for the server lifetime (in-memory, reset on restart).
export interface CrossMatchProfile {
  userId:            string;
  matchesPlayed:     number;
  matchesWon:        number;            // matches this human won vs bots
  favoriteArchetype: PlayerArchetype | null;
  archetypeHistory:  PlayerArchetype[];  // last 5 archetypes seen
  recoveryStyle:     "fast" | "slow" | "unknown";
  showTiming:        "early" | "late"  | "balanced";
  lossStreak:        number;            // consecutive losses (human losing)
  winStreak:         number;            // consecutive wins (human winning)
  timesBeatenBoss:   number;            // how many times this human defeated a boss
  totalBaitTrapsFired:    number;       // how many bait traps were used against them
  totalConditioningCycles: number;
  lastSeen:          number;            // Date.now()
}

// ── Rivalry Record ────────────────────────────────────────────────────────────
export interface RivalryRecord {
  opponentUserId: string;
  humanWins:      number;  // human beat a bot with this botPlayerId's personality
  botWins:        number;
  revengePressure: boolean; // active when humanWins >= 2
  lastMatchResult: "human_won" | "bot_won" | "unknown";
}

export interface BotMatchContext {
  consecutivePressureTurns: number; // turns in a row at high aggression
  emotionalPhase: EmotionalPhase;
  matchVariantSeed: number; // 0-1, rolled once per match for replayability
  turnCount: number;
  pressureTurnsThisRound: number;
  lastImperfectionTurn: number; // last turn boss chose sub-optimal line
  farmingIndicator: number; // 0-1: suspicion the human is exploiting patterns
  // v2: Anti-pattern detection
  antiPatternMode: boolean;
  archetypeConsistency: Partial<Record<string, number>>;
  lastDetectedArchetype: Partial<Record<string, PlayerArchetype>>;
  // v2: Recovery tracking
  recoveryDetected: boolean;
  recoveryTurnStart: number;
  // v2: Solo telemetry
  pressureTurnsTotal: number;
  showHandTotals: number[];
  // v3: Emotional AI State
  emotionalState: EmotionalAIState;
  emotionalStateAge: number;        // turns in current emotional state
  frustrationLevel: number;         // 0-1: accumulates when plays fail
  egoScore: number;                 // 0-1: confidence after winning streaks
  dominanceScore: number;           // 0-1: how much bot is winning right now
  // v3: Dynamic match modifier
  matchModifier: MatchModifier;
  // v3: Human conditioning
  conditioningState: "off" | "allowing" | "punishing";
  conditioningAllowTurns: number;   // turns we've let human recover safely
  conditioningBehavior: PlayerArchetype | null; // behavior we're conditioning against
  conditioningPunishArmed: boolean;
  // v3: Rivalry & revenge
  revengeModeActive: boolean;
  revengeTargetId: string | null;
  // v3: Personality quirk state
  quirk_egoStreak: number;          // aggressive: turns winning in a row
  quirk_fakeWeakArmed: boolean;     // bluff: fake weakness trap is ready
  quirk_patienceCounter: number;    // smart: turns accumulating before striking
  quirk_intimidationReady: boolean; // boss: long pause before decisive play
}

// ─────────────────────────────────────────────────────────────────────────────

export class BotPlayer {
  // ── Per-bot Match Context (keyed by botPlayerId) ──────────────────────────
  private static readonly ctxMap = new Map<string, BotMatchContext>();
  private static readonly crossMatchProfiles = new Map<string, CrossMatchProfile>();
  private static readonly rivalryMap = new Map<string, RivalryRecord>();

  static initBotContext(botPlayerId: string): void {
    const seed = Math.random();
    BotPlayer.ctxMap.set(botPlayerId, {
      consecutivePressureTurns: 0,
      emotionalPhase: "building",
      matchVariantSeed: seed,
      turnCount: 0,
      pressureTurnsThisRound: 0,
      lastImperfectionTurn: -10,
      farmingIndicator: 0,
      antiPatternMode: false,
      archetypeConsistency: {},
      lastDetectedArchetype: {},
      recoveryDetected: false,
      recoveryTurnStart: 0,
      pressureTurnsTotal: 0,
      showHandTotals: [],
      // v3: Emotional AI State
      emotionalState: "cautious",
      emotionalStateAge: 0,
      frustrationLevel: 0,
      egoScore: 0,
      dominanceScore: 0,
      // v3: Dynamic match modifier
      matchModifier: BotPlayer.selectMatchModifier(seed),
      // v3: Human conditioning
      conditioningState: "off",
      conditioningAllowTurns: 0,
      conditioningBehavior: null,
      conditioningPunishArmed: false,
      // v3: Rivalry & revenge
      revengeModeActive: false,
      revengeTargetId: null,
      // v3: Personality quirk state
      quirk_egoStreak: 0,
      quirk_fakeWeakArmed: false,
      quirk_patienceCounter: 0,
      quirk_intimidationReady: false,
    });
  }

  private static getCtx(botPlayerId: string): BotMatchContext {
    if (!BotPlayer.ctxMap.has(botPlayerId))
      BotPlayer.initBotContext(botPlayerId);
    return BotPlayer.ctxMap.get(botPlayerId)!;
  }

  private static updateCtx(
    botPlayerId: string,
    updates: Partial<BotMatchContext>,
  ): void {
    const ctx = BotPlayer.getCtx(botPlayerId);
    BotPlayer.ctxMap.set(botPlayerId, { ...ctx, ...updates });
  }

  static cleanupBotContext(botPlayerId: string): void {
    BotPlayer.ctxMap.delete(botPlayerId);
  }

  // ── Utility ──────────────────────────────────────────────────────────────────

  private static normalizeBoost(difficultyBoost = 0): number {
    return Math.min(0.35, Math.max(0, difficultyBoost));
  }

  static getThinkDelay(
    personality: BotPersonality = "smart",
    difficultyBoost = 0,
    botPlayerId?: string,
  ): number {
    const cfg = PERSONALITY[personality];
    const boost = BotPlayer.normalizeBoost(difficultyBoost);
    const baseDelay = cfg.thinkBaseMs + Math.random() * cfg.thinkJitterMs;
    let delay = Math.max(350, baseDelay - boost * 300);

    // Bluff: occasional fake hesitation spike (deliberate pause to mislead timing reads)
    if (personality === "bluff" && Math.random() < 0.18) {
      delay += 600 + Math.random() * 800; // 600-1400ms extra — feels like "thinking hard"
    }

    // Boss: occasional "deliberation" pause to feel human, not robotic
    if (personality === "boss" && Math.random() < 0.1) {
      delay += 400 + Math.random() * 500;
    }

    // Context-aware timing adjustments
    if (botPlayerId) {
      const ctx = BotPlayer.getCtx(botPlayerId);
      // Anti-pattern mode: random deep-think fake hesitation to mislead timing reads
      if (ctx.antiPatternMode && Math.random() < 0.22) {
        delay += 500 + Math.random() * 700;
      }
      // Boss/bluff: deliberate slowdown during bait/cooldown phases
      if (personality === "boss" || personality === "bluff") {
        if (ctx.emotionalPhase === "cooldown" || ctx.emotionalPhase === "bait") {
          delay += 300 + Math.random() * 400;
        }
      }
      // v3: hidden_tempo modifier — completely randomise delay (unreadable rhythm)
      if (ctx.matchModifier === "hidden_tempo") {
        delay = 200 + Math.random() * 2000;
      }
      // v3: Boss intimidation quirk — long pause before decisive play
      if (personality === "boss" && ctx.quirk_intimidationReady) {
        delay += 800 + Math.random() * 1200;
      }
      // v3: Frustrated emotional state — faster, more erratic
      if (ctx.emotionalState === "frustrated") {
        delay = Math.max(180, delay - 200 + Math.random() * 400);
      }
    }

    return Math.round(delay);
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
      for (const card of group) candidates.push([card]);
      if (group.length > 1) {
        candidates.push(group);
        if (group.length >= 3) {
          for (let i = 0; i < group.length; i++)
            for (let j = i + 1; j < group.length; j++)
              candidates.push([group[i], group[j]]);
        }
      }
    }
    return candidates;
  }

  private static performanceDiscardOptions(
    hand: Card[],
  ): Array<{ cards: Card[]; score: number; comboCount: number }> {
    const candidates = BotPlayer.buildDiscardCandidates(hand);
    return candidates
      .map((cards) => ({
        cards,
        score: BotPlayer.scoreAfterDiscard(hand, cards),
        comboCount: new Set(cards.map((c) => c.rank)).size,
      }))
      .sort((a, b) => a.score - b.score || a.cards.length - b.cards.length);
  }

  private static bestReductionDiscard(hand: Card[]): {
    cards: Card[];
    score: number;
  } {
    const isRealPower = (c: Card) =>
      !c.isJoker && (c.rank === "7" || c.rank === "J");
    const normalCards = hand.filter((c) => !isRealPower(c));
    const candidates = BotPlayer.buildDiscardCandidates(normalCards);
    const currentTotal = DeckManager.calculateHandTotal(hand);
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
      if (!card.isJoker) byRank[card.rank] = (byRank[card.rank] || 0) + 1;
    }
    return Object.values(byRank).reduce(
      (sum, count) => sum + Math.max(0, count - 1),
      0,
    );
  }

  // ── NEW: Low-Score Stability Evaluation ──────────────────────────────────────
  // A hand of [0,1,2,3,7] is MORE stable than [0,0,10,10] even though totals differ.
  // Measures how many cards are individually safe (≤3 pts each) plus joker/2/3 bonuses.
  private static evaluateLowScoreStability(hand: Card[]): number {
    let stability = 0;
    let lowCards = 0;
    let hasJoker = false;
    for (const c of hand) {
      const v = DeckManager.getCardValue(c);
      if (c.isJoker) {
        stability += 3.5;
        hasJoker = true;
        continue;
      }
      if (v === 0) {
        stability += 3.0;
        continue;
      } // paper joker
      if (v <= 1) {
        stability += 2.5;
        lowCards++;
        continue;
      }
      if (v <= 2) {
        stability += 2.0;
        lowCards++;
        continue;
      }
      if (v <= 3) {
        stability += 1.5;
        lowCards++;
        continue;
      }
      if (v <= 5) {
        stability += 0.8;
        continue;
      }
      // high cards hurt stability
      stability -= (v - 5) * 0.3;
    }
    // Bonus: having 3+ low cards means strong show structure
    if (lowCards >= 3) stability += 1.5;
    if (hasJoker && lowCards >= 2) stability += 1.0;
    return Math.max(0, stability);
  }

  // ── NEW: Opponent Benefit Score ───────────────────────────────────────────────
  // Returns how much a discarded card would help the opponent.
  // Higher = more dangerous to discard.
  private static opponentBenefitScore(
    card: Card,
    opponentProfiles?: OpponentProfile[],
  ): number {
    const v = DeckManager.getCardValue(card);
    let score = 0;

    // Jokers are pure gold for any opponent
    if (card.isJoker) return 4.0;
    // Paper joker (value 0)
    if (v === 0) return 3.5;

    // Low-value cards are structurally dangerous to give away
    if (v === 1)
      score += 2.8; // Ace
    else if (v === 2)
      score += 2.2; // 2
    else if (v === 3)
      score += 1.7; // 3
    else if (v === 4) score += 1.1;
    else if (v === 5) score += 0.6;
    else if (v <= 7) score += 0.3;
    // High cards (8+) are generally fine to discard
    else score += 0;

    // 7s are tempo weapons — never give them away if threat is high
    if (card.rank === "7" && !card.isJoker) score += 1.5;

    // If opponents have been cutting this rank, it completes their pair
    if (opponentProfiles) {
      for (const opp of opponentProfiles) {
        if (opp.recentCuts >= 2) {
          // They're cutting aggressively — any rank might help structure them
          score += 0.4;
        }
        // Fewer cards = any useful card is a bigger threat
        if (opp.handCount <= 4) score += 0.5;
        if (opp.handCount <= 2) score += 1.0;
      }
    }

    return score;
  }

  // ── NEW: Threat Level Engine ──────────────────────────────────────────────────
  private static computeThreatLevel(
    state: GameState,
    botPlayerId: string,
    opponents?: OpponentProfile[],
  ): ThreatLevel {
    const allOpps = state.players.filter(
      (p) => !p.isEliminated && p.id !== botPlayerId,
    );
    if (allOpps.length === 0) return "low";

    const minCards = Math.min(...allOpps.map((p) => p.handCount));
    const showPressure = BotPlayer.estimateOpponentShowPressure(opponents);
    const showThreat = BotPlayer.detectShowThreat(
      state,
      botPlayerId,
      opponents,
    );

    if (minCards <= 2 || showPressure >= 0.75 || showThreat >= 0.85)
      return "critical";
    if (minCards <= 4 || showPressure >= 0.5 || showThreat >= 0.6)
      return "high";
    if (minCards <= 6 || showPressure >= 0.3 || showThreat >= 0.35)
      return "medium";
    return "low";
  }

  // ── NEW: Show Interruption Engine ─────────────────────────────────────────────
  // Returns 0-1: probability that an opponent is about to call SHOW.
  private static detectShowThreat(
    state: GameState,
    botPlayerId: string,
    opponents?: OpponentProfile[],
  ): number {
    // Consider ALL players (including bots) — in Stage 5, smart/aggressive bots
    // can also be about to show, so boss must react to them too.
    const allOpps = state.players.filter(
      (p) => !p.isEliminated && p.id !== botPlayerId,
    );
    if (allOpps.length === 0) return 0;

    let maxThreat = 0;
    for (const player of allOpps) {
      let threat = 0;
      // Very few cards = close to SHOW
      if (player.handCount <= 2) threat += 0.5;
      else if (player.handCount <= 3) threat += 0.35;
      else if (player.handCount <= 4) threat += 0.2;

      // Behavior profile is only tracked for human players
      if (!player.isBot && opponents) {
        const opp = opponents.find((o) => o.userId === player.userId);
        if (opp) {
          threat += opp.recentShows * 0.12;
          if (opp.recentCuts >= 3) threat += 0.2;
          else if (opp.recentCuts >= 2) threat += 0.12;
          if (opp.recentDraws <= 1 && opp.recentCuts >= 2) threat += 0.15;
          if (opp.archetype === "fast_show") threat += 0.25;
          if (opp.archetype === "combo_hoarder") threat += 0.1;
          const hist = opp.handCountHistory;
          if (hist.length >= 3) {
            const shrinking = hist[hist.length - 1] < hist[0];
            if (shrinking) threat += 0.1;
          }
        }
      }

      maxThreat = Math.max(maxThreat, Math.min(1, threat));
    }
    return maxThreat;
  }

  // ── NEW: Killer Instinct Detection ───────────────────────────────────────────
  // Returns true when the bot should abandon optimisation and go for the kill.
  private static killerInstinctActive(
    state: GameState,
    botPlayerId: string,
    personality: BotPersonality,
    opponents?: OpponentProfile[],
  ): boolean {
    const cfg = PERSONALITY[personality];
    if (cfg.killerInstinct < 0.4) return false;

    const signals = BotPlayer.inferOpponentSignals(opponents);
    const bot = state.players.find((p) => p.id === botPlayerId)!;
    const botTotal = DeckManager.calculateHandTotal(bot.hand);

    // We're in a strong position AND opponent is weak
    const botStrong = botTotal <= 8;
    const oppWeak = signals.weakSignal >= 0.4;

    // Opponent is recovering after taking penalty cards
    const oppRecovering =
      opponents?.some((o) => o.recentAttackTakes >= 1 && o.handCount >= 5) ??
      false;

    if (botStrong && (oppWeak || oppRecovering)) {
      return Math.random() < cfg.killerInstinct;
    }
    return false;
  }

  // ── NEW: Pressure Detection ───────────────────────────────────────────────────
  // Detects if an opponent is in a panic/unstable state.
  private static detectPressureState(opponents?: OpponentProfile[]): {
    isPanicking: boolean;
    isUnstable: boolean;
    recoveryTarget?: string;
  } {
    if (!opponents) return { isPanicking: false, isUnstable: false };

    for (const opp of opponents) {
      // Panic draw: many draws, few cuts, no shows
      const panicDraw =
        opp.recentDraws >= 4 && opp.recentCuts <= 1 && opp.recentShows === 0;
      // Unstable: took attack cards recently and hand count jumped
      const hist = opp.handCountHistory;
      const handJump =
        hist.length >= 2 && hist[hist.length - 1] - hist[hist.length - 2] >= 2;
      const unstable = opp.recentAttackTakes >= 1 || handJump;

      if (panicDraw)
        return {
          isPanicking: true,
          isUnstable: unstable,
          recoveryTarget: opp.userId,
        };
      if (unstable)
        return {
          isPanicking: false,
          isUnstable: true,
          recoveryTarget: opp.userId,
        };
    }
    return { isPanicking: false, isUnstable: false };
  }

  // ── NEW: Multi-Turn Lookahead ─────────────────────────────────────────────────
  // Simulates 2 turns forward to see if keeping a card leads to a SHOW opportunity.
  private static multiTurnLookahead(
    hand: Card[],
    candidateDiscard: Card[],
  ): { showIn2Turns: boolean; projectedScore: number } {
    const remainingAfterDiscard = hand.filter(
      (c) => !candidateDiscard.some((d) => d.id === c.id),
    );

    // Simulate best discard on turn 2 (from remaining hand)
    const t2best = BotPlayer.bestReductionDiscard(remainingAfterDiscard);
    const projectedScore = t2best.score;

    // If we could show after one more discard, this is a strong line
    const showIn2Turns = projectedScore <= 5;
    return { showIn2Turns, projectedScore };
  }

  // ── Opponent Signal Inference ─────────────────────────────────────────────────

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

    let weakSignal = 0,
      trapSignal = 0,
      fastShowSignal = 0,
      aggressiveSignal = 0,
      defensiveSignal = 0;

    for (const opp of opponents) {
      const aggressiveScore =
        opp.recentAttackThrows - opp.recentAttackTakes + opp.recentDraws * 0.2;
      const defensiveScore =
        opp.recentAttackTakes - opp.recentAttackThrows + opp.recentShows * 0.15;
      const showScore = opp.recentShows + opp.recentCuts * 0.4;
      const trapScore =
        opp.handCountHistory.length > 0
          ? opp.handCountHistory.reduce((s, v) => s + v, 0) /
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

    const n = opponents.length;
    return {
      weakSignal: Math.min(1, weakSignal / n),
      trapSignal: Math.min(1, trapSignal / n),
      fastShowSignal: Math.min(1, fastShowSignal / n),
      aggressiveSignal: Math.min(1, aggressiveSignal / n),
      defensiveSignal: Math.min(1, defensiveSignal / n),
    };
  }

  private static estimateOpponentShowPressure(opponents?: OpponentProfile[]) {
    const signals = BotPlayer.inferOpponentSignals(opponents);
    return signals.fastShowSignal * 0.6 + signals.trapSignal * 0.2;
  }

  // ── Threat Assessment ─────────────────────────────────────────────────────────

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

  // ── Boss Personality Switching ────────────────────────────────────────────────

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
      case "pressure_mode":
        return "aggressive";
      case "killer":
        return "aggressive";
      case "combo_preserve":
        return "smart";
      case "tempo_control":
        return "smart";
      default:
        return "boss";
    }
  }

  // ── NEW: Emotional Phase Transition ─────────────────────────────────────────
  // Advances the emotional pacing state machine each turn.
  private static advanceEmotionalPhase(
    ctx: BotMatchContext,
    chosenMode: BossSubpersonality,
  ): Partial<BotMatchContext> {
    const isAggressive =
      chosenMode === "killer" ||
      chosenMode === "pressure_mode" ||
      chosenMode === "anti_show" ||
      chosenMode === "aggressive";

    let { consecutivePressureTurns, emotionalPhase, pressureTurnsThisRound } =
      ctx;

    if (isAggressive) {
      consecutivePressureTurns++;
      pressureTurnsThisRound++;
    } else {
      consecutivePressureTurns = Math.max(0, consecutivePressureTurns - 1);
    }

    // Phase state machine
    switch (emotionalPhase) {
      case "building":
        if (consecutivePressureTurns >= 2) emotionalPhase = "pressure";
        break;
      case "pressure":
        // After 3 consecutive pressure turns, enter cooldown
        if (consecutivePressureTurns >= 3) emotionalPhase = "cooldown";
        break;
      case "cooldown":
        // One turn of cooldown, then bait
        emotionalPhase = "bait";
        consecutivePressureTurns = 0;
        break;
      case "bait":
        // 30% chance to extend bait one more turn — unpredictable surge timing
        if (Math.random() < 0.3) break;
        emotionalPhase = "surge";
        break;
      case "surge":
        // Surge lasts 1-2 turns then resets
        if (consecutivePressureTurns >= 2) emotionalPhase = "building";
        break;
    }

    return { consecutivePressureTurns, emotionalPhase, pressureTurnsThisRound };
  }

  // ── NEW: Controlled Imperfection ─────────────────────────────────────────────
  // Boss occasionally picks a sub-optimal line so it feels human, not robotic.
  // Returns the index into the scored options array to pick (0 = best, 1 = 2nd best).
  private static controlledImperfection(
    personality: BotPersonality,
    ctx: BotMatchContext,
    optionCount: number,
  ): number {
    if (optionCount <= 1) return 0;

    // Boss: 15% chance to pick 2nd best, but only if not done recently
    if (
      personality === "boss" &&
      ctx.turnCount - ctx.lastImperfectionTurn >= 3
    ) {
      if (Math.random() < 0.15) return 1;
    }
    // Smart: 4% chance to pick from top-2 (anti-determinism)
    if (personality === "smart" && Math.random() < 0.04) {
      return Math.random() < 0.7 ? 0 : 1;
    }
    return 0;
  }

  // ── NEW: Bluff Tactical Line ──────────────────────────────────────────────────
  // Instead of random bad moves, bluff bot makes intentional "tells" — discards a
  // card that looks weak but serves a strategic deception purpose.
  private static bluffTacticalLine(
    hand: Card[],
    discardOptions: Array<{ cards: Card[]; score: number }>,
    ctx: BotMatchContext,
  ): string[] | null {
    // Only execute a bluff line 20% of turns (not random — phase-gated)
    if (Math.random() >= 0.2) return null;

    // Fake weakness: discard a card from a pair (as if we're unaware of its value)
    // This baits opponent into thinking our hand is bad
    const byRank: Record<string, Card[]> = {};
    for (const c of hand) {
      if (!c.isJoker && c.rank !== "7" && c.rank !== "J") {
        if (!byRank[c.rank]) byRank[c.rank] = [];
        byRank[c.rank].push(c);
      }
    }

    // Find a medium-value pair (5-8 pts) — discard one card from it to look scattered
    const mediumPair = Object.values(byRank).find(
      (group) =>
        group.length >= 2 &&
        DeckManager.getCardValue(group[0]) >= 5 &&
        DeckManager.getCardValue(group[0]) <= 8,
    );
    if (mediumPair) return [mediumPair[0].id]; // discard one, keep the other (fake scatter)

    // Delayed show bluff: keep best option but delay by discarding 2nd-best instead
    if (discardOptions.length >= 3 && Math.random() < 0.4) {
      const idx = ctx.emotionalPhase === "bait" ? 2 : 1; // deeper fake when baiting
      return discardOptions[Math.min(idx, discardOptions.length - 1)].cards.map(
        (c) => c.id,
      );
    }

    return null;
  }

  // ── NEW: Match-Variant Personality Config ────────────────────────────────────
  // Returns a PersonalityConfig with match-seed-based adjustments so each match
  // feels different without exposing a new BotPersonality enum value.
  private static getVariantConfig(
    personality: BotPersonality,
    seed: number,
  ): PersonalityConfig {
    const base = { ...PERSONALITY[personality] };

    if (personality === "aggressive") {
      if (seed < 0.25)
        return { ...base, pressureBias: Math.min(1, base.pressureBias + 0.1), attackAllAt: base.attackAllAt + 1, attackOneAt: base.attackOneAt + 1, killerInstinct: 0.95 };
      if (seed < 0.5)
        return { ...base, randomPlayChance: 0.28, tacticalVariance: 0.22, bluffFactor: 0.28, thinkJitterMs: 450 };
      if (seed < 0.75)
        return { ...base, jackUseBias: 0.88, sevenSaveThreshold: 7, skipAt: 4, denialWeight: 0.65 };
      return { ...base, denialWeight: 0.78, showInterruptBias: 0.9, killerInstinct: 0.72 };
    }

    if (personality === "smart") {
      if (seed < 0.25)
        return { ...base, randomPlayChance: 0.01, tacticalVariance: 0.02, bluffFactor: 0.02, thinkBaseMs: base.thinkBaseMs + 200 };
      if (seed < 0.5)
        return { ...base, comboPreservation: 0.78, bluffFactor: 0.22, attackAllAt: 1, denialWeight: 0.72 };
      if (seed < 0.75)
        return { ...base, showBias: 0.3, riskTolerance: 0.3, pressureBias: 0.78, killerInstinct: 0.72 };
      return { ...base, denialWeight: 0.88, killerInstinct: 0.72, showInterruptBias: 0.78 };
    }

    if (personality === "boss") {
      if (seed < 0.25)
        return { ...base, killerInstinct: 0.95, attackAllAt: 4, attackOneAt: 7, pressureBias: 0.95 };
      if (seed < 0.5)
        return { ...base, denialWeight: 0.92, jackUseBias: 0.88, comboPreservation: 0.75 };
      if (seed < 0.75)
        return { ...base, randomPlayChance: 0.03, showInterruptBias: 0.94, pressureBias: 0.92 };
      return { ...base, randomPlayChance: 0.18, tacticalVariance: 0.25, bluffFactor: 0.22, thinkJitterMs: 350 };
    }

    return base;
  }

  // ── NEW: Farming Pattern Detection ────────────────────────────────────────────
  // Tracks when an opponent uses the same archetype strategy for 3+ consecutive turns.
  // Increments farmingIndicator → triggers antiPatternMode so the bot breaks its own
  // predictable responses.
  private static updateFarmingDetection(
    opponents: OpponentProfile[] | undefined,
    ctx: BotMatchContext,
  ): Partial<BotMatchContext> {
    if (!opponents || opponents.length === 0) {
      return { farmingIndicator: Math.max(0, ctx.farmingIndicator - 0.02) };
    }

    const updatedConsistency = { ...ctx.archetypeConsistency };
    const updatedLastArchetype = { ...ctx.lastDetectedArchetype };
    let farmingIndicator = ctx.farmingIndicator;

    for (const opp of opponents) {
      if (!opp.archetype || opp.archetype === "unknown") continue;

      const last = updatedLastArchetype[opp.userId];
      if (last === opp.archetype) {
        updatedConsistency[opp.userId] = (updatedConsistency[opp.userId] ?? 0) + 1;
      } else {
        updatedConsistency[opp.userId] = 1;
        updatedLastArchetype[opp.userId] = opp.archetype;
      }

      const consistency = updatedConsistency[opp.userId] ?? 0;
      if (consistency >= 3)
        farmingIndicator = Math.min(1, farmingIndicator + 0.08);
      else if (consistency < 2)
        farmingIndicator = Math.max(0, farmingIndicator - 0.04);
    }

    farmingIndicator = Math.max(0, farmingIndicator - 0.02);

    return {
      farmingIndicator,
      antiPatternMode: farmingIndicator > 0.5,
      archetypeConsistency: updatedConsistency,
      lastDetectedArchetype: updatedLastArchetype,
    };
  }

  // ── NEW: Human Recovery Detection ─────────────────────────────────────────────
  // Returns true when an opponent was under heavy pressure but is now stabilizing.
  // Triggers an anti-recovery surge so they can't safely rebuild.
  private static detectHumanRecovery(
    opponents: OpponentProfile[] | undefined,
  ): boolean {
    if (!opponents || opponents.length === 0) return false;

    for (const opp of opponents) {
      const hist = opp.handCountHistory;
      if (hist.length < 3) continue;

      const current = hist[hist.length - 1];
      const peak = Math.max(...hist);
      const wasUnderPressure = peak >= 7;
      const nowRecovering = peak - current >= 2;
      const stillVulnerable = current >= 5;

      if (wasUnderPressure && nowRecovering && stillVulnerable) return true;

      if (opp.recentAttackTakes >= 1 && hist.length >= 2) {
        const prev = hist[hist.length - 2];
        if (prev > current && current >= 4) return true;
      }
    }
    return false;
  }

  // ── NEW: Variant-weighted Boss Mode ──────────────────────────────────────────
  // Each match has a random seed that biases boss toward certain styles,
  // ensuring the same strategy doesn't work every match.
  private static variantBiasedMode(
    baseMode: BossSubpersonality,
    seed: number,
    emotionalPhase: EmotionalPhase,
  ): BossSubpersonality {
    // Chaos boss (seed >= 0.75): 30% chance to pick a completely random mode.
    // Creates genuine unpredictability — humans cannot pattern-match this boss.
    if (seed >= 0.75 && Math.random() < 0.3) {
      const allModes: BossSubpersonality[] = [
        "aggressive", "defensive", "trap", "anti_show",
        "pressure_mode", "killer", "combo_preserve", "tempo_control",
      ];
      return allModes[Math.floor(Math.random() * allModes.length)];
    }

    // Cooldown: mostly defensive, but Punisher variant occasionally fake-cooldowns
    if (emotionalPhase === "cooldown") {
      return seed < 0.25 && Math.random() < 0.25 ? "killer" : "defensive";
    }
    // Bait: mostly passive, but Punisher can skip the bait and surge early (feint)
    if (emotionalPhase === "bait") {
      return seed < 0.25 && Math.random() < 0.35 ? "aggressive" : "combo_preserve";
    }
    if (emotionalPhase === "surge") return baseMode;

    // Seed-flavored bias:
    // 0.00-0.25: Punisher  — favors killer + anti_show
    // 0.25-0.50: Tactician — favors tempo_control + trap
    // 0.50-0.75: Pressurer — favors pressure_mode + aggressive
    // 0.75-1.00: Chaos     — already handled above
    if (seed < 0.25) {
      if (baseMode === "neutral" || baseMode === "pressure_mode") return "killer";
      if (baseMode === "combo_preserve") return "anti_show";
    } else if (seed < 0.5) {
      if (baseMode === "killer") return "tempo_control";
      if (baseMode === "pressure_mode") return "trap";
    } else if (seed < 0.75) {
      if (baseMode === "defensive") return "pressure_mode";
      if (baseMode === "combo_preserve") return "aggressive";
    }
    return baseMode;
  }

  private static selectBossMode(
    state: GameState,
    botPlayerId: string,
    opponents?: OpponentProfile[],
  ): BossSubpersonality {
    const ctx = BotPlayer.getCtx(botPlayerId);
    const signals = BotPlayer.inferOpponentSignals(opponents);
    const bot = state.players.find((p) => p.id === botPlayerId)!;
    const botTotal = DeckManager.calculateHandTotal(bot.hand);
    const showThreat = BotPlayer.detectShowThreat(
      state,
      botPlayerId,
      opponents,
    );
    const pressureState = BotPlayer.detectPressureState(opponents);
    // Include all opponents (not just humans) so boss reacts when smart/aggressive bots close in
    const bestOpp = state.players
      .filter((p) => p.id !== botPlayerId && !p.isEliminated)
      .reduce((min, p) => Math.min(min, p.handCount), Infinity);

    // Cooldown / bait phases reduce aggression — creates pacing windows
    if (ctx.emotionalPhase === "cooldown") return "defensive";
    if (ctx.emotionalPhase === "bait") return "combo_preserve";

    // Anti-farming: when human exploits the same strategy repeatedly, counter it
    if (ctx.antiPatternMode) {
      const dominantArch = Object.values(ctx.lastDetectedArchetype)[0];
      if (dominantArch === "fast_show" || signals.fastShowSignal >= 0.4) {
        return BotPlayer.variantBiasedMode("anti_show", ctx.matchVariantSeed, ctx.emotionalPhase);
      }
      if (dominantArch === "panic_player" || signals.weakSignal >= 0.5) {
        return BotPlayer.variantBiasedMode("pressure_mode", ctx.matchVariantSeed, ctx.emotionalPhase);
      }
      if (dominantArch === "defensive_grinder" || dominantArch === "recovery_baiter") {
        return BotPlayer.variantBiasedMode("trap", ctx.matchVariantSeed, ctx.emotionalPhase);
      }
      // Generic: cycle unpredictable modes so human can't exploit one pattern
      const antiModes: BossSubpersonality[] = ["killer", "tempo_control", "anti_show", "trap", "aggressive"];
      return antiModes[ctx.turnCount % antiModes.length];
    }

    // Critical SHOW threat overrides everything (even surge)
    if (showThreat >= 0.7 || signals.fastShowSignal >= 0.5) {
      return BotPlayer.variantBiasedMode(
        "anti_show",
        ctx.matchVariantSeed,
        ctx.emotionalPhase,
      );
    }

    // Kill a vulnerable recovering opponent
    if (pressureState.isUnstable && botTotal <= 10) {
      return BotPlayer.variantBiasedMode(
        "killer",
        ctx.matchVariantSeed,
        ctx.emotionalPhase,
      );
    }

    // Panic opponent — apply relentless pressure
    if (pressureState.isPanicking) {
      return BotPlayer.variantBiasedMode(
        "pressure_mode",
        ctx.matchVariantSeed,
        ctx.emotionalPhase,
      );
    }

    // Opponent has trap setup — control tempo
    if (signals.trapSignal >= 0.5 && botTotal >= 8) {
      return BotPlayer.variantBiasedMode(
        "tempo_control",
        ctx.matchVariantSeed,
        ctx.emotionalPhase,
      );
    }

    // Opponent is aggressive — go defensive then counter
    if (signals.aggressiveSignal >= 0.6) return "defensive";

    // We're strong and opponent is close to showing — rush them
    if (bestOpp <= 3 && botTotal <= 10) {
      return BotPlayer.variantBiasedMode(
        "aggressive",
        ctx.matchVariantSeed,
        ctx.emotionalPhase,
      );
    }

    // We're strong and opponents are weak — killer instinct
    if (botTotal <= 6 && signals.weakSignal >= 0.3) {
      return BotPlayer.variantBiasedMode(
        "killer",
        ctx.matchVariantSeed,
        ctx.emotionalPhase,
      );
    }

    // We're in a good position but need to build — preserve combos
    if (botTotal >= 12 && signals.trapSignal >= 0.4) return "combo_preserve";

    // Surge phase: maximum spike after bait window
    if (ctx.emotionalPhase === "surge") {
      return BotPlayer.variantBiasedMode(
        "killer",
        ctx.matchVariantSeed,
        ctx.emotionalPhase,
      );
    }

    // Default: pressure (variant-weighted per match)
    const defaultMode = botTotal <= 9 ? "pressure_mode" : "neutral";
    return BotPlayer.variantBiasedMode(
      defaultMode,
      ctx.matchVariantSeed,
      ctx.emotionalPhase,
    );
  }

  // ── Show Confidence ───────────────────────────────────────────────────────────

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
    const stability = BotPlayer.evaluateLowScoreStability(bot.hand) * 0.03;

    let score = 1 - total / 18;
    score += (8 - total) * 0.03;
    score += comboBonus + stability;
    score += cfg.showBias;
    score += Math.min(0.16, boost * 0.18);
    score -= futurePotential * 0.02;
    score -= cfg.riskTolerance * 0.08;

    const { minOpponentCards } = BotPlayer.assessThreat(state, botPlayerId);
    const oppSignals = BotPlayer.inferOpponentSignals(opponents);
    const showThreat = BotPlayer.detectShowThreat(
      state,
      botPlayerId,
      opponents,
    );

    // Show sooner when opponent is close to showing
    if (minOpponentCards <= 3) score += cfg.pressureBias * 0.08;
    if (showThreat >= 0.6) score += 0.12; // race condition — show before they do

    score += oppSignals.weakSignal * 0.08;
    score -= oppSignals.fastShowSignal * 0.08;
    score -= oppSignals.trapSignal * 0.06;
    if (total >= 12) score -= 0.14;
    if (total >= 10) score -= 0.08;
    if (personality === "bluff") score -= cfg.bluffFactor * 0.12;

    return Math.min(SHOW_CONFIDENCE_MAX, Math.max(SHOW_CONFIDENCE_MIN, score));
  }

  // ── Draw Source Decision ──────────────────────────────────────────────────────

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

    // Never take real 7s or Jacks from discard — they're tempo weapons best kept unknown
    if (
      !topDiscard.isJoker &&
      (topDiscard.rank === "7" || topDiscard.rank === "J")
    )
      return "deck";

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

    // If taking from discard reveals our target card to opponents — use deck in high-threat situations
    const threatLevel = BotPlayer.computeThreatLevel(
      state,
      botPlayerId,
      opponents,
    );
    if (
      (threatLevel === "high" || threatLevel === "critical") &&
      discardValue >= 4
    )
      return "deck";

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

  // ── CORE: Discard Decision (Strategic Pressure AI) ────────────────────────────

  static decideDiscard(
    state: GameState,
    botPlayerId: string,
    personality: BotPersonality = "smart",
    difficultyBoost = 0,
    opponents?: OpponentProfile[],
  ): string[] {
    const bot = state.players.find((p) => p.id === botPlayerId)!;
    const hand = bot.hand;
    // Use match-variant config so each match has a different personality flavour
    const _variantCtx = BotPlayer.getCtx(botPlayerId);
    const rawCfg = BotPlayer.getVariantConfig(personality, _variantCtx.matchVariantSeed);
    const eDelta = BotPlayer.emotionalStateDelta(_variantCtx.emotionalState);
    // Merge emotional bias into personality config
    const cfg: PersonalityConfig = {
      ...rawCfg,
      thinkJitterMs: rawCfg.thinkJitterMs + (eDelta.thinkJitterMs ?? 0),
      showBias: rawCfg.showBias + (eDelta.showBias ?? 0),
      riskTolerance: rawCfg.riskTolerance + (eDelta.riskTolerance ?? 0),
      bluffFactor: rawCfg.bluffFactor + (eDelta.bluffFactor ?? 0),
      pressureBias: Math.min(1, rawCfg.pressureBias + (eDelta.pressureBias ?? 0)),
      killerInstinct: Math.min(1, rawCfg.killerInstinct + (eDelta.killerInstinct ?? 0)),
      denialWeight: Math.min(1, rawCfg.denialWeight + (eDelta.denialWeight ?? 0)),
      showInterruptBias: Math.min(1, rawCfg.showInterruptBias + (eDelta.showInterruptBias ?? 0)),
      randomPlayChance: Math.min(0.35, rawCfg.randomPlayChance + (eDelta.randomPlayChance ?? 0)),
      tacticalVariance: Math.min(0.4, rawCfg.tacticalVariance + (eDelta.tacticalVariance ?? 0)),
    };
    // v3: Aggressive ego quirk — overcommit after 3+ dominant turns
    if (personality === "aggressive" && _variantCtx.quirk_egoStreak >= 3) {
      cfg.attackAllAt = Math.min(8, cfg.attackAllAt + 2);
      cfg.attackOneAt = Math.min(10, cfg.attackOneAt + 2);
      cfg.killerInstinct = 0.95;
    }
    // v3: Smart patience quirk — delayed aggression burst after accumulation
    if (personality === "smart" && _variantCtx.quirk_patienceCounter >= 5) {
      cfg.pressureBias = Math.min(1, cfg.pressureBias + 0.25);
      cfg.killerInstinct = Math.min(1, cfg.killerInstinct + 0.2);
      cfg.denialWeight = Math.min(1, cfg.denialWeight + 0.15);
    }
    // v3: Revenge pressure — amplify all aggression when bot is getting back at repeat winner
    if (_variantCtx.revengeModeActive) {
      cfg.pressureBias = Math.min(1, cfg.pressureBias + 0.15);
      cfg.killerInstinct = Math.min(1, cfg.killerInstinct + 0.12);
      cfg.denialWeight = Math.min(1, cfg.denialWeight + 0.1);
    }
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

    // ── Compute all context signals ──────────────────────────────────────────
    const threatLevel = BotPlayer.computeThreatLevel(
      state,
      botPlayerId,
      opponents,
    );
    const showThreat = BotPlayer.detectShowThreat(
      state,
      botPlayerId,
      opponents,
    );
    const oppPressure = BotPlayer.estimateOpponentShowPressure(opponents);
    const pressureState = BotPlayer.detectPressureState(opponents);
    const killer = BotPlayer.killerInstinctActive(
      state,
      botPlayerId,
      personality,
      opponents,
    );
    const stability = BotPlayer.evaluateLowScoreStability(hand);
    const isCritical = threatLevel === "critical";
    const isHigh = threatLevel === "high";

    // ── 1. SHOW INTERRUPTION: when CRITICAL, all resources go anti-show ──────
    if (isCritical && (showThreat >= 0.6 || minOpponentCards <= 3)) {
      // Preserve 7s for attack — throw highest-value card instead
      if (sevens.length > 0) {
        // Don't waste 7s yet; throw our worst non-power card to keep hand lean
        const worst = nonPower.sort(
          (a, b) => DeckManager.getCardValue(b) - DeckManager.getCardValue(a),
        );
        // But avoid discarding denial-priority cards
        const safeWorst = worst.filter(
          (c) =>
            !DENIAL_PRIORITY_RANKS.has(c.rank) &&
            BotPlayer.opponentBenefitScore(c, opponents) < 2.0,
        );
        if (safeWorst.length > 0) return [safeWorst[0].id];
      }
      // If no 7s but can skip next player — do it
      if (jacks.length > 0 && nextPlayerCards <= 5) {
        const jackScore = BotPlayer.scoreAfterDiscard(hand, [jacks[0]]);
        if (jackScore <= normalBestScore + 4) return [jacks[0].id];
      }
    }

    // ── 2. ATTACK: all 7s when opponent is very close ────────────────────────
    if (
      sevens.length > 0 &&
      (cfg.alwaysAttack ||
        minOpponentCards <= cfg.attackAllAt ||
        (isCritical && minOpponentCards <= 5) ||
        (killer && minOpponentCards <= 6))
    ) {
      return sevens.map((c) => c.id);
    }

    // ── 3. BLUFF TACTICAL LINE (intentional deception, not random noise) ────────
    if (personality === "bluff" && !isHigh && !isCritical) {
      const ctx = BotPlayer.getCtx(botPlayerId);
      const bluffLine = BotPlayer.bluffTacticalLine(hand, discardOptions, ctx);
      if (bluffLine) return bluffLine;
    }

    // ── 3b. BOSS BAIT TRAP: deliberate weak play during bait phase ───────────────
    // Boss plays a slightly sub-optimal card to make opponent think we're struggling,
    // then surges hard in the following turn.
    if (personality === "boss" && !isCritical) {
      const baitCtx = BotPlayer.getCtx(botPlayerId);
      if (baitCtx.emotionalPhase === "bait" && Math.random() < 0.4) {
        const baitOption = discardOptions.find(
          (opt) =>
            opt.score > normalBestScore &&
            opt.score <= normalBestScore + 5 &&
            !opt.cards.some((c) => DENIAL_PRIORITY_RANKS.has(c.rank)),
        );
        if (baitOption) return baitOption.cards.map((c) => c.id);
      }
    }

    // ── 3c. CONDITIONING PUNISH: fire precisely when armed ───────────────────────
    if (_variantCtx.conditioningState === "punishing" && _variantCtx.conditioningPunishArmed && !isCritical) {
      const target = _variantCtx.conditioningBehavior;
      if (target === "fast_show" && jacks.length > 0) {
        const jScoreC = BotPlayer.scoreAfterDiscard(hand, [jacks[0]]);
        if (jScoreC <= normalBestScore + 5) return [jacks[0].id];
      }
      if ((target === "panic_player" || target === "aggressive") && sevens.length > 0) {
        return sevens.map((c) => c.id);
      }
      if (target === "recovery_baiter" || target === "defensive_grinder") {
        const bluffPunish = BotPlayer.bluffTacticalLine(hand, discardOptions, _variantCtx);
        if (bluffPunish) return bluffPunish;
      }
    }

    // ── 3d. HUMAN-LIKE MISJUDGMENT: emotional errors that feel real ──────────────
    if (!isCritical) {
      const misjudge = BotPlayer.humanLikeMisjudgment(_variantCtx, personality, hand, opponents);
      if (misjudge) return misjudge;
    }

    // ── 4. TACTICAL RANDOMNESS / SMART ANTI-DETERMINISM (near-optimal) ────────
    // Only when not in high-threat mode; picks between top options, never garbage
    if (
      !isHigh &&
      !isCritical &&
      Math.random() < cfg.randomPlayChance &&
      nonPower.length > 0
    ) {
      const ctx = BotPlayer.getCtx(botPlayerId);
      const pickIdx = BotPlayer.controlledImperfection(
        personality,
        ctx,
        Math.min(3, discardOptions.length),
      );
      const choice = discardOptions[pickIdx];
      if (choice) {
        const safe = !choice.cards.some(
          (c) =>
            DENIAL_PRIORITY_RANKS.has(c.rank) ||
            BotPlayer.opponentBenefitScore(c, opponents) >= 2.5,
        );
        if (safe) return choice.cards.map((c) => c.id);
      }
    }

    // ── 4b. IMMEDIATE SHOW if discard drops us to ≤5 ─────────────────────────
    if (normalBestScore <= 5 && normalBest.length > 0) {
      return normalBest.map((c) => c.id);
    }

    // ── 5. STRATEGIC 7 USAGE: preserve vs deploy ─────────────────────────────
    const sevenThreshold = cfg.sevenSaveThreshold + (boost > 0.18 ? 1 : 0);
    if (sevens.length > 0) {
      const sevenScore = BotPlayer.scoreAfterDiscard(hand, [sevens[0]]);
      const shouldDeploy7 =
        minOpponentCards <= cfg.attackOneAt ||
        (isHigh && minOpponentCards <= sevenThreshold) ||
        (killer && minOpponentCards <= sevenThreshold + 2) ||
        (pressureState.isUnstable && minOpponentCards <= sevenThreshold) ||
        (oppPressure >= 0.45 && currentTotal - 7 <= normalBestScore + 8) ||
        (boost > 0.18 &&
          currentTotal - 7 <= normalBestScore + 8 &&
          minOpponentCards <= sevenThreshold + 1);

      if (shouldDeploy7) {
        // Only throw 7 if we won't cripple our own hand too badly
        if (sevenScore <= normalBestScore + 5) {
          return [sevens[0].id];
        }
      }
    }

    // ── 6. STRATEGIC J USAGE: skip for tempo denial, not just card reduction ──
    if (jacks.length > 0 && sevens.length === 0) {
      const jackScore = BotPlayer.scoreAfterDiscard(hand, [jacks[0]]);
      const shouldUseJ =
        nextPlayerCards <= cfg.skipAt + (boost > 0.18 ? 2 : 0) ||
        (isHigh &&
          nextPlayerCards <= cfg.skipAt + 3 &&
          Math.random() < cfg.jackUseBias) ||
        (isCritical &&
          nextPlayerCards <= 6 &&
          Math.random() < cfg.jackUseBias * 1.2) ||
        (killer && nextPlayerCards <= cfg.skipAt + 2);

      if (
        shouldUseJ &&
        jackScore <= normalBestScore + 3 + (boost > 0.18 ? 2 : 0)
      ) {
        return [jacks[0].id];
      }
    }

    // ── 7. OPPONENT-BENEFIT PENALTY SCORING (core discard denial) ─────────────
    // Build a denial-aware score for every discard option
    const denialMultiplier =
      cfg.denialWeight *
      (isCritical ? 2.0 : isHigh ? 1.5 : threatLevel === "medium" ? 1.1 : 0.8);

    interface ScoredOption {
      cards: Card[];
      selfScore: number;
      denialPenalty: number;
      combinedScore: number;
      showIn2Turns: boolean;
    }

    const scored: ScoredOption[] = discardOptions.map((opt) => {
      const selfScore = opt.score;
      const benefit =
        opt.cards.reduce(
          (sum, c) => sum + BotPlayer.opponentBenefitScore(c, opponents),
          0,
        ) / opt.cards.length;
      const denialPenalty = benefit * denialMultiplier;
      const lookahead = BotPlayer.multiTurnLookahead(hand, opt.cards);
      // Negative bonus for show-in-2-turns options (we WANT to pick these)
      const futureBonus = lookahead.showIn2Turns ? -1.5 : 0;
      const combinedScore = selfScore + denialPenalty + futureBonus;
      return {
        cards: opt.cards,
        selfScore,
        denialPenalty,
        combinedScore,
        showIn2Turns: lookahead.showIn2Turns,
      };
    });

    // Sort by combined score (lower = better for us)
    scored.sort((a, b) => a.combinedScore - b.combinedScore);

    // ── 7b. ANTI-PATTERN COUNTER: respond to human's exploited strategy ──────────
    // When farmingIndicator > 0.5, the human is using the same archetype repeatedly.
    // Switch to counter-play to break their rhythm.
    {
      const apCtx = BotPlayer.getCtx(botPlayerId);
      if (apCtx.antiPatternMode && opponents && opponents.length > 0 && !isCritical) {
        const dominantArch = Object.values(apCtx.lastDetectedArchetype)[0];
        if (dominantArch === "fast_show") {
          // Heavy show denial — skip their turn if possible
          if (jacks.length > 0 && nextPlayerCards <= 7) {
            const jScore = BotPlayer.scoreAfterDiscard(hand, [jacks[0]]);
            if (jScore <= normalBestScore + 4) return [jacks[0].id];
          }
        } else if (dominantArch === "panic_player") {
          // Maximum pressure — throw 7s even at medium hand counts
          if (sevens.length > 0 && minOpponentCards <= 8) {
            return sevens.map((c) => c.id);
          }
        } else if (dominantArch === "defensive_grinder") {
          // Bluff/trap plays to force mistakes
          const bluffAnti = BotPlayer.bluffTacticalLine(hand, discardOptions, apCtx);
          if (bluffAnti && Math.random() < 0.55) return bluffAnti;
        } else if (dominantArch === "recovery_baiter") {
          // Don't be fooled by fake weakness — save 7s until genuinely vulnerable
          if (sevens.length > 0 && minOpponentCards >= 6) {
            const noSeven = scored.find(
              (s) => !s.cards.some((c) => c.rank === "7" && !c.isJoker),
            );
            if (noSeven) return noSeven.cards.map((c) => c.id);
          }
        }
      }
    }

    // ── 8. KILLER INSTINCT OVERRIDE: pick option that most denies recovery ────
    if (killer || pressureState.isPanicking) {
      // Prefer options that discard high-value cards (hurt us less) AND deny useful stuff
      const killerOption = scored.find(
        (s) =>
          !s.cards.some((c) => DENIAL_PRIORITY_RANKS.has(c.rank)) &&
          s.selfScore <= normalBestScore + 3,
      );
      if (killerOption) return killerOption.cards.map((c) => c.id);
    }

    // ── 8b. ANTI-RECOVERY SURGE: deny stabilisation when human is rebuilding ──
    // When we detect a human dropping from a high hand count (recovering), apply
    // maximum resource pressure during the first 4 turns of their recovery window.
    {
      const recovCtx = BotPlayer.getCtx(botPlayerId);
      if (recovCtx.recoveryDetected) {
        const recovTurns = recovCtx.turnCount - recovCtx.recoveryTurnStart;
        if (recovTurns <= 4) {
          if (sevens.length > 0 && minOpponentCards <= 8)
            return sevens.map((c) => c.id);
          if (jacks.length > 0 && nextPlayerCards <= 8) {
            const jScore2 = BotPlayer.scoreAfterDiscard(hand, [jacks[0]]);
            if (jScore2 <= normalBestScore + 6) return [jacks[0].id];
          }
          const denialPick = scored.find(
            (s) =>
              s.cards.every(
                (c) => BotPlayer.opponentBenefitScore(c, opponents) < 1.5,
              ) && s.selfScore <= normalBestScore + 3,
          );
          if (denialPick) return denialPick.cards.map((c) => c.id);
        }
      }
    }

    // ── 9. LOW-SCORE STABILITY PRESERVATION ──────────────────────────────────
    // If we have a stable hand (high stability score), don't sacrifice structure
    // for a tiny score improvement
    if (stability >= 6.0 && currentTotal <= 8) {
      // Only discard genuinely high cards
      const highOnly = scored.find(
        (s) =>
          s.cards.every((c) => DeckManager.getCardValue(c) >= 6) &&
          !s.cards.some((c) => c.isJoker || DENIAL_PRIORITY_RANKS.has(c.rank)),
      );
      if (highOnly) return highOnly.cards.map((c) => c.id);
    }

    // ── 10. COMBO PRESERVATION ───────────────────────────────────────────────
    const preserveCombo =
      BotPlayer.handResilience(hand) * cfg.comboPreservation;
    const shouldKeepPair = preserveCombo > 1.2;

    // ── 11. FINAL PICK: denial-aware best option + controlled imperfection ──────
    if (scored.length > 0) {
      const best = scored[0];
      // If the best option is a pair we want to keep, fall back to second-best
      if (shouldKeepPair && best.cards.length >= 2) {
        const single = scored.find((s) => s.cards.length === 1);
        if (single) return single.cards.map((c) => c.id);
      }
      // Boss / smart: occasionally pick 2nd-best to prevent pattern exploitation
      if (personality === "boss" || personality === "smart") {
        const ctx = BotPlayer.getCtx(botPlayerId);
        const pickIdx = BotPlayer.controlledImperfection(
          personality,
          ctx,
          scored.length,
        );
        if (pickIdx > 0) {
          BotPlayer.updateCtx(botPlayerId, {
            lastImperfectionTurn: ctx.turnCount,
          });
          return scored[pickIdx].cards.map((c) => c.id);
        }
      }
      return best.cards.map((c) => c.id);
    }

    // ── Fallback ──────────────────────────────────────────────────────────────
    if (normalBest.length > 0) return normalBest.map((c) => c.id);
    if (sevens.length > 0) return [sevens[0].id];
    if (jacks.length > 0) return [jacks[0].id];

    const highest = hand.reduce(
      (h, c) =>
        DeckManager.getCardValue(c) > DeckManager.getCardValue(h) ? c : h,
      hand[0],
    );
    return [highest.id];
  }

  // ── SHOW Decision ─────────────────────────────────────────────────────────────

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
    if (total > SHOW_HARD_MAX[personality]) return false;

    const confidence = BotPlayer.estimateShowConfidence(
      state,
      botPlayerId,
      personality,
      boost,
      opponents,
    );
    const oppSignals = BotPlayer.inferOpponentSignals(opponents);
    const showThreat = BotPlayer.detectShowThreat(
      state,
      botPlayerId,
      opponents,
    );
    const threatLevel = BotPlayer.computeThreatLevel(
      state,
      botPlayerId,
      opponents,
    );

    let threshold =
      0.56 -
      cfg.showBias * 0.12 -
      Math.min(0.24, boost * 0.18) +
      oppSignals.trapSignal * 0.08 -
      oppSignals.weakSignal * 0.04;

    // Show more readily when opponent is close to showing first
    if (showThreat >= 0.6) threshold -= 0.08;
    if (threatLevel === "critical") threshold -= 0.06;

    const decision = confidence >= threshold;

    if (boost > 0.18 && total <= 8 && confidence >= threshold - 0.05)
      return true;

    if (personality === "bluff" && total <= 7) {
      if (oppSignals.fastShowSignal > 0.4)
        return decision && Math.random() > 0.4;
      return Math.random() > 0.3 ? decision : !decision;
    }
    return decision;
  }

  // ── v3: Match Modifier Selection ─────────────────────────────────────────────
  // Assigns a per-match behavioural overlay so every match feels different.
  private static selectMatchModifier(seed: number): MatchModifier {
    if (seed < 0.12) return "chaos_storm";
    if (seed < 0.24) return "slow_pressure";
    if (seed < 0.36) return "double_surge";
    if (seed < 0.48) return "recovery_lock";
    if (seed < 0.60) return "hidden_tempo";
    if (seed < 0.72) return "anti_show_arena";
    return "none";
  }

  // ── v3: Emotional State Computation ──────────────────────────────────────────
  private static computeEmotionalState(
    ctx: BotMatchContext,
    botTotal: number,
    opponents: OpponentProfile[] | undefined,
    showThreat: number,
    threatLevel: ThreatLevel,
  ): EmotionalAIState {
    const minOppCards = opponents && opponents.length > 0
      ? Math.min(...opponents.map((o) => o.handCount ?? 10))
      : 10;

    if (botTotal <= 4 && minOppCards >= 6) return "dominant";
    if (threatLevel === "critical" || showThreat >= 0.7) return "pressured";
    if (ctx.frustrationLevel >= 0.65) return "frustrated";
    if (botTotal <= 7 && threatLevel === "low") return "confident";
    if (ctx.emotionalPhase === "bait") return "baiting";
    if (ctx.matchModifier === "chaos_storm" && Math.random() < 0.28) return "chaotic";
    if (ctx.frustrationLevel >= 0.4 && Math.random() < 0.22) return "chaotic";
    if (ctx.turnCount <= 5) return "cautious";
    return "cautious";
  }

  // ── v3: Emotional State Bias ──────────────────────────────────────────────────
  // Additive deltas applied on top of the personality config each turn.
  private static emotionalStateDelta(
    emotionalState: EmotionalAIState,
  ): Partial<PersonalityConfig> {
    switch (emotionalState) {
      case "dominant":
        return { pressureBias: 0.1, killerInstinct: 0.1, showBias: 0.05 };
      case "pressured":
        return { denialWeight: 0.15, riskTolerance: 0.1, showInterruptBias: 0.12 };
      case "frustrated":
        return { pressureBias: 0.18, killerInstinct: 0.12, randomPlayChance: 0.04 };
      case "confident":
        return { showBias: 0.04, pressureBias: 0.06, tacticalVariance: -0.02 };
      case "baiting":
        return { pressureBias: -0.12, bluffFactor: 0.15, denialWeight: 0.05 };
      case "chaotic":
        return { randomPlayChance: 0.12, thinkJitterMs: 300, tacticalVariance: 0.18 };
      default:
        return {};
    }
  }

  // ── v3: Cross-Match Memory ────────────────────────────────────────────────────
  static getOrCreateCrossMatch(userId: string): CrossMatchProfile {
    if (!BotPlayer.crossMatchProfiles.has(userId)) {
      BotPlayer.crossMatchProfiles.set(userId, {
        userId,
        matchesPlayed: 0,
        matchesWon: 0,
        favoriteArchetype: null,
        archetypeHistory: [],
        recoveryStyle: "unknown",
        showTiming: "balanced",
        lossStreak: 0,
        winStreak: 0,
        timesBeatenBoss: 0,
        totalBaitTrapsFired: 0,
        totalConditioningCycles: 0,
        lastSeen: Date.now(),
      });
    }
    return BotPlayer.crossMatchProfiles.get(userId)!;
  }

  // Called at match end to update cross-match profile and rivalry record.
  static finalizeMatchMemory(
    userId: string,
    playerWon: boolean,
    archetype: PlayerArchetype | null,
    showTiming: "early" | "late" | "balanced",
    personality: BotPersonality,
  ): void {
    const profile = BotPlayer.getOrCreateCrossMatch(userId);
    profile.matchesPlayed++;
    if (playerWon) {
      profile.matchesWon++;
      profile.winStreak++;
      profile.lossStreak = 0;
      if (personality === "boss") profile.timesBeatenBoss++;
    } else {
      profile.lossStreak++;
      profile.winStreak = 0;
    }
    if (archetype && archetype !== "unknown") {
      profile.archetypeHistory = [...profile.archetypeHistory.slice(-4), archetype];
      const counts: Partial<Record<string, number>> = {};
      for (const a of profile.archetypeHistory) counts[a] = (counts[a] ?? 0) + 1;
      profile.favoriteArchetype =
        (Object.entries(counts).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]?.[0] as PlayerArchetype) ?? null;
    }
    profile.showTiming = showTiming;
    profile.lastSeen = Date.now();

    const rivalKey = `${personality}:${userId}`;
    const existing: RivalryRecord = BotPlayer.rivalryMap.get(rivalKey) ?? {
      opponentUserId: userId,
      humanWins: 0,
      botWins: 0,
      revengePressure: false,
      lastMatchResult: "unknown",
    };
    if (playerWon) {
      existing.humanWins++;
      existing.lastMatchResult = "human_won";
    } else {
      existing.botWins++;
      existing.lastMatchResult = "bot_won";
    }
    existing.revengePressure =
      existing.humanWins >= 2 && existing.humanWins > existing.botWins;
    BotPlayer.rivalryMap.set(rivalKey, existing);
  }

  // ── v3: Revenge Check ─────────────────────────────────────────────────────────
  static checkRevengePressure(userId: string, personality: BotPersonality): boolean {
    return BotPlayer.rivalryMap.get(`${personality}:${userId}`)?.revengePressure ?? false;
  }

  // ── v3: Conditioning Cycle ────────────────────────────────────────────────────
  // Allow recovery N turns → punish the exact strategy the human uses to recover.
  private static advanceConditioningCycle(
    ctx: BotMatchContext,
    opponents: OpponentProfile[] | undefined,
  ): Partial<BotMatchContext> {
    if (!opponents || opponents.length === 0) return {};
    const archetype = opponents[0].archetype ?? "unknown";

    if (ctx.conditioningState === "off") {
      if (archetype !== "unknown" && ctx.turnCount >= 4) {
        return {
          conditioningState: "allowing",
          conditioningAllowTurns: 0,
          conditioningBehavior: archetype as PlayerArchetype,
        };
      }
      return {};
    }

    if (ctx.conditioningState === "allowing") {
      const newAllow = ctx.conditioningAllowTurns + 1;
      const threshold = 3 + Math.floor(ctx.matchVariantSeed * 3);
      if (newAllow >= threshold) {
        return {
          conditioningState: "punishing",
          conditioningAllowTurns: newAllow,
          conditioningPunishArmed: true,
        };
      }
      return { conditioningAllowTurns: newAllow };
    }

    if (ctx.conditioningState === "punishing") {
      if (ctx.conditioningPunishArmed) return { conditioningPunishArmed: false };
      return { conditioningState: "allowing", conditioningAllowTurns: 0 };
    }

    return {};
  }

  // ── v3: Human-Like Misjudgment ────────────────────────────────────────────────
  // Aggressive/boss occasionally overcommit or misread, creating believable errors.
  private static humanLikeMisjudgment(
    ctx: BotMatchContext,
    personality: BotPersonality,
    hand: Card[],
    opponents: OpponentProfile[] | undefined,
  ): string[] | null {
    if (personality !== "boss" && personality !== "aggressive") return null;
    if (ctx.emotionalState !== "frustrated" && ctx.emotionalState !== "dominant") return null;
    if (Math.random() >= 0.08) return null;

    const isRealSeven = (c: Card) => c.rank === "7" && !c.isJoker;
    const sevens = hand.filter(isRealSeven);
    const minOppCards = opponents && opponents.length > 0
      ? Math.min(...opponents.map((o) => o.handCount ?? 10))
      : 10;

    if (sevens.length > 0 && minOppCards >= 8 && ctx.emotionalState === "dominant") {
      return sevens.map((c) => c.id);
    }
    const byValue = [...hand].sort(
      (a, b) => DeckManager.getCardValue(b) - DeckManager.getCardValue(a),
    );
    const third = byValue[2];
    if (third && ctx.emotionalState === "frustrated") return [third.id];

    return null;
  }

  // ── v3: Match Intro Flavor Text ───────────────────────────────────────────────
  static getMatchIntroText(
    personality: BotPersonality,
    modifier: MatchModifier,
    _tier?: string,
  ): string {
    const intros: Record<BotPersonality, string[]> = {
      safe: [
        "Slow and steady. Don't rush me.",
        "I've seen every trick. Go ahead, try.",
        "Patience is its own weapon.",
      ],
      aggressive: [
        "I don't wait. I attack.",
        "Your hand is already mine.",
        "Move fast or get crushed.",
      ],
      bluff: [
        "Am I winning? Hard to tell, isn't it.",
        "Everything I show you is a lie.",
        "You'll second-guess every card I play.",
      ],
      smart: [
        "I've already calculated your next three moves.",
        "Every mistake you make, I remember.",
        "Strategy first. Aggression when the moment is right.",
      ],
      boss: [
        "You've come a long way. It ends here.",
        "Champions are made in moments like this.",
        "I've broken better players than you.",
      ],
      care: [
        "I build slowly. You won't see it coming.",
        "Perfection takes time.",
        "The lowest hand wins. Remember that.",
      ],
    };
    const modifierSuffix: Partial<Record<MatchModifier, string>> = {
      chaos_storm: " Tonight, chaos reigns.",
      slow_pressure: " The pressure will come — slowly.",
      double_surge: " Expect two surges. You won't survive both.",
      recovery_lock: " Try to recover. I dare you.",
      anti_show_arena: " No one shows early in this arena.",
      hidden_tempo: " You won't be able to read my rhythm.",
    };
    const lines = intros[personality] ?? intros.smart;
    const base = lines[Math.floor(Math.random() * lines.length)];
    return base + (modifierSuffix[modifier] ?? "");
  }

  // Convenience wrapper: init context if needed, return intro for this bot's modifier.
  static getMatchIntroForBot(botPlayerId: string, personality: BotPersonality): string {
    if (!BotPlayer.ctxMap.has(botPlayerId)) BotPlayer.initBotContext(botPlayerId);
    const ctx = BotPlayer.ctxMap.get(botPlayerId)!;
    return BotPlayer.getMatchIntroText(personality, ctx.matchModifier);
  }

  // ── Telemetry Snapshot ────────────────────────────────────────────────────────
  // Returns a lightweight analytics snapshot of the current bot context.
  static getBotContextSnapshot(botPlayerId: string): {
    emotionalState: EmotionalAIState;
    frustrationLevel: number;
    egoScore: number;
    dominanceScore: number;
    matchModifier: MatchModifier;
    revengeModeActive: boolean;
    conditioningState: string;
    turnCount: number;
    pressureTurnsTotal: number;
  } | null {
    const ctx = BotPlayer.ctxMap.get(botPlayerId);
    if (!ctx) return null;
    return {
      emotionalState:    ctx.emotionalState,
      frustrationLevel:  ctx.frustrationLevel,
      egoScore:          ctx.egoScore,
      dominanceScore:    ctx.dominanceScore,
      matchModifier:     ctx.matchModifier,
      revengeModeActive: ctx.revengeModeActive,
      conditioningState: ctx.conditioningState,
      turnCount:         ctx.turnCount,
      pressureTurnsTotal: ctx.pressureTurnsTotal,
    };
  }

  // ── Attack Response ───────────────────────────────────────────────────────────

  static decideAttackResponse(
    state: GameState,
    botPlayerId: string,
  ): { action: "throw" | "take"; cardIds?: string[] } {
    const bot = state.players.find((p) => p.id === botPlayerId)!;
    const sevens = bot.hand.filter((c) => c.rank === "7" && !c.isJoker);
    if (sevens.length > 0)
      return { action: "throw", cardIds: sevens.map((c) => c.id) };
    return { action: "take" };
  }

  // ── MAIN DECISION ENTRY POINT ─────────────────────────────────────────────────

  static decide(
    state: GameState,
    botPlayerId: string,
    personality: BotPersonality = "smart",
    difficultyBoost = 0,
    opponents?: OpponentProfile[],
  ): BotDecision {
    const bot = state.players.find((p) => p.id === botPlayerId);
    if (!bot) return { action: "draw", source: "deck" };

    // Advance per-bot match context each turn
    const ctx = BotPlayer.getCtx(botPlayerId);
    BotPlayer.updateCtx(botPlayerId, { turnCount: ctx.turnCount + 1 });

    // Farming detection: track repeated human strategies and update counter-mode
    const farmingUpdate = BotPlayer.updateFarmingDetection(opponents, ctx);
    BotPlayer.updateCtx(botPlayerId, farmingUpdate);

    // Recovery detection: spike pressure when human is stabilizing
    const recoveryNow = BotPlayer.detectHumanRecovery(opponents);
    const postFarmCtx = BotPlayer.getCtx(botPlayerId);
    if (recoveryNow !== postFarmCtx.recoveryDetected) {
      BotPlayer.updateCtx(botPlayerId, {
        recoveryDetected: recoveryNow,
        recoveryTurnStart: recoveryNow ? postFarmCtx.turnCount : 0,
      });
    }

    // v3: Compute emotional state from game signals
    const botForEmotion = state.players.find((p) => p.id === botPlayerId)!;
    const botTotalForEmotion = DeckManager.calculateHandTotal(botForEmotion.hand);
    const showThreatForEmotion = BotPlayer.detectShowThreat(state, botPlayerId, opponents);
    const threatForEmotion = BotPlayer.computeThreatLevel(state, botPlayerId, opponents);
    const emotionCtx = BotPlayer.getCtx(botPlayerId);
    const newEmotionalState = BotPlayer.computeEmotionalState(
      emotionCtx,
      botTotalForEmotion,
      opponents,
      showThreatForEmotion,
      threatForEmotion,
    );
    const newEmotionalAge =
      emotionCtx.emotionalState === newEmotionalState
        ? emotionCtx.emotionalStateAge + 1
        : 0;
    const frustrationDelta =
      emotionCtx.emotionalState === "pressured" && newEmotionalState !== "dominant" ? 0.08 : -0.04;
    const dominanceDelta = newEmotionalState === "dominant" ? 0.06 : -0.03;
    BotPlayer.updateCtx(botPlayerId, {
      emotionalState: newEmotionalState,
      emotionalStateAge: newEmotionalAge,
      frustrationLevel: Math.min(1, Math.max(0, emotionCtx.frustrationLevel + frustrationDelta)),
      dominanceScore: Math.min(1, Math.max(0, emotionCtx.dominanceScore + dominanceDelta)),
    });

    // v3: Update personality quirk counters
    const quirksCtx = BotPlayer.getCtx(botPlayerId);
    const quirkUpdate: Partial<BotMatchContext> = {};
    if (personality === "aggressive") {
      quirkUpdate.quirk_egoStreak =
        newEmotionalState === "dominant" || newEmotionalState === "confident"
          ? (quirksCtx.quirk_egoStreak ?? 0) + 1
          : 0;
    }
    if (personality === "bluff") {
      if (!quirksCtx.quirk_fakeWeakArmed &&
          (newEmotionalAge >= 2 || quirksCtx.emotionalPhase === "bait")) {
        quirkUpdate.quirk_fakeWeakArmed = true;
      } else if (quirksCtx.quirk_fakeWeakArmed && Math.random() < 0.4) {
        quirkUpdate.quirk_fakeWeakArmed = false;
      }
    }
    if (personality === "smart") {
      if (quirksCtx.emotionalPhase === "building" || quirksCtx.emotionalPhase === "cooldown") {
        quirkUpdate.quirk_patienceCounter = Math.min(8, (quirksCtx.quirk_patienceCounter ?? 0) + 1);
      } else if (quirksCtx.emotionalPhase === "surge") {
        quirkUpdate.quirk_patienceCounter = 0;
      }
    }
    if (personality === "boss") {
      if (quirksCtx.emotionalPhase === "surge" && !quirksCtx.quirk_intimidationReady) {
        quirkUpdate.quirk_intimidationReady = true;
      } else if (quirksCtx.quirk_intimidationReady) {
        quirkUpdate.quirk_intimidationReady = false;
      }
    }
    if (Object.keys(quirkUpdate).length > 0) BotPlayer.updateCtx(botPlayerId, quirkUpdate);

    // v3: Revenge check
    if (opponents && opponents.length > 0 && opponents[0].userId) {
      const revCtx = BotPlayer.getCtx(botPlayerId);
      const revengeNow = BotPlayer.checkRevengePressure(opponents[0].userId, personality);
      if (revengeNow !== revCtx.revengeModeActive) {
        BotPlayer.updateCtx(botPlayerId, {
          revengeModeActive: revengeNow,
          revengeTargetId: revengeNow ? opponents[0].userId : null,
        });
      }
    }

    // v3: Advance conditioning cycle
    const condUpdate = BotPlayer.advanceConditioningCycle(BotPlayer.getCtx(botPlayerId), opponents);
    if (Object.keys(condUpdate).length > 0) BotPlayer.updateCtx(botPlayerId, condUpdate);

    // Boss dynamically switches sub-personality every turn
    const bossMode =
      personality === "boss"
        ? BotPlayer.selectBossMode(state, botPlayerId, opponents)
        : "neutral";
    const effectivePersonality =
      personality === "boss"
        ? BotPlayer.bossPersonalityForMode(bossMode)
        : personality;

    // Advance emotional phase after mode is selected (boss only)
    if (personality === "boss") {
      const phaseUpdate = BotPlayer.advanceEmotionalPhase(
        BotPlayer.getCtx(botPlayerId),
        bossMode,
      );
      BotPlayer.updateCtx(botPlayerId, phaseUpdate);
    }

    // Telemetry: track pressure turns applied this match
    const isPressuringThisTurn =
      personality === "boss"
        ? bossMode === "pressure_mode" || bossMode === "killer" || bossMode === "anti_show"
        : personality === "aggressive";
    if (isPressuringThisTurn) {
      const telCtx = BotPlayer.getCtx(botPlayerId);
      BotPlayer.updateCtx(botPlayerId, { pressureTurnsTotal: telCtx.pressureTurnsTotal + 1 });
    }

    // ── Handle incoming 7-attack chain ───────────────────────────────────────
    if (
      state.attackChain &&
      state.attackChain.targetPlayerIndex === state.players.indexOf(bot)
    ) {
      const resp = BotPlayer.decideAttackResponse(state, botPlayerId);
      return resp.action === "throw"
        ? { action: "attack_throw", cardIds: resp.cardIds }
        : { action: "attack_take" };
    }

    // ── SHOW check (before drawing) ──────────────────────────────────────────
    // Always use the base personality for show thresholds — effectivePersonality
    // is for discard/draw tactics only. Boss in "defensive" mode should still
    // show at its own threshold (≤5), not inherit "safe" config.
    if (
      !state.hasDrawnThisTurn &&
      BotPlayer.shouldCallShow(
        state,
        botPlayerId,
        personality,
        difficultyBoost,
        opponents,
      )
    ) {
      return { action: "show" };
    }

    // ── Cut (matching discard pile top without drawing) ───────────────────────
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
          // Don't cut low-value cards when opponent benefit is high
          const benefit = BotPlayer.opponentBenefitScore(topDiscard, opponents);
          const threatLevel = BotPlayer.computeThreatLevel(
            state,
            botPlayerId,
            opponents,
          );
          const cutOk =
            cutValue >= 2 ||
            (threatLevel !== "critical" && benefit < 1.5) ||
            cutValue >= 4;
          if (cutOk)
            return { action: "discard", cardIds: matching.map((c) => c.id) };
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

    // ── Discard ───────────────────────────────────────────────────────────────
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
