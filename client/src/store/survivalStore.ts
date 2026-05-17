import { create } from 'zustand';
import { on, socketSurvival } from '../services/socket';
import { notify } from '../services/notify';

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

interface SurvivalStore {
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

  subscribe: () => () => void;
  clearStageResult: () => void;
  clearTiebreakerResult: () => void;
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

  subscribe: () => {
    const unsubs: Array<() => void> = [];

    unsubs.push(on('survival:started', (data: any) => {
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
    }));

    unsubs.push(on('survival:resumed', (data: any) => {
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
    }));

    unsubs.push(on('survival:stage_result', (result: any) => {
      set(s => ({
        currentStage:      result.nextStage ?? s.currentStage,
        stageResults:      result.stageResults,
        totalPointsEarned: result.totalPointsEarned ?? s.totalPointsEarned,
        stageResult:       result,
        tiebreakerResult:  null,
        active:            !result.tournamentOver,
      }));

      if (result.tournamentOver && result.won) {
        notify.success(`Champion! You defeated all 5 bots! +${result.totalPointsEarned} pts earned!`, { duration: 6000 });
      }
    }));

    unsubs.push(on('survival:tiebreaker', (result: any) => {
      set({ tiebreakerResult: result, stageResult: null });
      notify.error('It\'s a Tie! One tiebreaker round added — win it to advance!', { duration: 4000 });
    }));

    unsubs.push(on('survival:error', (msg: any) => notify.error(msg)));

    unsubs.push(on('survival:abandoned', (data) => {
      set({ active: false, survivalId: null, stageResult: null });
      if (data.forcedByAdmin) {
        notify.error('Your survival tournament was ended by an admin.', { duration: 5000 });
      } else if (data.refunded && (data.refundAmount ?? 0) > 0) {
        notify.success(`Tournament quit. ₹${(data.refundAmount! / 100).toFixed(2)} refunded to your wallet.`, { duration: 5000 });
      } else {
        notify.error('Tournament abandoned. No refund — rounds were played.', { duration: 4000 });
      }
    }));

    return () => unsubs.forEach(u => u());
  },

  clearStageResult: () => set({ stageResult: null }),

  clearTiebreakerResult: () => set({ tiebreakerResult: null }),

  continueToNextStage: () => {
    set({ stageResult: null });
    socketSurvival.continue();
  },

  playTiebreaker: () => {
    set({ tiebreakerResult: null });
    socketSurvival.continue();
  },

  reset: () => set({
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
  }),
}));
