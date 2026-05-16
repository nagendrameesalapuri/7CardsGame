/**
 * gameAnalytics — lightweight in-memory telemetry for competitive balancing.
 *
 * Tracks events per game session. Admin dashboard reads aggregates.
 * No PII is stored — only gameplay signals.
 *
 * Events tracked:
 *  show_attempt   — who called SHOW and at what hand total
 *  attack_chain   — 7-card attack details
 *  jack_skip      — J used to skip, and whether it mattered
 *  round_end      — winner type, round duration, bot personality
 *  stage_cleared  — survival stage pass/fail
 *  farming_signal — pattern detected that looks like exploitation
 */

export type AnalyticsEvent =
  | { type: "show_attempt";   gameId: string; userId: string; isBot: boolean; handTotal: number; success: boolean; personality?: string }
  | { type: "attack_chain";   gameId: string; attackerId: string; isBot: boolean; cardsThrown: number; targetTook: boolean }
  | { type: "jack_skip";      gameId: string; userId: string; isBot: boolean; targetHandCount: number; deniedShow: boolean }
  | { type: "round_end";      gameId: string; winnerIsBot: boolean; durationMs: number; roundNumber: number; botPersonality?: string; loserTotal: number }
  | { type: "stage_cleared";  gameId: string; userId: string; stage: number; passed: boolean; roundsPlayed: number }
  | { type: "farming_signal"; gameId: string; userId: string; indicator: number; details: string }
  | { type: "game_started";   gameId: string; botCount: number; humanCount: number; botPersonality: string; difficultyBoost: number };

interface AggregatedStats {
  totalGames: number;
  totalRounds: number;
  botWins: number;
  humanWins: number;
  showAttempts: number;
  showSuccesses: number;
  failedShows: number;
  attackChains: number;
  attackChainsTookPenalty: number;
  jackSkips: number;
  jackSkipsDeniedShow: number;
  farmingSignalsDetected: number;
  avgRoundDurationMs: number;
  roundDurationsMs: number[];
  stagesClearedByStage: Record<number, { passed: number; failed: number }>;
  botWinsByPersonality: Record<string, number>;
  humanWinsByPersonality: Record<string, number>;
  showSuccessByTotal: Record<number, { attempts: number; successes: number }>;
}

// ── In-memory store ───────────────────────────────────────────────────────────

const events: AnalyticsEvent[] = [];
const MAX_EVENTS = 5000; // rolling window — prevents unbounded memory growth

const stats: AggregatedStats = {
  totalGames: 0,
  totalRounds: 0,
  botWins: 0,
  humanWins: 0,
  showAttempts: 0,
  showSuccesses: 0,
  failedShows: 0,
  attackChains: 0,
  attackChainsTookPenalty: 0,
  jackSkips: 0,
  jackSkipsDeniedShow: 0,
  farmingSignalsDetected: 0,
  avgRoundDurationMs: 0,
  roundDurationsMs: [],
  stagesClearedByStage: {},
  botWinsByPersonality: {},
  humanWinsByPersonality: {},
  showSuccessByTotal: {},
};

// ── Record ────────────────────────────────────────────────────────────────────

export function recordEvent(event: AnalyticsEvent): void {
  events.push(event);
  if (events.length > MAX_EVENTS) events.shift(); // rolling window

  // Update aggregates immediately so reads are O(1)
  switch (event.type) {
    case "game_started":
      stats.totalGames++;
      break;

    case "show_attempt": {
      stats.showAttempts++;
      if (event.success) stats.showSuccesses++;
      else stats.failedShows++;
      // Track show success rate by hand total
      const t = Math.min(event.handTotal, 15);
      if (!stats.showSuccessByTotal[t]) stats.showSuccessByTotal[t] = { attempts: 0, successes: 0 };
      stats.showSuccessByTotal[t].attempts++;
      if (event.success) stats.showSuccessByTotal[t].successes++;
      break;
    }

    case "attack_chain":
      stats.attackChains++;
      if (event.targetTook) stats.attackChainsTookPenalty++;
      break;

    case "jack_skip":
      stats.jackSkips++;
      if (event.deniedShow) stats.jackSkipsDeniedShow++;
      break;

    case "round_end": {
      stats.totalRounds++;
      if (event.winnerIsBot) {
        stats.botWins++;
        if (event.botPersonality) {
          stats.botWinsByPersonality[event.botPersonality] =
            (stats.botWinsByPersonality[event.botPersonality] ?? 0) + 1;
        }
      } else {
        stats.humanWins++;
        if (event.botPersonality) {
          stats.humanWinsByPersonality[event.botPersonality] =
            (stats.humanWinsByPersonality[event.botPersonality] ?? 0) + 1;
        }
      }
      stats.roundDurationsMs.push(event.durationMs);
      if (stats.roundDurationsMs.length > 200) stats.roundDurationsMs.shift();
      stats.avgRoundDurationMs = stats.roundDurationsMs.reduce((a, b) => a + b, 0) /
        stats.roundDurationsMs.length;
      break;
    }

    case "stage_cleared": {
      if (!stats.stagesClearedByStage[event.stage]) {
        stats.stagesClearedByStage[event.stage] = { passed: 0, failed: 0 };
      }
      if (event.passed) stats.stagesClearedByStage[event.stage].passed++;
      else stats.stagesClearedByStage[event.stage].failed++;
      break;
    }

    case "farming_signal":
      stats.farmingSignalsDetected++;
      break;
  }
}

// ── Read ──────────────────────────────────────────────────────────────────────

export function getAnalyticsSnapshot() {
  const totalDecidedRounds = stats.botWins + stats.humanWins;
  const botWinRate  = totalDecidedRounds > 0 ? stats.botWins  / totalDecidedRounds : null;
  const humanWinRate = totalDecidedRounds > 0 ? stats.humanWins / totalDecidedRounds : null;
  const showSuccessRate = stats.showAttempts > 0 ? stats.showSuccesses / stats.showAttempts : null;
  const attackEffectiveness = stats.attackChains > 0
    ? stats.attackChainsTookPenalty / stats.attackChains : null;
  const jackEffectiveness = stats.jackSkips > 0
    ? stats.jackSkipsDeniedShow / stats.jackSkips : null;

  // Win rate per personality (bot POV)
  const winRateByPersonality: Record<string, number | null> = {};
  for (const p of ["safe", "aggressive", "bluff", "smart", "boss"]) {
    const bw = stats.botWinsByPersonality[p] ?? 0;
    const hw = stats.humanWinsByPersonality[p] ?? 0;
    const total = bw + hw;
    winRateByPersonality[p] = total > 0 ? bw / total : null;
  }

  // Stage clear rates
  const stageClearRates: Record<number, number | null> = {};
  for (const [stage, data] of Object.entries(stats.stagesClearedByStage)) {
    const total = data.passed + data.failed;
    stageClearRates[Number(stage)] = total > 0 ? data.passed / total : null;
  }

  return {
    summary: {
      totalGames:           stats.totalGames,
      totalRounds:          stats.totalRounds,
      botWinRate:           botWinRate != null ? +(botWinRate * 100).toFixed(1) : null,
      humanWinRate:         humanWinRate != null ? +(humanWinRate * 100).toFixed(1) : null,
      showSuccessRate:      showSuccessRate != null ? +(showSuccessRate * 100).toFixed(1) : null,
      failedShowRate:       stats.showAttempts > 0
        ? +((stats.failedShows / stats.showAttempts) * 100).toFixed(1) : null,
      attackEffectiveness:  attackEffectiveness != null ? +(attackEffectiveness * 100).toFixed(1) : null,
      jackEffectiveness:    jackEffectiveness != null ? +(jackEffectiveness * 100).toFixed(1) : null,
      avgRoundDurationSec:  +(stats.avgRoundDurationMs / 1000).toFixed(1),
      farmingSignals:       stats.farmingSignalsDetected,
    },
    winRateByPersonality,
    stageClearRates,
    showSuccessByTotal:     stats.showSuccessByTotal,
    recentEvents:           events.slice(-50), // last 50 events for debug
  };
}

export function resetAnalytics(): void {
  events.length = 0;
  Object.assign(stats, {
    totalGames: 0, totalRounds: 0, botWins: 0, humanWins: 0,
    showAttempts: 0, showSuccesses: 0, failedShows: 0,
    attackChains: 0, attackChainsTookPenalty: 0,
    jackSkips: 0, jackSkipsDeniedShow: 0,
    farmingSignalsDetected: 0, avgRoundDurationMs: 0,
    roundDurationsMs: [], stagesClearedByStage: {},
    botWinsByPersonality: {}, humanWinsByPersonality: {},
    showSuccessByTotal: {},
  });
}
