import { create } from 'zustand';
import { on, socketGame } from '../services/socket';
import { notify } from '../services/notify';

export interface TournamentGameResult {
  gameNumber: number;
  playerWins: number;
  botWins: number;
  draws: number;
  isDraw: boolean;
  playerWon: boolean;
  playerScore: number;
  botScore: number;
  tournamentOver: boolean;
  won?: boolean;
  overallDraw?: boolean;
  prizeAmount?: number;
  totalReturn?: number;
  nextGameNumber?: number;
  nextRoomCode?: string;
}

interface TournamentStore {
  active: boolean;
  tournamentId: string | null;
  gameNumber: number;
  playerWins: number;
  botWins: number;
  entryFee: number;
  prizeAmount: number;
  gameResult: TournamentGameResult | null;

  subscribe: () => () => void;
  clearResult: () => void;
  continueToNextGame: () => void;
  reset: () => void;
}

export const useTournamentStore = create<TournamentStore>((set, get) => ({
  active: false,
  tournamentId: null,
  gameNumber: 1,
  playerWins: 0,
  botWins: 0,
  entryFee: 0,
  prizeAmount: 0,
  gameResult: null,

  subscribe: () => {
    const unsubs: Array<() => void> = [];

    unsubs.push(on('tournament:started', (data) => {
      set({
        active: true,
        tournamentId: data.tournamentId,
        gameNumber: data.gameNumber,
        playerWins: 0,
        botWins: 0,
        entryFee: data.entryFee,
        prizeAmount: data.prizeAmount,
        gameResult: null,
      });
    }));

    unsubs.push(on('tournament:resumed', (data) => {
      set({
        active: true,
        tournamentId: data.tournamentId,
        gameNumber: data.gameNumber,
        playerWins: data.playerWins,
        botWins: data.botWins,
        entryFee: data.entryFee,
        prizeAmount: data.prizeAmount,
        gameResult: null,
      });
    }));

    unsubs.push(on('tournament:game_result', (result) => {
      set({
        gameNumber: result.gameNumber,
        playerWins: result.playerWins,
        botWins:    result.botWins,
        gameResult: result,
        active:     !result.tournamentOver,
      });

      if (result.tournamentOver) {
        if (result.won && result.totalReturn) {
          notify.success(`Tournament Won! +₹${result.totalReturn} added to wallet!`, { duration: 6000 });
        } else if (result.overallDraw && result.totalReturn) {
          notify.info(`Tournament Draw — ₹${result.totalReturn} entry refunded to wallet`, { duration: 6000 });
        }
      }
    }));

    unsubs.push(on('tournament:error', (msg) => {
      notify.error(msg);
    }));

    return () => unsubs.forEach(u => u());
  },

  clearResult: () => set({ gameResult: null }),

  continueToNextGame: () => {
    const { gameResult } = get();
    if (!gameResult?.nextRoomCode) return;
    socketGame.reconnect(gameResult.nextRoomCode);
    set({ gameResult: null, gameNumber: gameResult.nextGameNumber ?? get().gameNumber + 1 });
  },

  reset: () => set({
    active: false,
    tournamentId: null,
    gameNumber: 1,
    playerWins: 0,
    botWins: 0,
    entryFee: 0,
    prizeAmount: 0,
    gameResult: null,
  }),
}));
