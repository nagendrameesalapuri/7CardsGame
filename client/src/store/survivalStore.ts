import { create } from "zustand";
import { on, socketSurvival, socketTeam } from "../services/socket";
import { notify } from "../services/notify";

export interface StageResult {
  stage: number;
  personality: string;
  playerWon: boolean;
  playerScore: number;
  botScore: number;
  botScores?: number[];
  botNames?: string[];
  pointsEarned: number;
}

export interface ScoreboardEntry {
  name: string;
  score: number;
  isHuman: boolean;
}

export interface SurvivalStageResult {
  stage: number;
  totalStages: number;
  stageName: string;
  stageDesc?: string;
  botNames: string[];
  personalities: string[];
  playerWon: boolean;
  isDraw: boolean;
  eliminatedByDraw?: boolean;
  playerScore: number;
  botScore: number;
  botScores: number[];
  scoreboard: ScoreboardEntry[];
  pointsEarned: number;
  stageResults: StageResult[];
  tournamentOver: boolean;
  won?: boolean;
  totalPointsEarned?: number;
  nextStage?: number;
  nextRoomCode?: string;
  nextStageName?: string;
  nextStageDesc?: string;
  nextBotNames?: string[];
  nextPersonalities?: string[];
  newWalletBalance?: number;
}

export interface SurvivalTiebreakerResult {
  stage: number;
  stageName: string;
  stageDesc?: string;
  botNames: string[];
  personalities: string[];
  playerScore: number;
  botScore: number;
  botScores: number[];
  scoreboard: ScoreboardEntry[];
  stageResults: StageResult[];
}

// ── Team types ────────────────────────────────────────────────────────────────

export interface TeamMember {
  userId: string;
  username: string;
  avatar: string;
  isBot?: boolean;
  personality?: string | null;
}

export interface TeamState {
  teamCode: string;
  hostId: string;
  tier: string;
  entryFeeMode: "split" | "host_pays";
  maxSize: number;
  members: TeamMember[];
  status: "forming" | "playing" | "completed" | "abandoned";
  currentStage: number;
  currentRoomCode: string | null;
  stageResults: TeamStageResult[];
  totalPointsEarned: number;
  entryPoints: number;
}

export interface TeamStageResult {
  stage: number;
  teamScore: number;
  botTotalScore: number;
  botScores: number[];
  botNames: string[];
  teamWon: boolean;
  pointsEarned: number;
  stageName?: string;
  stageDesc?: string;
  scoreboard?: { name: string; score: number; isTeam: boolean }[];
  tournamentOver?: boolean;
  won?: boolean;
  totalPointsEarned?: number;
  nextStage?: number;
  nextRoomCode?: string;
  nextStageName?: string;
  nextStageDesc?: string;
  nextBotNames?: string[];
  isTeamMode: true;
  entryFeeMode?: "split" | "host_pays";
  prizeNote?: string;
}

interface SurvivalStore {
  // Individual tournament state
  active: boolean;
  survivalId: string | null;
  tier: string | null;
  currentStage: number;
  totalStages: number;
  entryPoints: number;
  totalPointsEarned: number;
  stageResults: StageResult[];
  stageResult: SurvivalStageResult | null;
  tiebreakerResult: SurvivalTiebreakerResult | null;

  // Team tournament state
  teamState: TeamState | null;
  teamStageResult: TeamStageResult | null;
  teamError: string | null;

  subscribe: () => () => void;
  clearStageResult: () => void;
  clearTiebreakerResult: () => void;
  clearTeamStageResult: () => void;
  clearTeamError: () => void;
  continueToNextStage: () => void;
  playTiebreaker: () => void;
  reset: () => void;
}

export const useSurvivalStore = create<SurvivalStore>((set, get) => ({
  active: false,
  survivalId: null,
  tier: null,
  currentStage: 1,
  totalStages: 5,
  entryPoints: 0,
  totalPointsEarned: 0,
  stageResults: [],
  stageResult: null,
  tiebreakerResult: null,

  teamState: null,
  teamStageResult: null,
  teamError: null,

  subscribe: () => {
    const unsubs: Array<() => void> = [];

    // ── Individual ────────────────────────────────────────────────────────────
    unsubs.push(
      on("survival:started", (data: any) => {
        set({
          active: true,
          survivalId: data.survivalId,
          tier: data.tier,
          currentStage: data.currentStage,
          totalStages: 5,
          entryPoints: data.entryPoints,
          totalPointsEarned: 0,
          stageResults: [],
          stageResult: null,
        });
      }),
    );

    unsubs.push(
      on("survival:resumed", (data: any) => {
        set({
          active: true,
          survivalId: data.survivalId,
          tier: data.tier,
          currentStage: data.currentStage,
          totalStages: 5,
          entryPoints: data.entryPoints,
          totalPointsEarned: data.totalPointsEarned ?? 0,
          stageResults: data.stageResults ?? [],
          stageResult: null,
        });
      }),
    );

    unsubs.push(
      on("survival:stage_result", (result: any) => {
        set((s) => ({
          currentStage: result.nextStage ?? s.currentStage,
          stageResults: result.stageResults,
          totalPointsEarned: result.totalPointsEarned ?? s.totalPointsEarned,
          stageResult: result,
          tiebreakerResult: null,
          active: !result.tournamentOver,
        }));

        if (result.tournamentOver && result.won) {
          notify.success(
            `Champion! You defeated all 5 bots! +${result.totalPointsEarned} pts earned!`,
            { duration: 6000 },
          );
        }
      }),
    );

    unsubs.push(
      on("survival:tiebreaker", (result: any) => {
        set((s) => {
          const stageNum =
            typeof result?.stage === "number" ? result.stage : NaN;
          // Validate: only accept tiebreaker for the current or immediately previous stage.
          if (
            Number.isNaN(stageNum) ||
            (stageNum !== s.currentStage && stageNum !== s.currentStage - 1)
          ) {
            console.warn("[Survival] Ignored spurious tiebreaker event", {
              receivedStage: result?.stage,
              currentStage: s.currentStage,
            });
            return s; // no state change
          }

          // Accept and show tiebreaker overlay
          notify.error(
            "It's a Tie! One tiebreaker round added — win it to advance!",
            { duration: 4000 },
          );
          return { ...s, tiebreakerResult: result, stageResult: null } as any;
        });
      }),
    );

    unsubs.push(on("survival:error", (msg: any) => notify.error(msg)));

    unsubs.push(
      on("survival:abandoned", (data) => {
        set({ active: false, survivalId: null, stageResult: null });
        if (data.forcedByAdmin) {
          notify.error("Your survival tournament was ended by an admin.", {
            duration: 5000,
          });
        } else if (data.refunded && (data.refundAmount ?? 0) > 0) {
          notify.success(
            `Tournament quit. ₹${(data.refundAmount! / 100).toFixed(2)} refunded to your wallet.`,
            { duration: 5000 },
          );
        } else {
          notify.error(
            "Tournament abandoned. No refund — rounds were played.",
            { duration: 4000 },
          );
        }
      }),
    );

    // ── Team ──────────────────────────────────────────────────────────────────
    unsubs.push(
      on("survival:team_updated", (data: any) => {
        set({ teamState: data ?? null, teamError: null });
      }),
    );

    unsubs.push(
      on("survival:team_started", (data: any) => {
        set((s) => ({
          teamState: s.teamState
            ? { ...s.teamState, status: "playing", currentStage: 1 }
            : s.teamState,
          teamStageResult: null,
          teamError: null,
        }));
      }),
    );

    unsubs.push(
      on("survival:team_stage_result", (result: any) => {
        set((s) => ({
          teamState: s.teamState
            ? {
                ...s.teamState,
                currentStage: result.nextStage ?? s.teamState.currentStage,
                stageResults: [
                  ...(s.teamState.stageResults ?? []),
                  {
                    stage: result.stage,
                    teamScore: result.teamScore,
                    botTotalScore: result.botTotalScore,
                    botScores: result.botScores,
                    botNames: result.botNames,
                    teamWon: result.teamWon,
                    pointsEarned: result.pointsEarned,
                    isTeamMode: true,
                  },
                ],
                totalPointsEarned:
                  result.totalPointsEarned ??
                  s.teamState.totalPointsEarned +
                    (result.teamWon ? result.pointsEarned : 0),
              }
            : s.teamState,
          teamStageResult: result,
          teamError: null,
        }));

        if (result.tournamentOver && result.won) {
          notify.success(
            `Team Champion! All 5 stages cleared! +${result.totalPointsEarned} pts each!`,
            { duration: 6000 },
          );
        } else if (result.tournamentOver && !result.won) {
          notify.error(
            `Team eliminated at Stage ${result.stage}. Better luck next time!`,
            { duration: 5000 },
          );
        } else if (result.teamWon) {
          notify.success(
            `Stage ${result.stage} cleared! +${result.pointsEarned} pts each!`,
            { duration: 3000 },
          );
        }
      }),
    );

    unsubs.push(
      on("survival:team_stage_started", () => {
        set({ teamStageResult: null });
      }),
    );

    unsubs.push(
      on("survival:team_disbanded", () => {
        set({ teamState: null, teamStageResult: null });
        notify.error("Team was disbanded by the host.", { duration: 4000 });
      }),
    );

    unsubs.push(
      on(
        "survival:team_quit_result",
        (data: { refunded: boolean; refundAmount: number }) => {
          set({ teamState: null, teamStageResult: null });
          if (data.refunded && data.refundAmount > 0) {
            notify.success(
              `Tournament quit. Entry fee refunded: +${data.refundAmount.toLocaleString()} pts`,
              { duration: 5000 },
            );
          } else {
            notify.info("Tournament quit. No refund (rounds already played).", {
              duration: 4000,
            });
          }
        },
      ),
    );

    unsubs.push(
      on("survival:team_error", (msg: string) => {
        set({ teamError: msg });
        notify.error(msg, { duration: 5000 });
      }),
    );

    return () => unsubs.forEach((u) => u());
  },

  clearStageResult: () => set({ stageResult: null }),
  clearTiebreakerResult: () => set({ tiebreakerResult: null }),
  clearTeamStageResult: () => set({ teamStageResult: null }),
  clearTeamError: () => set({ teamError: null }),

  continueToNextStage: () => {
    set({ stageResult: null });
    socketSurvival.continue();
  },

  playTiebreaker: () => {
    set({ tiebreakerResult: null });
    socketSurvival.continue();
  },

  reset: () =>
    set({
      active: false,
      survivalId: null,
      tier: null,
      currentStage: 1,
      totalStages: 5,
      entryPoints: 0,
      totalPointsEarned: 0,
      stageResults: [],
      stageResult: null,
      tiebreakerResult: null,
      teamState: null,
      teamStageResult: null,
      teamError: null,
    }),
}));
