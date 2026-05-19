import { create } from 'zustand';
import { on, socketTeamArena } from '../services/socket';
import { notify } from '../services/notify';

export interface TeamArenaScoreboardEntry {
  name: string;
  score: number;
  isHuman: boolean;
  team: 'A' | 'B';
}

export interface RoundPlayerResult {
  playerId: string;
  username: string;
  avatar: string;
  isBot: boolean;
  team: 'A' | 'B';
  roundPoints: number;
  totalScore: number;
  hand: Array<{ id: string; suit: string; rank: string; value: number; isJoker: boolean }>;
}

export interface RoundHistoryEntry {
  roundNumber: number;
  playerResults: RoundPlayerResult[];
}

export interface TeamArenaStageResult {
  stage: number;
  totalStages: number;
  stageName: string;
  stageSubtitle: string;
  teamAScore: number;
  teamBScore: number;
  teamAWon: boolean;
  isDraw: boolean;
  scoreboard: TeamArenaScoreboardEntry[];
  pointsEarned: number;
  stageResults: any[];
  enemyBotNames: string[];
  teammateName: string;
  tournamentOver: boolean;
  won?: boolean;
  totalPointsEarned?: number;
  nextStage?: number;
  nextRoomCode?: string;
  nextStageName?: string;
  nextStageSubtitle?: string;
  nextStageConfig?: any;
  newWalletBalance?: number;
  roundHistory?: RoundHistoryEntry[];
}

interface TeamArenaStore {
  // Tournament state
  active: boolean;
  tournamentId: string | null;
  inviteCode: string | null;
  teammateType: 'ai' | 'human' | null;
  teammateName: string | null;
  aiPersonality: string | null;
  entryPoints: number;
  currentStage: number;
  totalStages: number;
  totalPointsEarned: number;
  stageResults: any[];
  waitingForTeammate: boolean;
  isTeammate: boolean;

  // UI state
  stageResult: TeamArenaStageResult | null;
  showStageIntro: boolean;
  introStage: number;

  // Actions
  subscribe: () => () => void;
  clearStageResult: () => void;
  continueToNextStage: () => void;
  dismissStageIntro: () => void;
  reset: () => void;
}

export const useTeamArenaStore = create<TeamArenaStore>((set, get) => ({
  active: false,
  tournamentId: null,
  inviteCode: null,
  teammateType: null,
  teammateName: null,
  aiPersonality: null,
  entryPoints: 0,
  currentStage: 1,
  totalStages: 5,
  totalPointsEarned: 0,
  stageResults: [],
  waitingForTeammate: false,
  isTeammate: false,
  stageResult: null,
  showStageIntro: false,
  introStage: 1,

  subscribe: () => {
    const unsubs: Array<() => void> = [];

    unsubs.push(on('team-arena:started', (data: any) => {
      set({
        active: true,
        tournamentId: data.tournamentId,
        inviteCode: data.inviteCode,
        teammateType: data.teammateType,
        teammateName: data.teammateName,
        aiPersonality: data.aiPersonality ?? null,
        entryPoints: data.entryPoints,
        currentStage: data.currentStage,
        totalStages: data.totalStages ?? 5,
        totalPointsEarned: 0,
        stageResults: [],
        waitingForTeammate: data.waitingForTeammate ?? false,
        isTeammate: data.isTeammate ?? false,
        stageResult: null,
        showStageIntro: true,
        introStage: data.currentStage ?? 1,
      });
    }));

    unsubs.push(on('team-arena:teammate_joined', (data: any) => {
      set({ waitingForTeammate: false, teammateName: data.teammateName });
      notify.success(`${data.teammateName} joined your team!`, { duration: 4000 });
    }));

    unsubs.push(on('team-arena:stage_result', (result: any) => {
      const hasNextStage = !result.tournamentOver && result.nextStage != null;
      set((s) => ({
        currentStage: result.nextStage ?? s.currentStage,
        stageResults: result.stageResults ?? s.stageResults,
        totalPointsEarned: result.totalPointsEarned ?? s.totalPointsEarned,
        stageResult: result,
        active: !result.tournamentOver,
        // Show intro for the upcoming stage; shown before the stage result overlay
        showStageIntro: hasNextStage,
        introStage: result.nextStage ?? s.currentStage,
      }));

      if (result.tournamentOver && result.won) {
        notify.success(
          `Champions! Your team cleared all 5 stages! +${result.totalPointsEarned} pts earned!`,
          { duration: 7000 },
        );
      }
    }));

    unsubs.push(on('team-arena:abandoned', (data: any) => {
      set({ active: false, tournamentId: null, stageResult: null, waitingForTeammate: false, showStageIntro: false });
      if (data.forcedByAdmin) {
        notify.error('Your Team Arena tournament was ended by an admin.', { duration: 5000 });
      } else if (data.hostLeft) {
        notify.error('Your team captain abandoned the tournament.', { duration: 5000 });
      } else if (data.refunded && (data.refundAmount ?? 0) > 0) {
        notify.success(
          `Tournament quit. ₹${(data.refundAmount! / 100).toFixed(2)} refunded to your wallet.`,
          { duration: 5000 },
        );
      } else {
        notify.error('Tournament abandoned. No refund — rounds were played.', { duration: 4000 });
      }
    }));

    // Restore active tournament state when the server sends a status response
    // (e.g. on page load when player already has an ongoing tournament)
    unsubs.push(on('team-arena:status_result', (data: any) => {
      if (!data) return; // null = no active tournament
      const isActive = data.status === 'active' || data.status === 'waiting_teammate';
      if (!isActive) return;
      // On resume, skip intro so the player goes straight to the game
      set((s) => ({
        active: true,
        tournamentId: data.tournamentId ?? s.tournamentId,
        inviteCode: data.inviteCode ?? s.inviteCode,
        teammateType: data.teammateType ?? s.teammateType,
        teammateName: data.teammateName ?? s.teammateName,
        aiPersonality: s.aiPersonality,
        entryPoints: data.entryPoints ?? s.entryPoints,
        currentStage: data.currentStage ?? s.currentStage,
        totalStages: data.totalStages ?? s.totalStages,
        totalPointsEarned: data.totalPointsEarned ?? s.totalPointsEarned,
        stageResults: data.stageResults ?? s.stageResults,
        waitingForTeammate: data.status === 'waiting_teammate',
        isTeammate: !(data.isHost ?? true),
        showStageIntro: false, // no intro on resume
      }));
    }));

    unsubs.push(on('team-arena:error', (msg: any) => notify.error(msg)));

    return () => unsubs.forEach((u) => u());
  },

  clearStageResult: () => set({ stageResult: null }),

  continueToNextStage: () => {
    set({ stageResult: null });
    socketTeamArena.continue();
  },

  dismissStageIntro: () => set({ showStageIntro: false }),

  reset: () => set({
    active: false,
    tournamentId: null,
    inviteCode: null,
    teammateType: null,
    teammateName: null,
    aiPersonality: null,
    entryPoints: 0,
    currentStage: 1,
    totalStages: 5,
    totalPointsEarned: 0,
    stageResults: [],
    waitingForTeammate: false,
    isTeammate: false,
    stageResult: null,
    showStageIntro: false,
    introStage: 1,
  }),
}));
