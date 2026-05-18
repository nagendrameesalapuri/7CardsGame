import { create } from 'zustand';
import { notify } from '../services/notify';
import { ClientGameState, Room, GameAction, ChatMessage, MatchResult, Card } from '../types';
import { socketRoom, socketGame, socketChat, on, getSocket, resetActionThrottle } from '../services/socket';
import { soundService } from '../services/sound';

// Tracks the last alerted handCount per opponent (playerId → count).
// Allows notifying once per distinct count (3 → 2 → 1), resets when player goes > 3.
const lowCardAlerted = new Map<string, number>();

interface GameStore {
  // Room state
  room: Room | null;
  roomError: string | null;

  // Game state
  game: ClientGameState | null;
  gameError: string | null;
  lastAction: GameAction | null;
  matchResult: MatchResult | null;

  // Round-ready state (waiting for all humans to click "Play Next Round")
  roundReadyUpdate: { readyUserIds: string[]; total: number } | null;

  // UI state
  selectedCardIds: string[];
  showConfirmVisible: boolean;
  isMyTurn: boolean;
  canShow: boolean;
  underAttack: boolean;
  handTotal: number;

  // Resume game
  resumeRoomCode: string | null;
  clearResume: () => void;

  // Admin force-ended
  forceEndedMsg: string | null;

  // Actions
  createRoom: (data: Parameters<typeof socketRoom.create>[0]) => void;
  joinRoom: (code: string) => void;
  resumeGame: (code: string) => void;
  leaveRoom: () => void;
  toggleReady: () => void;
  startGame: () => void;

  setBots: (count: number) => void;
  drawCard: (source: 'deck' | 'discard') => void;
  discardCards: () => void;
  callShow: () => void;
  respondToAttack: (action: 'throw' | 'take') => void;
  readyForNextRound: () => void;

  toggleCardSelection: (cardId: string) => void;
  clearSelection: () => void;
  setShowConfirmVisible: (v: boolean) => void;

  sendChat: (msg: string) => void;
  sendReaction: (emoji: string) => void;

  // Socket listeners
  subscribeToEvents: () => () => void;
  reset: () => void;
}

function calculateHandTotal(hand: Card[]): number {
  return hand.reduce((sum, c) => sum + (c.isJoker ? 0 : c.value), 0);
}

export const useGameStore = create<GameStore>((set, get) => ({
  room: null,
  roomError: null,
  game: null,
  gameError: null,
  lastAction: null,
  resumeRoomCode: null,
  clearResume: () => set({ resumeRoomCode: null }),
  matchResult: null,
  roundReadyUpdate: null,
  forceEndedMsg: null,
  selectedCardIds: [],
  showConfirmVisible: false,
  isMyTurn: false,
  canShow: false,
  underAttack: false,
  handTotal: 0,

  // ── Room ───────────────────────────────────────────────────────────────────

  createRoom: (data) => {
    set({ roomError: null });
    socketRoom.create(data);
  },

  joinRoom: (code) => {
    set({ roomError: null });
    socketRoom.join(code);
  },

  resumeGame: (code) => {
    set({ resumeRoomCode: null });
    socketGame.reconnect(code);
  },

  leaveRoom: () => {
    socketRoom.leave();
    set({
      room: null, game: null, selectedCardIds: [],
      matchResult: null, lastAction: null, gameError: null,
      resumeRoomCode: null, roundReadyUpdate: null,
      isMyTurn: false, canShow: false, underAttack: false, handTotal: 0,
    });
  },

  toggleReady: () => socketRoom.ready(),
  startGame: () => socketRoom.start(),
  setBots: (count: number) => socketRoom.setBots(count),

  // ── Game actions ───────────────────────────────────────────────────────────

  drawCard: (source) => {
    soundService.play(source === 'deck' ? 'card_draw' : 'card_discard');
    socketGame.draw(source);
  },

  discardCards: () => {
    const { selectedCardIds } = get();
    if (!selectedCardIds.length) return;
    soundService.play('card_discard');
    socketGame.discard(selectedCardIds);
    set({ selectedCardIds: [] });
  },

  callShow: () => {
    socketGame.show();
    set({ showConfirmVisible: false });
    soundService.play('show_call');
  },

  readyForNextRound: () => {
    socketGame.roundReady();
  },

  respondToAttack: (action) => {
    const { selectedCardIds } = get();
    socketGame.attackRespond(action, action === 'throw' ? selectedCardIds : undefined);
    set({ selectedCardIds: [] });
    if (action === 'throw') soundService.play('power_seven');
  },

  // ── Card selection ─────────────────────────────────────────────────────────

  toggleCardSelection: (cardId) => {
    const { selectedCardIds, game } = get();
    if (!game) return;

    const isSelected = selectedCardIds.includes(cardId);
    let next: string[];

    if (isSelected) {
      next = selectedCardIds.filter(id => id !== cardId);
    } else {
      const card = game.myHand.find(c => c.id === cardId);
      if (selectedCardIds.length === 0) {
        next = [cardId];
      } else {
        // Allow adding to selection only when all selected cards share the same rank
        const firstSelected = game.myHand.find(c => c.id === selectedCardIds[0]);
        if (firstSelected && card && firstSelected.rank === card.rank) {
          next = [...selectedCardIds, cardId];
        } else {
          next = [cardId]; // Different rank — replace selection
        }
      }
    }

    set({ selectedCardIds: next });
  },

  clearSelection: () => set({ selectedCardIds: [] }),
  setShowConfirmVisible: (v) => set({ showConfirmVisible: v }),

  // ── Chat ───────────────────────────────────────────────────────────────────

  sendChat: (msg) => socketChat.send(msg),
  sendReaction: (emoji) => socketChat.react(emoji),

  // ── Socket event subscriptions ─────────────────────────────────────────────

  subscribeToEvents: () => {
    const unsubs: Array<() => void> = [];

    // Auto-rejoin game room when socket reconnects (handles mobile background → foreground)
    const handleConnect = () => {
      const { game } = get();
      if (game) socketGame.reconnect(game.roomId);
    };
    const s = getSocket();
    s.on('connect', handleConnect);
    unsubs.push(() => s.off('connect', handleConnect));

    unsubs.push(on('game:can_resume', ({ roomCode }: { roomCode: string }) => {
      set({ resumeRoomCode: roomCode });
    }));

    unsubs.push(on('room:joined', (room) => {
      lowCardAlerted.clear();
      set({
        room, roomError: null,
        matchResult: null, game: null, lastAction: null,
        resumeRoomCode: null, roundReadyUpdate: null,
        isMyTurn: false, canShow: false,
        underAttack: false, handTotal: 0, selectedCardIds: [],
      });
    }));
    unsubs.push(on('room:updated', (room) => set({ room })));
    unsubs.push(on('room:left', () => set({ room: null })));
    unsubs.push(on('room:error', (msg) => {
      set({ roomError: msg });
      notify.error(msg);
    }));

    unsubs.push(on('game:state', (incoming) => {
      // Reset throttle on each server state so legitimate sequential actions aren't blocked
      resetActionThrottle();
      const isMyTurn = incoming.players[incoming.currentPlayerIndex]?.id === incoming.myPlayerId;
      const handTotal = calculateHandTotal(incoming.myHand);
      // SHOW is only available before drawing — once a card is drawn, must discard first
      const canShow = isMyTurn && !incoming.hasDrawnThisTurn && handTotal <= 5 &&
        !(incoming.attackChain?.targetPlayerIndex === incoming.players.findIndex(p => p.id === incoming.myPlayerId));
      const underAttack = !!(incoming.attackChain &&
        incoming.players[incoming.attackChain.targetPlayerIndex]?.id === incoming.myPlayerId);

      // Notify all players when an opponent drops to ≤3 cards
      // Fires once per distinct count (3 → 2 → 1); resets when they go back above 3
      if (incoming.status === 'playing') {
        incoming.players.forEach(player => {
          if (player.id === incoming.myPlayerId || player.isEliminated) return;
          if (player.handCount <= 3) {
            if (lowCardAlerted.get(player.id) !== player.handCount) {
              lowCardAlerted.set(player.id, player.handCount);
              const msg = `${player.username} has only ${player.handCount} card${player.handCount === 1 ? '' : 's'}!`;
              notify.warning(msg, { duration: 4500, id: `low-cards-${player.id}` });
            }
          } else {
            lowCardAlerted.delete(player.id);
          }
        });
      }

      // Merge chatMessages: server list is authoritative; keep any client-only msgs not yet on server
      set(state => {
        const prevIsMyTurn = state.isMyTurn;
        const isNewGame = !state.game || state.game.id !== incoming.id;
        if (isNewGame) lowCardAlerted.clear();
        const serverIds = new Set(incoming.chatMessages.map(m => m.id));
        const localOnly = state.game?.chatMessages.filter(m => !serverIds.has(m.id)) ?? [];
        const mergedChat = [...incoming.chatMessages, ...localOnly];
        const game = { ...incoming, chatMessages: mergedChat };
        // Beep when turn transitions to the current player
        if (isMyTurn && !prevIsMyTurn && incoming.status === 'playing') {
          soundService.playBeep();
        }
        return {
          game, isMyTurn, canShow, underAttack, handTotal,
          // Clear stale match/round state when a new game begins
          ...(isNewGame ? { matchResult: null, lastAction: null, roundReadyUpdate: null } : {}),
        };
      });
    }));

    unsubs.push(on('game:action', (action) => {
      set({ lastAction: action });
      // Play appropriate sound
      switch (action.type) {
        case 'draw': soundService.play('card_draw'); break;
        case 'discard': soundService.play('card_discard'); break;
        case 'skip': soundService.play('power_jack'); break;
        case 'attack': soundService.play('power_seven'); break;
        case 'show': soundService.play('show_call'); break;
        case 'penalty': soundService.play('power_seven'); break;
      }
    }));

    unsubs.push(on('game:round_ready_update', (update) => {
      set({ roundReadyUpdate: update });
    }));

    unsubs.push(on('game:match_end', (result) => {
      set({ matchResult: result });
      const { game } = get();
      if (game && result.winnerId === game.myPlayerId) {
        soundService.play('win');
      } else {
        soundService.play('lose');
      }
    }));

    unsubs.push(on('game:error', (msg) => {
      set({ gameError: msg });
      // Suppress transient reconnect errors that fire before socket re-joins the room
      if (msg === 'No active game' && get().game) return;
      // Use stable ID so duplicate errors replace the existing toast instead of stacking
      notify.error(msg, { id: `game-err-${msg.replace(/\s+/g, '-').toLowerCase()}`, duration: 3000 });

      // Immediately correct stale client state so the UI stops allowing further actions
      if (msg === "It's not your turn") {
        // Server has moved on — disable our turn immediately rather than waiting for next game:state
        set({ isMyTurn: false, canShow: false });
      }
      if (msg === 'Already drew this turn') {
        // Force hasDrawnThisTurn so the deck button becomes disabled right away
        set(state => state.game
          ? { game: { ...state.game, hasDrawnThisTurn: true } }
          : {});
      }
    }));

    unsubs.push(on('chat:received', (msg) => {
      soundService.play('chat');
      set(state => {
        if (!state.game) return {};
        if (state.game.chatMessages.some(m => m.id === msg.id)) return {};
        return { game: { ...state.game, chatMessages: [...state.game.chatMessages, msg] } };
      });
    }));

    // Admin force-ended the game/room — clear state so GamePage redirects
    const handleForceEnded = ({ message }: { message: string }) => {
      notify.error(message ?? 'Game was ended by an admin', { duration: 5000 });
      set({ game: null, room: null, matchResult: null, forceEndedMsg: message ?? 'Game ended by admin' });
    };
    unsubs.push(on('game:force_ended', handleForceEnded));
    unsubs.push(on('room:force_ended', handleForceEnded));

    // Game abandoned (all players left mid-game) — show refund notice
    const handleAbandoned = ({ message }: { message: string }) => {
      notify.info(message ?? 'Game abandoned — entry fees have been refunded', { duration: 7000 });
      set({ game: null, room: null, matchResult: null, forceEndedMsg: message ?? 'Game abandoned' });
    };
    unsubs.push(on('game:abandoned', handleAbandoned));

    return () => unsubs.forEach(u => u());
  },

  reset: () => set({
    room: null, roomError: null, game: null, gameError: null,
    lastAction: null, matchResult: null, roundReadyUpdate: null, forceEndedMsg: null,
    selectedCardIds: [], showConfirmVisible: false,
    isMyTurn: false, canShow: false, underAttack: false, handTotal: 0,
  }),
}));
