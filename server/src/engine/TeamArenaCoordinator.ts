/**
 * TeamArenaCoordinator — Team Arena AI Coordination Layer (v2)
 *
 * Augments the base BotPlayer AI with team-level strategic coordination.
 * ONLY activates when state.teamGroups is present (Team Arena games).
 * ZERO impact on Solo AI Tournament — all paths guarded by isTeamArenaGame().
 *
 * v1 Systems (1–15):
 *  1.  Team Total Awareness          — evaluate combined team states
 *  2.  Team Show Threat Detection    — aggregate show danger across both humans
 *  3.  Cross-Bot Coordination        — stagger attacks, avoid overlap
 *  4.  Team Role Engine              — pressure / denial / closer / chaos / support
 *  5.  Wave Pressure System          — building → surge → cooldown → recovery cycles
 *  6.  Sacrifice Strategy            — defer when teammate is close to showing
 *  7.  Team Discard Denial           — heightened denial when any human is dangerous
 *  8.  Dual Targeting System         — identify and signal primary vs secondary targets
 *  9.  Human Coordination Detection  — detect tanking, 7-hoarding, coordinated shows
 * 10.  Match Strategy Memory         — per-human behavioral profiles updated each turn
 * 11.  Adaptive Personality Routing  — map role+phase → effective personality
 * 12.  Team-Only Difficulty Scaling  — boost 0.28–0.35 baseline, phase-modulated
 * 13.  Feature Flag System           — safe disable per subsystem without code changes
 * 14.  Boss Weakness Injection       — deliberate exploitable gaps for fairness
 * 15.  Coordinated Surge Windows     — escalate when humans are vulnerable
 *
 * v2 Systems (16–34):
 * 16.  Advanced AI Imperfection      — believable human-like mistakes (cooldown gated)
 * 17.  Momentum Fatigue              — reduce coordination after extended domination
 * 18.  Comeback Windows              — loosen pressure when bot team has big lead
 * 19.  Double-Boss Desync            — async surge timing so two bosses don't spike together
 * 20.  Asymmetric Boss Identities    — Overlord=pressure/tempo, Nemesis=closer/anti-show
 * 21.  Advanced Emotional Pacing     — tension→relief→bait→surge→climax arc
 * 22.  Human-like Hesitation         — reduced reactivity in early/safe states
 * 23.  Team Chemistry Variation      — match-seeded synergy level per pairing
 * 24.  Strategic Overconfidence      — bots overextend when dominating (fairness)
 * 25.  Recovery Bait System          — passive window then coordinated counter-surge
 * 26.  Advanced Memory Decay         — behavioral flags fade without recent confirmation
 * 27.  Replayability Randomization   — match seed drives personality/boost variance
 * 28.  Fairness Protection           — cap on consecutive max-boost turns
 * 29.  Telemetry Snapshot            — exportable match analytics per game
 */

import { GameState, PlayerState } from '../../../shared/src/types';
import { BotDecision, BotPersonality, OpponentProfile } from './BotPlayer';
import { DeckManager } from './DeckManager';

// ─────────────────────────────────────────────────────────────────────────────
// Feature Flags — disable any subsystem without touching Solo AI
// ─────────────────────────────────────────────────────────────────────────────

export const TEAM_COORD_FLAGS = {
  // v1 flags
  ENABLE_TEAM_COORDINATION:      true,
  ENABLE_WAVE_PRESSURE:          true,
  ENABLE_TEAM_DENIAL:            true,
  ENABLE_TEAM_SURGE:             true,
  ENABLE_TEAM_ROLES:             true,
  ENABLE_TEAM_SHOW_THREAT:       true,
  ENABLE_HUMAN_COORD_DETECTION:  true,
  ENABLE_SACRIFICE_STRATEGY:     true,
  ENABLE_DUAL_TARGETING:         true,
  ENABLE_MATCH_MEMORY:           true,
  ENABLE_BOSS_WEAKNESSES:        true,
  // v2 flags
  ENABLE_MOMENTUM_FATIGUE:       true,
  ENABLE_BOSS_IMPERFECTIONS:     true,
  ENABLE_RECOVERY_BAIT:          true,
  ENABLE_TEAM_CHEMISTRY:         true,
  ENABLE_HUMAN_HESITATION:       true,
  ENABLE_PRESSURE_VARIANCE:      true,
  ENABLE_COMEBACK_WINDOWS:       true,
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type TeamBotRole   = 'pressure' | 'denial' | 'closer' | 'chaos' | 'support';
export type WavePhase     = 'building' | 'surge' | 'cooldown' | 'recovery';
export type PacingPhase   = 'tension' | 'relief' | 'bait' | 'surge' | 'climax';
export type BossIdentity  = 'overlord' | 'nemesis' | 'blaze' | 'phantom' | 'cyclone' | 'generic';

/** Behavioral fingerprint tracked per human across the entire match. */
interface HumanMemory {
  userId:               string;
  hoards7s:             boolean;
  rushesShow:           boolean;
  recoversSlowly:       boolean;
  protectsTeammate:     boolean;
  totalAttackThrows:    number;
  totalShowAttempts:    number;
  handCountHistory:     number[];
  consecutiveHighHand:  number;
  consecutiveLowHand:   number;
  // v2 additions
  flagConfirmations:    { hoards7s: number; rushesShow: number; recoversSlowly: number };
  lastUpdateTurn:       number;
}

/** Per-game coordination state — one entry per active team arena game. */
interface TeamArenaGameCtx {
  // Wave pressure state machine
  wavePhase:            WavePhase;
  waveTurnCount:        number;
  surgeCount:           number;
  lastSurgeTurn:        number;

  // Role system
  botRoles:             Map<string, TeamBotRole>;
  lastRoleAssignTurn:   number;

  // Cross-bot attack coordination
  lastAggressorId:      string | null;
  lastAggressionTurn:   number;

  // Per-human behavioral memory
  humanMemory:          Map<string, HumanMemory>;

  // Global turn tracker
  globalTurn:           number;

  // v2: Match identity
  matchSeed:            number;

  // v2: Dominance tracking
  dominanceScore:       number;   // 0–1, how much bots are winning right now
  dominanceTurns:       number;   // consecutive turns bots have been dominant
  momentumFatigue:      number;   // 0–1, fatigue accumulated from sustained dominance

  // v2: Boss identity
  bossIdentities:       Map<string, BossIdentity>;
  bossPhaseOffset:      Map<string, number>;  // turn offset for desync
  isFinalOverlords:     boolean;  // true when both bots are Overlord+Nemesis (Stage 5)

  // v2: Team chemistry (0.25–0.75, seeded per match)
  teamChemistry:        number;

  // v2: Imperfection gate
  imperfectionCooldown: number;   // turns until next imperfection can fire
  lastImperfectionTurn: number;

  // v2: Overconfidence
  overconfidenceActive: boolean;
  overconfidenceTurns:  number;

  // v2: Recovery bait (hard-capped at 1 per match)
  baitMode:             boolean;
  baitModeStartTurn:    number;
  baitCyclesUsed:       number;

  // v2: Emotional pacing arc
  pacingPhase:          PacingPhase;
  pacingPhaseTurns:     number;

  // v2: Fairness protection
  consecutiveMaxBoostTurns: number;

  // v2: Telemetry
  telemetry:            TeamArenaTelemetry;
}

/** Exportable analytics snapshot for this match. */
export interface TeamArenaTelemetry {
  gameId:               string;
  imperfectionsFired:   number;
  baitCyclesTriggered:  number;
  surgesTriggered:      number;
  overconfidenceEvents: number;
  fatigueTurns:         number;
  maxDominanceScore:    number;
  humanMomentumCount:   number;   // turns where humans had advantage
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-game state store
// ─────────────────────────────────────────────────────────────────────────────

const gameCtxMap = new Map<string, TeamArenaGameCtx>();

export function initTeamArenaGame(gameId: string): void {
  const seed = (Math.random() * 99999) | 0;
  gameCtxMap.set(gameId, {
    wavePhase:              'building',
    waveTurnCount:          0,
    surgeCount:             0,
    lastSurgeTurn:          -99,
    botRoles:               new Map(),
    lastRoleAssignTurn:     0,
    lastAggressorId:        null,
    lastAggressionTurn:     0,
    humanMemory:            new Map(),
    globalTurn:             0,
    matchSeed:              seed,
    dominanceScore:         0,
    dominanceTurns:         0,
    momentumFatigue:        0,
    bossIdentities:         new Map(),
    bossPhaseOffset:        new Map(),
    isFinalOverlords:       false,
    teamChemistry:          0.25 + ((seed % 100) / 200),   // 0.25–0.75
    imperfectionCooldown:   0,
    lastImperfectionTurn:   -99,
    overconfidenceActive:   false,
    overconfidenceTurns:    0,
    baitMode:               false,
    baitModeStartTurn:      -99,
    baitCyclesUsed:         0,
    pacingPhase:            'tension',
    pacingPhaseTurns:       0,
    consecutiveMaxBoostTurns: 0,
    telemetry: {
      gameId,
      imperfectionsFired:   0,
      baitCyclesTriggered:  0,
      surgesTriggered:      0,
      overconfidenceEvents: 0,
      fatigueTurns:         0,
      maxDominanceScore:    0,
      humanMomentumCount:   0,
    },
  });
}

export function cleanupTeamArenaGame(gameId: string): void {
  gameCtxMap.delete(gameId);
}

/** Returns the telemetry snapshot for a game (or null if not found). */
export function getTeamArenaTelemetry(gameId: string): TeamArenaTelemetry | null {
  return gameCtxMap.get(gameId)?.telemetry ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Guard: is this a Team Arena game?
// ─────────────────────────────────────────────────────────────────────────────

export function isTeamArenaGame(state: GameState): boolean {
  const tg: unknown = (state as any).teamGroups;
  return Array.isArray(tg) && (tg as unknown[]).length >= 2;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Team partition helpers
// ─────────────────────────────────────────────────────────────────────────────

interface TeamPartition {
  humanTeam: PlayerState[];
  botTeam:   PlayerState[];
}

function getTeamPartition(state: GameState): TeamPartition {
  const teamGroups: string[][] = (state as any).teamGroups ?? [];
  if (teamGroups.length < 2) return { humanTeam: [], botTeam: [] };

  const humanUserIds = new Set(teamGroups[0]);
  const botUserIds   = new Set(teamGroups[1]);
  const active       = state.players.filter(p => !p.isEliminated);

  return {
    humanTeam: active.filter(p => humanUserIds.has(p.userId)),
    botTeam:   active.filter(p => botUserIds.has(p.userId)),
  };
}

function getBotTeammate(state: GameState, botPlayerId: string) {
  const { botTeam } = getTeamPartition(state);
  return botTeam.find(b => b.id !== botPlayerId) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Team Total Awareness
// ─────────────────────────────────────────────────────────────────────────────

interface TeamEval {
  humanTotalScore:     number;
  botTotalScore:       number;
  humanMinHandCount:   number;
  botMinHandCount:     number;
  humanTeamHandTotal:  number;
  botTeamHandTotal:    number;
  humanShowDanger:     boolean;
  humanShowCritical:   boolean;
  weakestHuman:        PlayerState | null;
  primaryTarget:       PlayerState | null;
  secondaryTarget:     PlayerState | null;
  bothHumansLow:       boolean;
  scoreDelta:          number;   // botTotalScore - humanTotalScore (positive = bots ahead)
}

function evaluateTeams(state: GameState): TeamEval {
  const { humanTeam, botTeam } = getTeamPartition(state);

  const humanTotalScore    = humanTeam.reduce((s, p) => s + p.totalScore, 0);
  const botTotalScore      = botTeam.reduce((s, p) => s + p.totalScore, 0);
  const humanMinHandCount  = humanTeam.length > 0 ? Math.min(...humanTeam.map(p => p.handCount)) : Infinity;
  const botMinHandCount    = botTeam.length   > 0 ? Math.min(...botTeam.map(p => p.handCount))   : Infinity;
  const humanTeamHandTotal = humanTeam.reduce((s, p) => s + p.handCount, 0);
  const botTeamHandTotal   = botTeam.reduce((s, p) => s + p.handCount, 0);

  const humanShowDanger   = humanMinHandCount <= 3;
  const humanShowCritical = humanMinHandCount <= 2;
  const bothHumansLow     = humanTeam.length >= 2 && humanTeam.every(p => p.handCount <= 4);

  const sortedByScore = [...humanTeam].sort((a, b) => a.totalScore - b.totalScore);
  const sortedByHand  = [...humanTeam].sort((a, b) => a.handCount  - b.handCount);

  return {
    humanTotalScore, botTotalScore,
    humanMinHandCount, botMinHandCount,
    humanTeamHandTotal, botTeamHandTotal,
    humanShowDanger, humanShowCritical, bothHumansLow,
    scoreDelta:      botTotalScore - humanTotalScore,
    weakestHuman:    sortedByScore[0]  ?? null,
    primaryTarget:   sortedByHand[0]  ?? null,
    secondaryTarget: sortedByHand[1]  ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Team Show Threat Detection
// ─────────────────────────────────────────────────────────────────────────────

function teamShowThreatLevel(teamEval: TeamEval, humanMemory: Map<string, HumanMemory>): number {
  if (!TEAM_COORD_FLAGS.ENABLE_TEAM_SHOW_THREAT) return 0;

  let threat = 0;

  if (teamEval.humanShowCritical)           threat += 0.75;
  else if (teamEval.humanShowDanger)        threat += 0.50;
  else if (teamEval.humanMinHandCount <= 4) threat += 0.25;

  if (teamEval.bothHumansLow)              threat += 0.20;
  if (teamEval.humanTeamHandTotal <= 7)    threat += 0.20;

  for (const mem of humanMemory.values()) {
    if (mem.rushesShow) threat += 0.12;
  }

  return Math.min(1, threat);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Wave Pressure System
// ─────────────────────────────────────────────────────────────────────────────

function advanceWavePhase(ctx: TeamArenaGameCtx, teamEval: TeamEval): void {
  if (!TEAM_COORD_FLAGS.ENABLE_WAVE_PRESSURE) return;

  ctx.globalTurn++;
  ctx.waveTurnCount++;

  switch (ctx.wavePhase) {
    case 'building':
      if (ctx.waveTurnCount >= 4 || teamEval.humanShowDanger) {
        ctx.wavePhase     = 'surge';
        ctx.waveTurnCount = 0;
        ctx.surgeCount++;
        ctx.lastSurgeTurn = ctx.globalTurn;
        ctx.telemetry.surgesTriggered++;
      }
      break;

    case 'surge':
      if (ctx.waveTurnCount >= 3) {
        ctx.wavePhase     = 'cooldown';
        ctx.waveTurnCount = 0;
      }
      if (teamEval.humanShowCritical) ctx.waveTurnCount = 0;
      break;

    case 'cooldown':
      // 3-turn exhale — longer than before so relief feels real, not cosmetic
      if (ctx.waveTurnCount >= 3) {
        ctx.wavePhase     = 'recovery';
        ctx.waveTurnCount = 0;
      }
      break;

    case 'recovery':
      // 3 turns of genuinely passive play before next build cycle
      if (ctx.waveTurnCount >= 3) {
        ctx.wavePhase     = 'building';
        ctx.waveTurnCount = 0;
      }
      break;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Team Role Assignment
// ─────────────────────────────────────────────────────────────────────────────

function assignRole(
  state:        GameState,
  ctx:          TeamArenaGameCtx,
  botPlayerId:  string,
  teamEval:     TeamEval,
  showThreat:   number,
): TeamBotRole {
  if (!TEAM_COORD_FLAGS.ENABLE_TEAM_ROLES) return 'pressure';

  const { botTeam } = getTeamPartition(state);
  const thisBot  = state.players.find(p => p.id === botPlayerId);
  const teammate = getBotTeammate(state, botPlayerId);

  if (!thisBot) return 'pressure';

  // Reassign every 3 turns (dynamic adaptation)
  if (ctx.globalTurn - ctx.lastRoleAssignTurn < 3 && ctx.botRoles.size > 0) {
    return ctx.botRoles.get(botPlayerId) ?? 'pressure';
  }

  ctx.lastRoleAssignTurn = ctx.globalTurn;
  ctx.botRoles.clear();

  const thisBotTotal = DeckManager.calculateHandTotal(thisBot.hand);
  const tmTotal      = teammate ? DeckManager.calculateHandTotal(teammate.hand) : Infinity;

  // v2: Use boss identity for asymmetric role assignment
  const identity = ctx.bossIdentities.get(botPlayerId) ?? 'generic';
  const tmIdentity = teammate ? (ctx.bossIdentities.get(teammate.id) ?? 'generic') : 'generic';

  // Show threat critical → everyone into denial
  if (showThreat >= 0.65) {
    ctx.botRoles.set(botPlayerId, 'denial');
    if (teammate) ctx.botRoles.set(teammate.id, 'denial');
    return 'denial';
  }

  // v2: Asymmetric boss identity forcing
  if (identity === 'overlord' && ctx.wavePhase !== 'cooldown' && ctx.wavePhase !== 'recovery') {
    ctx.botRoles.set(botPlayerId, 'pressure');
    if (teammate) ctx.botRoles.set(teammate.id, tmIdentity === 'nemesis' ? 'denial' : 'closer');
    return 'pressure';
  }
  if (identity === 'nemesis' && thisBotTotal <= 8) {
    ctx.botRoles.set(botPlayerId, 'closer');
    if (teammate) ctx.botRoles.set(teammate.id, 'pressure');
    return 'closer';
  }

  // If this bot is very low (≤5) → closer role
  if (thisBotTotal <= 5) {
    ctx.botRoles.set(botPlayerId, 'closer');
    if (teammate) ctx.botRoles.set(teammate.id, teamEval.humanShowDanger ? 'denial' : 'pressure');
    return 'closer';
  }

  switch (ctx.wavePhase) {
    case 'surge':
      if (thisBotTotal <= tmTotal) {
        ctx.botRoles.set(botPlayerId, 'closer');
        if (teammate) ctx.botRoles.set(teammate.id, 'pressure');
        return 'closer';
      } else {
        ctx.botRoles.set(botPlayerId, 'pressure');
        if (teammate) ctx.botRoles.set(teammate.id, 'closer');
        return 'pressure';
      }

    case 'cooldown':
    case 'recovery':
      ctx.botRoles.set(botPlayerId, 'support');
      if (teammate) ctx.botRoles.set(teammate.id, 'support');
      return 'support';

    default: // building
      if (thisBotTotal <= tmTotal) {
        ctx.botRoles.set(botPlayerId, 'denial');
        if (teammate) ctx.botRoles.set(teammate.id, 'pressure');
        return 'denial';
      } else {
        ctx.botRoles.set(botPlayerId, 'pressure');
        if (teammate) ctx.botRoles.set(teammate.id, 'denial');
        return 'pressure';
      }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Match Strategy Memory
// ─────────────────────────────────────────────────────────────────────────────

function updateHumanMemory(ctx: TeamArenaGameCtx, profiles: OpponentProfile[]): void {
  if (!TEAM_COORD_FLAGS.ENABLE_MATCH_MEMORY) return;

  for (const p of profiles) {
    const existing: HumanMemory = ctx.humanMemory.get(p.userId) ?? {
      userId:              p.userId,
      hoards7s:            false,
      rushesShow:          false,
      recoversSlowly:      false,
      protectsTeammate:    false,
      totalAttackThrows:   0,
      totalShowAttempts:   0,
      handCountHistory:    [],
      consecutiveHighHand: 0,
      consecutiveLowHand:  0,
      flagConfirmations:   { hoards7s: 0, rushesShow: 0, recoversSlowly: 0 },
      lastUpdateTurn:      0,
    };

    existing.totalAttackThrows  += p.recentAttackThrows;
    existing.totalShowAttempts  += p.recentShows;
    existing.handCountHistory    = [...(existing.handCountHistory ?? []).slice(-15), p.handCount];
    existing.lastUpdateTurn      = ctx.globalTurn;

    // Accumulate confirmations for flag robustness
    if (p.recentAttackThrows > 0) existing.flagConfirmations.hoards7s++;
    if (p.recentShows > 0)        existing.flagConfirmations.rushesShow++;

    if (existing.totalAttackThrows >= 2) existing.hoards7s = true;
    if (existing.totalShowAttempts >= 2 || p.archetype === 'fast_show') existing.rushesShow = true;

    const hist = existing.handCountHistory;
    if (hist.length >= 3) {
      const recent = hist.slice(-3);
      const avg    = recent.reduce((a, b) => a + b, 0) / recent.length;
      if (avg >= 5) {
        existing.consecutiveHighHand++;
        existing.consecutiveLowHand = 0;
        existing.flagConfirmations.recoversSlowly++;
      } else {
        existing.consecutiveLowHand++;
        existing.consecutiveHighHand = 0;
      }
      if (existing.consecutiveHighHand >= 3) existing.recoversSlowly = true;
    }

    ctx.humanMemory.set(p.userId, existing);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Human Coordination Detection
// ─────────────────────────────────────────────────────────────────────────────

interface CoordDetection {
  oneIsTanking:      boolean;
  coordinatedClose:  boolean;
  sevensHoarder:     string | null;
  rushShow:          string | null;
}

function detectHumanCoordination(
  ctx:      TeamArenaGameCtx,
  teamEval: TeamEval,
  profiles: OpponentProfile[],
): CoordDetection {
  if (!TEAM_COORD_FLAGS.ENABLE_HUMAN_COORD_DETECTION) {
    return { oneIsTanking: false, coordinatedClose: false, sevensHoarder: null, rushShow: null };
  }

  const mems = profiles.map(p => ctx.humanMemory.get(p.userId)).filter(Boolean) as HumanMemory[];

  const oneIsTanking = mems.some(m => m.recoversSlowly && m.consecutiveHighHand >= 2) &&
                       mems.some(m => m.rushesShow);
  const coordinatedClose = teamEval.bothHumansLow;
  const sevensHoarder    = mems.find(m => m.hoards7s)?.userId    ?? null;
  const rushShow         = mems.find(m => m.rushesShow)?.userId  ?? null;

  return { oneIsTanking, coordinatedClose, sevensHoarder, rushShow };
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Build Team-Aware Opponent Profiles
// ─────────────────────────────────────────────────────────────────────────────

function buildTeamAwareProfiles(
  baseProfiles: OpponentProfile[],
  teamEval:     TeamEval,
  ctx:          TeamArenaGameCtx,
  coord:        CoordDetection,
): OpponentProfile[] {
  if (!TEAM_COORD_FLAGS.ENABLE_TEAM_DENIAL) return baseProfiles;

  return baseProfiles.map(p => {
    const mem = ctx.humanMemory.get(p.userId);
    let aug = { ...p };

    if (TEAM_COORD_FLAGS.ENABLE_DUAL_TARGETING && teamEval.primaryTarget?.userId === p.userId) {
      aug.archetype  = 'fast_show';
      aug.recentCuts = Math.max(aug.recentCuts, 2);
    }

    if (teamEval.bothHumansLow && p.handCount <= 4) {
      aug.archetype  = 'fast_show';
      aug.recentCuts = Math.max(aug.recentCuts, 2);
    }

    if (coord.sevensHoarder === p.userId) {
      aug.archetype = 'hold_7s';
    }

    if (mem?.rushesShow) {
      aug.recentShows  = Math.max(aug.recentShows + 1, 2);
      aug.recentCuts   = Math.max(aug.recentCuts  + 1, 2);
    }

    if (mem?.recoversSlowly) {
      aug.recentAttackTakes = Math.max(aug.recentAttackTakes + 1, 2);
    }

    if (coord.coordinatedClose && p.handCount <= 4) {
      aug.recentCuts = Math.max(aug.recentCuts, 3);
    }

    return aug;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Effective Personality for Role + Phase
// ─────────────────────────────────────────────────────────────────────────────

function roleToPersonality(
  base:       BotPersonality,
  role:       TeamBotRole,
  wavePhase:  WavePhase,
  showThreat: number,
): BotPersonality {
  if (showThreat >= 0.7 && TEAM_COORD_FLAGS.ENABLE_TEAM_SHOW_THREAT) return 'boss';
  if (!TEAM_COORD_FLAGS.ENABLE_TEAM_ROLES) return base;

  switch (role) {
    case 'pressure':
      if (wavePhase === 'surge')    return 'aggressive';
      if (wavePhase === 'cooldown') return 'smart';
      return base === 'boss' ? 'boss' : 'aggressive';

    case 'denial':
      return 'smart';

    case 'closer':
      return 'boss';

    case 'chaos':
      return 'bluff';

    case 'support':
      // Both cooldown and recovery use 'safe' — genuine relief, not just reduced smart
      return (wavePhase === 'cooldown' || wavePhase === 'recovery') ? 'safe' : 'smart';

    default:
      return base;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. Effective Difficulty Boost for Team Mode
// ─────────────────────────────────────────────────────────────────────────────

const TEAM_BOOST_BASE = 0.28;

function computeTeamBoost(
  base:       number,
  role:       TeamBotRole,
  wavePhase:  WavePhase,
  showThreat: number,
  teamEval:   TeamEval,
): number {
  let boost = Math.max(base, TEAM_BOOST_BASE);

  if (showThreat >= 0.75) return 0.35;
  if (showThreat >= 0.5)  boost = Math.min(0.35, boost + 0.05);

  if (wavePhase === 'surge')    boost = Math.min(0.35, boost + 0.06);
  if (wavePhase === 'cooldown') boost = Math.max(0.22, boost - 0.04);
  if (wavePhase === 'recovery') boost = Math.max(0.22, boost - 0.02);

  if (role === 'closer')   boost = Math.min(0.35, boost + 0.04);
  if (role === 'pressure') boost = Math.min(0.35, boost + 0.02);
  if (role === 'support')  boost = Math.max(0.22, boost - 0.04);

  if (teamEval.humanShowDanger) boost = Math.min(0.35, boost + 0.04);
  if (teamEval.bothHumansLow)   boost = Math.min(0.35, boost + 0.03);

  return Math.min(0.35, boost);
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. Sacrifice Strategy
// ─────────────────────────────────────────────────────────────────────────────

function shouldBePassive(state: GameState, botPlayerId: string): boolean {
  if (!TEAM_COORD_FLAGS.ENABLE_SACRIFICE_STRATEGY) return false;

  const thisBot  = state.players.find(p => p.id === botPlayerId);
  const teammate = getBotTeammate(state, botPlayerId);
  if (!thisBot || !teammate) return false;

  const thisBotTotal = DeckManager.calculateHandTotal(thisBot.hand);
  const tmTotal      = DeckManager.calculateHandTotal(teammate.hand);

  if (tmTotal <= 5 && thisBotTotal > tmTotal) return true;
  if (thisBotTotal >= 12 && tmTotal <= 7) return true;

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. Cross-Bot Attack Stagger
// ─────────────────────────────────────────────────────────────────────────────

function shouldStaggerAggression(botPlayerId: string, ctx: TeamArenaGameCtx): boolean {
  if (!TEAM_COORD_FLAGS.ENABLE_TEAM_COORDINATION) return false;

  const turnsAgo = ctx.globalTurn - ctx.lastAggressionTurn;

  if (ctx.lastAggressorId !== null &&
      ctx.lastAggressorId !== botPlayerId &&
      turnsAgo <= 2) {
    return Math.random() < 0.60;
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// 13. Boss Weakness Injection (Fairness)
// ─────────────────────────────────────────────────────────────────────────────

function applyBossWeakness(
  base:        BotPersonality,
  personality: BotPersonality,
  wavePhase:   WavePhase,
  boost:       number,
  botName:     string,
): number {
  if (!TEAM_COORD_FLAGS.ENABLE_BOSS_WEAKNESSES) return boost;

  const name = botName.toLowerCase();

  if (name.includes('blaze') && wavePhase === 'surge' && Math.random() < 0.25) {
    return Math.max(0.24, boost - 0.06);
  }
  if (name.includes('phantom') && wavePhase === 'recovery' && Math.random() < 0.30) {
    return Math.max(0.22, boost - 0.05);
  }
  if (name.includes('overlord') && wavePhase === 'cooldown' && Math.random() < 0.35) {
    return Math.max(0.20, boost - 0.07);
  }
  if (name.includes('cyclone') && wavePhase === 'surge' && Math.random() < 0.30) {
    return Math.max(0.23, boost - 0.05);
  }
  if (name.includes('nemesis') && Math.random() < 0.15) {
    return Math.max(0.24, boost - 0.04);
  }

  return boost;
}

// ─────────────────────────────────────────────────────────────────────────────
// 16. Advanced AI Imperfection System (v2)
// Fires a deliberate mistake: boost drop + personality downgrade.
// Gated by cooldown — cannot fire more than once every 5 turns.
// ─────────────────────────────────────────────────────────────────────────────

interface ImperfectionResult {
  fired:                boolean;
  effectiveBoost:       number;
  effectivePersonality: BotPersonality;
}

function tryTriggerImperfection(
  ctx:         TeamArenaGameCtx,
  boost:       number,
  personality: BotPersonality,
  teamEval:    TeamEval,
): ImperfectionResult {
  if (!TEAM_COORD_FLAGS.ENABLE_BOSS_IMPERFECTIONS) {
    return { fired: false, effectiveBoost: boost, effectivePersonality: personality };
  }

  // Stage 5 (Overlord+Nemesis): imperfection fires more often (every 4 turns)
  const cooldownTurns = ctx.isFinalOverlords ? 4 : 5;
  const cooldownOver  = ctx.globalTurn - ctx.lastImperfectionTurn >= cooldownTurns;
  const notCritical   = !teamEval.humanShowCritical;

  // Base 15% chance, suppressed when humans are in critical show range
  if (cooldownOver && notCritical && Math.random() < 0.15) {
    ctx.lastImperfectionTurn = ctx.globalTurn;
    ctx.imperfectionCooldown = 5;
    ctx.telemetry.imperfectionsFired++;

    const downgradeMap: Partial<Record<BotPersonality, BotPersonality>> = {
      boss:       'smart',
      smart:      'safe',
      aggressive: 'safe',
      bluff:      'safe',
    };
    const downgraded = downgradeMap[personality] ?? personality;

    return {
      fired:                true,
      effectiveBoost:       Math.max(0.20, boost - 0.08),
      effectivePersonality: downgraded,
    };
  }

  return { fired: false, effectiveBoost: boost, effectivePersonality: personality };
}

// ─────────────────────────────────────────────────────────────────────────────
// 17. Momentum Fatigue System (v2)
// After bots dominate for many consecutive turns, coordination degrades.
// ─────────────────────────────────────────────────────────────────────────────

function computeDominanceScore(teamEval: TeamEval): number {
  // Positive = bots winning, negative = humans winning
  const scorePart = Math.max(0, teamEval.scoreDelta) / 30;
  const handPart  = teamEval.humanTeamHandTotal > 0
    ? (teamEval.humanTeamHandTotal - teamEval.botTeamHandTotal) / 14
    : 0;
  return Math.min(1, Math.max(-1, (scorePart + handPart) / 2));
}

function applyMomentumFatigue(
  ctx:   TeamArenaGameCtx,
  boost: number,
  dominanceScore: number,
): number {
  if (!TEAM_COORD_FLAGS.ENABLE_MOMENTUM_FATIGUE) return boost;

  if (dominanceScore > 0.4) {
    ctx.dominanceTurns++;
    ctx.momentumFatigue = Math.min(1, ctx.momentumFatigue + 0.08);
    ctx.telemetry.fatigueTurns++;
  } else {
    ctx.dominanceTurns  = Math.max(0, ctx.dominanceTurns - 1);
    ctx.momentumFatigue = Math.max(0, ctx.momentumFatigue - 0.05);
  }

  if (ctx.dominanceTurns >= 6) {
    const fatiguePenalty = Math.min(0.12, (ctx.dominanceTurns - 5) * 0.03);
    return Math.max(0.22, boost - fatiguePenalty);
  }

  return boost;
}

// ─────────────────────────────────────────────────────────────────────────────
// 18. Comeback Window System (v2)
// Deliberately reduce pressure when bots have a significant score lead,
// giving humans a real chance to recover and making the game feel fair.
// ─────────────────────────────────────────────────────────────────────────────

function applyCombackWindow(
  ctx:        TeamArenaGameCtx,
  boost:      number,
  personality: BotPersonality,
  teamEval:   TeamEval,
): { boost: number; personality: BotPersonality } {
  if (!TEAM_COORD_FLAGS.ENABLE_COMEBACK_WINDOWS) {
    return { boost, personality };
  }

  const lead = teamEval.scoreDelta;

  // Big lead (>20 pts): meaningful reduction
  if (lead > 20) {
    ctx.telemetry.humanMomentumCount++;
    return {
      boost:       Math.max(0.22, boost - 0.08),
      personality: personality === 'boss' ? 'smart' : personality,
    };
  }

  // Moderate lead (>12 pts): slight easing
  if (lead > 12) {
    return {
      boost:       Math.max(0.24, boost - 0.04),
      personality,
    };
  }

  return { boost, personality };
}

// ─────────────────────────────────────────────────────────────────────────────
// 19. Double-Boss Desync (v2)
// When two strong bots are in the game, offset their wave phase by the
// match-seeded bossPhaseOffset so they don't both surge on the same turn.
// ─────────────────────────────────────────────────────────────────────────────

function getEffectiveWavePhase(
  ctx:        TeamArenaGameCtx,
  botPlayerId: string,
): WavePhase {
  const offset = ctx.bossPhaseOffset.get(botPlayerId) ?? 0;
  if (offset === 0) return ctx.wavePhase;

  // Stagger by offset turns: if offset=1, this bot is 1 phase behind
  const phases: WavePhase[] = ['building', 'surge', 'cooldown', 'recovery'];
  const baseIdx = phases.indexOf(ctx.wavePhase);
  const shiftedIdx = (baseIdx + offset) % phases.length;
  return phases[shiftedIdx];
}

// ─────────────────────────────────────────────────────────────────────────────
// 20. Boss Identity Detection (v2)
// ─────────────────────────────────────────────────────────────────────────────

function detectBossIdentity(botName: string): BossIdentity {
  const n = botName.toLowerCase();
  if (n.includes('overlord')) return 'overlord';
  if (n.includes('nemesis'))  return 'nemesis';
  if (n.includes('blaze'))    return 'blaze';
  if (n.includes('phantom'))  return 'phantom';
  if (n.includes('cyclone'))  return 'cyclone';
  return 'generic';
}

// ─────────────────────────────────────────────────────────────────────────────
// 22. Human-like Hesitation (v2)
// In safe/early-game states, reduce bot reactivity to simulate deliberation.
// ─────────────────────────────────────────────────────────────────────────────

function applyHesitation(
  ctx:        TeamArenaGameCtx,
  boost:      number,
  teamEval:   TeamEval,
): number {
  if (!TEAM_COORD_FLAGS.ENABLE_HUMAN_HESITATION) return boost;

  // Only apply in early game or when there's no immediate threat
  if (ctx.globalTurn > 8) return boost;
  if (teamEval.humanShowDanger) return boost;

  // 20% chance of a hesitation micro-reduction early in the match
  if (Math.random() < 0.20) {
    return Math.max(0.22, boost - 0.04);
  }
  return boost;
}

// ─────────────────────────────────────────────────────────────────────────────
// 23. Team Chemistry Variation (v2)
// Match-seeded chemistry modulates how tightly the bot pair coordinates.
// High chemistry (>0.6): tighter stagger, better sacrifice timing.
// Low chemistry (< 0.4): looser coordination, more independent play.
// ─────────────────────────────────────────────────────────────────────────────

function applyTeamChemistry(
  ctx:           TeamArenaGameCtx,
  boost:         number,
  role:          TeamBotRole,
): number {
  if (!TEAM_COORD_FLAGS.ENABLE_TEAM_CHEMISTRY) return boost;

  const chem = ctx.teamChemistry;
  // High chemistry pairs coordinate better: slight boost on coordination roles
  if (chem > 0.6 && (role === 'denial' || role === 'support')) {
    return Math.min(0.35, boost + 0.02);
  }
  // Low chemistry: coordination is less efficient
  if (chem < 0.4 && (role === 'pressure' || role === 'closer')) {
    return Math.max(0.22, boost - 0.03);
  }
  return boost;
}

// ─────────────────────────────────────────────────────────────────────────────
// 24. Strategic Overconfidence (v2)
// When bots have been dominating for many turns, they occasionally overextend:
// more aggressive personality but sub-optimal tactical choices (bluff over boss).
// ─────────────────────────────────────────────────────────────────────────────

function applyOverconfidence(
  ctx:         TeamArenaGameCtx,
  personality: BotPersonality,
  teamEval:    TeamEval,
): BotPersonality {
  if (!TEAM_COORD_FLAGS.ENABLE_PRESSURE_VARIANCE) return personality;

  const scoreLead = teamEval.scoreDelta;

  if (scoreLead > 15 && ctx.dominanceTurns >= 4 && Math.random() < 0.20) {
    ctx.overconfidenceActive = true;
    ctx.overconfidenceTurns++;
    ctx.telemetry.overconfidenceEvents++;
    // Shift from smart/boss to aggressive/bluff — looks bold but less precise
    if (personality === 'boss') return 'aggressive';
    if (personality === 'smart') return 'bluff';
  } else {
    ctx.overconfidenceActive = false;
  }

  return personality;
}

// ─────────────────────────────────────────────────────────────────────────────
// 25. Recovery Bait System (v2)
// After a surge ends, there's a 15% chance the bots enter a "bait window":
// intentionally passive for 2 turns, then hit hard on turn 3.
// ─────────────────────────────────────────────────────────────────────────────

interface BaitResult {
  active:  boolean;
  boost:   number;
  personality: BotPersonality;
}

function applyRecoveryBait(
  ctx:         TeamArenaGameCtx,
  boost:       number,
  personality: BotPersonality,
  teamEval:    TeamEval,
): BaitResult {
  if (!TEAM_COORD_FLAGS.ENABLE_RECOVERY_BAIT) {
    return { active: false, boost, personality };
  }

  // Enter bait mode: 8% chance, minimum 8-turn gap, hard cap 1 per match.
  // Rare enough that players won't pattern-match it as a scripted trap.
  const baitGapOk = ctx.globalTurn - ctx.baitModeStartTurn >= 8;
  if (!ctx.baitMode &&
      ctx.baitCyclesUsed < 1 &&
      baitGapOk &&
      ctx.wavePhase === 'cooldown' &&
      ctx.surgeCount > 0 &&
      !teamEval.humanShowDanger &&
      Math.random() < 0.08) {
    ctx.baitMode          = true;
    ctx.baitModeStartTurn = ctx.globalTurn;
    ctx.baitCyclesUsed++;
    ctx.telemetry.baitCyclesTriggered++;
  }

  if (ctx.baitMode) {
    const baitTurns = ctx.globalTurn - ctx.baitModeStartTurn;

    // First 2 turns: passive (lure humans to commit)
    if (baitTurns < 2) {
      return {
        active:      true,
        boost:       Math.max(0.20, boost - 0.08),
        personality: 'safe',
      };
    }

    // Turn 3: snap back hard (counter-surge)
    ctx.baitMode = false;
    return {
      active:      true,
      boost:       Math.min(0.35, boost + 0.07),
      personality: 'boss',
    };
  }

  return { active: false, boost, personality };
}

// ─────────────────────────────────────────────────────────────────────────────
// 26. Advanced Memory Decay (v2)
// Behavioral flags lose confidence if not confirmed in recent turns.
// ─────────────────────────────────────────────────────────────────────────────

function decayHumanMemory(ctx: TeamArenaGameCtx): void {
  if (!TEAM_COORD_FLAGS.ENABLE_MATCH_MEMORY) return;

  const DECAY_WINDOW = 10;  // turns of inactivity before flag decays

  for (const [userId, mem] of ctx.humanMemory) {
    const staleTurns = ctx.globalTurn - mem.lastUpdateTurn;
    if (staleTurns > DECAY_WINDOW) {
      // Fade flags that haven't been confirmed recently
      if (mem.flagConfirmations.hoards7s < 2)    mem.hoards7s      = false;
      if (mem.flagConfirmations.rushesShow < 2)   mem.rushesShow    = false;
      if (mem.flagConfirmations.recoversSlowly < 2) mem.recoversSlowly = false;
    }
    ctx.humanMemory.set(userId, mem);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 27. Replayability Variance (v2)
// Match seed drives a small deterministic boost/personality variance so each
// session feels different even with the same stage/tier.
// ─────────────────────────────────────────────────────────────────────────────

function computeReplayVariance(ctx: TeamArenaGameCtx, boost: number): number {
  if (!TEAM_COORD_FLAGS.ENABLE_PRESSURE_VARIANCE) return boost;

  // Seed gives a -0.02 to +0.02 micro-shift, deterministic per match
  const variance = ((ctx.matchSeed % 5) - 2) * 0.01;
  return Math.min(0.35, Math.max(0.20, boost + variance));
}

// ─────────────────────────────────────────────────────────────────────────────
// 28. Fairness Protection (v2)
// If bots have been at max boost for too many consecutive turns, force a dip.
// ─────────────────────────────────────────────────────────────────────────────

function applyFairnessProtection(
  ctx:   TeamArenaGameCtx,
  boost: number,
): number {
  const MAX_CONSECUTIVE = 4;

  if (boost >= 0.34) {
    ctx.consecutiveMaxBoostTurns++;
  } else {
    ctx.consecutiveMaxBoostTurns = 0;
  }

  if (ctx.consecutiveMaxBoostTurns > MAX_CONSECUTIVE) {
    return Math.max(0.26, boost - 0.06);
  }

  return boost;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface TeamArenaAugmentation {
  forceDecision?:       BotDecision;
  effectivePersonality: BotPersonality;
  effectiveBoost:       number;
  augmentedOpponents:   OpponentProfile[];
}

/**
 * Main entry point — call once per bot turn from executeBotTurn().
 * Returns null if ENABLE_TEAM_COORDINATION is false OR not a team arena game.
 */
export function teamArenaAugment(
  state:           GameState,
  botPlayerId:     string,
  basePersonality: BotPersonality,
  baseBoost:       number,
  baseOpponents:   OpponentProfile[],
  botUsername?:    string,
): TeamArenaAugmentation | null {
  if (!TEAM_COORD_FLAGS.ENABLE_TEAM_COORDINATION) return null;
  if (!isTeamArenaGame(state)) return null;

  // Lazily init coordination state for this game
  let ctx = gameCtxMap.get(state.id);
  if (!ctx) {
    initTeamArenaGame(state.id);
    ctx = gameCtxMap.get(state.id)!;
  }

  const botName = botUsername ?? '';

  // v2: Register boss identity and phase offset on first encounter
  if (!ctx.bossIdentities.has(botPlayerId)) {
    const identity = detectBossIdentity(botName);
    ctx.bossIdentities.set(botPlayerId, identity);
    // Phase offset: bots with offset=1 surge one phase later (async desync)
    const hasTwoBosses = Array.from(ctx.bossIdentities.values())
      .filter(id => id !== 'generic').length >= 2;
    ctx.bossPhaseOffset.set(
      botPlayerId,
      hasTwoBosses ? (ctx.matchSeed % 3 === 0 ? 1 : 0) : 0,
    );

    // Detect Stage 5 (Overlord + Nemesis) — triggers extra fairness caps
    const allIdentities = Array.from(ctx.bossIdentities.values());
    ctx.isFinalOverlords = allIdentities.includes('overlord') && allIdentities.includes('nemesis');
  }

  // ── Compute all signals ──────────────────────────────────────────────────
  const teamEval   = evaluateTeams(state);
  const showThreat = teamShowThreatLevel(teamEval, ctx.humanMemory);

  // Update memory with decay
  updateHumanMemory(ctx, baseOpponents);
  decayHumanMemory(ctx);
  advanceWavePhase(ctx, teamEval);

  // v2: Dominance tracking
  const dominanceScore = computeDominanceScore(teamEval);
  if (dominanceScore > ctx.telemetry.maxDominanceScore) {
    ctx.telemetry.maxDominanceScore = dominanceScore;
  }

  const coord = detectHumanCoordination(ctx, teamEval, baseOpponents);

  // v2: Use per-bot effective wave phase (desync for double-boss)
  const effectivePhase = getEffectiveWavePhase(ctx, botPlayerId);

  const role = assignRole(state, ctx, botPlayerId, teamEval, showThreat);

  const augmentedOpponents = buildTeamAwareProfiles(baseOpponents, teamEval, ctx, coord);

  // ── Build effective personality and boost ────────────────────────────────
  let effectivePersonality = roleToPersonality(basePersonality, role, effectivePhase, showThreat);
  let effectiveBoost = computeTeamBoost(baseBoost, role, effectivePhase, showThreat, teamEval);

  // Boss weakness (fairness)
  effectiveBoost = applyBossWeakness(basePersonality, effectivePersonality, effectivePhase, effectiveBoost, botName);

  // Sacrifice strategy
  if (shouldBePassive(state, botPlayerId)) {
    effectivePersonality = 'safe';
    effectiveBoost       = Math.max(0.22, effectiveBoost - 0.06);
  }

  // Stagger aggression
  if (shouldStaggerAggression(botPlayerId, ctx)) {
    effectiveBoost = Math.max(0.24, effectiveBoost - 0.05);
  }

  // ── v2 systems applied in order ─────────────────────────────────────────

  // 16. AI Imperfection
  const imperf = tryTriggerImperfection(ctx, effectiveBoost, effectivePersonality, teamEval);
  if (imperf.fired) {
    effectiveBoost       = imperf.effectiveBoost;
    effectivePersonality = imperf.effectivePersonality;
  }

  // 17. Momentum Fatigue
  effectiveBoost = applyMomentumFatigue(ctx, effectiveBoost, dominanceScore);

  // 18. Comeback Window
  const comeback = applyCombackWindow(ctx, effectiveBoost, effectivePersonality, teamEval);
  effectiveBoost       = comeback.boost;
  effectivePersonality = comeback.personality;

  // 22. Human-like Hesitation
  effectiveBoost = applyHesitation(ctx, effectiveBoost, teamEval);

  // 23. Team Chemistry
  effectiveBoost = applyTeamChemistry(ctx, effectiveBoost, role);

  // 24. Overconfidence
  effectivePersonality = applyOverconfidence(ctx, effectivePersonality, teamEval);

  // 25. Recovery Bait
  const bait = applyRecoveryBait(ctx, effectiveBoost, effectivePersonality, teamEval);
  if (bait.active) {
    effectiveBoost       = bait.boost;
    effectivePersonality = bait.personality;
  }

  // 27. Replayability variance
  effectiveBoost = computeReplayVariance(ctx, effectiveBoost);

  // 28. Fairness protection
  effectiveBoost = applyFairnessProtection(ctx, effectiveBoost);

  // Stage 5 safety cap (Overlord + Nemesis dual-boss).
  // Hard ceiling on boost + tighter comeback threshold to prevent a runaway wall.
  if (ctx.isFinalOverlords) {
    effectiveBoost = Math.min(0.30, effectiveBoost);
    // Comeback window fires earlier in Stage 5 (>15 pts, not >20)
    if (teamEval.scoreDelta > 15) {
      effectiveBoost       = Math.max(0.20, effectiveBoost - 0.07);
      if (effectivePersonality === 'boss') effectivePersonality = 'smart';
    }
  }

  // Record aggressor for cross-bot coordination
  ctx.lastAggressorId    = botPlayerId;
  ctx.lastAggressionTurn = ctx.globalTurn;

  return {
    effectivePersonality,
    effectiveBoost,
    augmentedOpponents,
  };
}
