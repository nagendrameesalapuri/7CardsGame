import { create } from 'zustand';
import toast from 'react-hot-toast';
import { ClientGameState, Room, GameAction, ChatMessage, MatchResult, Card } from '../types';
import { socketRoom, socketGame, socketChat, on, getSocket } from '../services/socket';
import { soundService } from '../services/sound';

interface GameStore {
  // Room state
  room: Room | null;
  roomError: string | null;

  // Game state
  game: ClientGameState | null;
  gameError: string | null;
  lastAction: GameAction | null;
  matchResult: MatchResult | null;

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

  // Actions
  createRoom: (data: Parameters<typeof socketRoom.create>[0]) => void;
  joinRoom: (code: string) => void;
  leaveRoom: () => void;
  toggleReady: () => void;
  startGame: () => void;

  setBots: (count: number) => void;
  drawCard: (source: 'deck' | 'discard') => void;
  discardCards: () => void;
  callShow: () => void;
  respondToAttack: (action: 'throw' | 'take') => void;

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

  leaveRoom: () => {
    socketRoom.leave();
    set({ room: null, game: null, selectedCardIds: [] });
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

    unsubs.push(on('room:joined', (room) => set({ room, roomError: null })));
    unsubs.push(on('room:updated', (room) => set({ room })));
    unsubs.push(on('room:left', () => set({ room: null })));
    unsubs.push(on('room:error', (msg) => {
      set({ roomError: msg });
      toast.error(msg);
    }));

    unsubs.push(on('game:state', (incoming) => {
      const isMyTurn = incoming.players[incoming.currentPlayerIndex]?.id === incoming.myPlayerId;
      const handTotal = calculateHandTotal(incoming.myHand);
      const canShow = isMyTurn && handTotal <= 5 &&
        !(incoming.attackChain?.targetPlayerIndex === incoming.players.findIndex(p => p.id === incoming.myPlayerId));
      const underAttack = !!(incoming.attackChain &&
        incoming.players[incoming.attackChain.targetPlayerIndex]?.id === incoming.myPlayerId);

      // Merge chatMessages: server list is authoritative; keep any client-only msgs not yet on server
      set(state => {
        const serverIds = new Set(incoming.chatMessages.map(m => m.id));
        const localOnly = state.game?.chatMessages.filter(m => !serverIds.has(m.id)) ?? [];
        const mergedChat = [...incoming.chatMessages, ...localOnly];
        const game = { ...incoming, chatMessages: mergedChat };
        return { game, isMyTurn, canShow, underAttack, handTotal };
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
      toast.error(msg);
    }));

    unsubs.push(on('chat:received', (msg) => {
      soundService.play('chat');
      set(state => {
        if (!state.game) return {};
        if (state.game.chatMessages.some(m => m.id === msg.id)) return {};
        return { game: { ...state.game, chatMessages: [...state.game.chatMessages, msg] } };
      });
    }));

    return () => unsubs.forEach(u => u());
  },

  reset: () => set({
    room: null, roomError: null, game: null, gameError: null,
    lastAction: null, matchResult: null, selectedCardIds: [],
    showConfirmVisible: false, isMyTurn: false, canShow: false,
    underAttack: false, handTotal: 0,
  }),
}));
