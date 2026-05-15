import { io, Socket } from 'socket.io-client';
import { ClientGameState, Room, GameAction, ChatMessage, MatchResult, SpectatorGameState, PublicAdminConfig } from '../types';

let socket: Socket | null = null;
let spectatorSocket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) throw new Error('Socket not initialized — call connectSocket first');
  return socket;
}

export function connectSocket(token?: string, guestToken?: string): Socket {
  if (socket) {
    (socket as any).auth = { token, guestToken };
    if (!socket.connected) socket.connect();
    return socket;
  }

  const backendUrl = import.meta.env.VITE_BACKEND_URL ?? '/';

  socket = io(backendUrl, {
    auth: { token, guestToken },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => console.log('[Socket] Connected:', socket!.id));
  socket.on('disconnect', (reason) => console.warn('[Socket] Disconnected:', reason));
  socket.on('connect_error', (err) => console.error('[Socket] Error:', err.message));

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

// ── Spectator socket (separate connection with spectator flag) ────────────────

export function connectSpectatorSocket(): Socket {
  if (spectatorSocket?.connected) return spectatorSocket;

  const backendUrl = import.meta.env.VITE_BACKEND_URL ?? '/';
  const token = localStorage.getItem('token');
  const guestToken = localStorage.getItem('guestToken');

  spectatorSocket = io(backendUrl, {
    auth: { token, guestToken },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
    transports: ['websocket', 'polling'],
  });

  spectatorSocket.on('connect', () => console.log('[SpectatorSocket] Connected'));
  spectatorSocket.on('disconnect', (r) => console.warn('[SpectatorSocket] Disconnected:', r));
  return spectatorSocket;
}

export function getSpectatorSocket(): Socket | null {
  return spectatorSocket;
}

export function disconnectSpectatorSocket() {
  spectatorSocket?.disconnect();
  spectatorSocket = null;
}

export const socketSpectate = {
  join: (roomCode: string) => {
    const s = spectatorSocket ?? connectSpectatorSocket();
    s.emit('spectate:join', roomCode);
  },
  leave: () => spectatorSocket?.emit('spectate:leave'),
};

// ── Room events ───────────────────────────────────────────────────────────────

export const socketRoom = {
  create: (data: {
    name: string;
    maxPlayers?: number;
    roundCount?: number;
    isPrivate?: boolean;
    turnTimeLimit?: number;
    allowBots?: boolean;
    botCount?: number;
    entryFee?: number;
  }) => getSocket().emit('room:create', data),

  join: (code: string) => getSocket().emit('room:join', code),
  leave: () => getSocket().emit('room:leave'),
  ready: () => getSocket().emit('room:ready'),
  start: () => getSocket().emit('room:start'),
  setBots: (count: number) => getSocket().emit('room:set_bots', count),
};

// ── Game events ───────────────────────────────────────────────────────────────

export const socketGame = {
  draw: (source: 'deck' | 'discard') => getSocket().emit('game:draw', source),
  discard: (cardIds: string[]) => getSocket().emit('game:discard', cardIds),
  show: () => getSocket().emit('game:show'),
  attackRespond: (action: 'throw' | 'take', cardIds?: string[]) =>
    getSocket().emit('game:attack:respond', { action, cardIds }),
  reconnect: (roomCode: string) => getSocket().emit('game:reconnect', roomCode),
  roundReady: () => getSocket().emit('game:round_ready'),
};

// ── Chat events ───────────────────────────────────────────────────────────────

export const socketChat = {
  send: (message: string) => getSocket().emit('chat:send', message),
  react: (emoji: string) => getSocket().emit('chat:reaction', emoji),
};

// ── Tournament events ─────────────────────────────────────────────────────────

export const socketTournament = {
  start:  (entryFee: number) => getSocket().emit('tournament:start', { entryFee }),
  status: ()                 => getSocket().emit('tournament:status'),
  cancel: ()                 => getSocket().emit('tournament:cancel'),
};

// ── Survival Championship events ──────────────────────────────────────────────

export const socketSurvival = {
  start:    (tier: string) => getSocket().emit('survival:start', { tier }),
  status:   ()             => getSocket().emit('survival:status'),
  continue: ()             => getSocket().emit('survival:continue'),
  abandon:  ()             => getSocket().emit('survival:abandon'),
};

// ── Event listener helpers (typed) ───────────────────────────────────────────

type EventMap = {
  'room:joined': Room;
  'room:updated': Room;
  'room:left': void;
  'room:error': string;
  'room:kicked': { message: string };
  'room:force_ended': { message: string };
  'game:state': ClientGameState;
  'game:started': ClientGameState;
  'game:action': GameAction;
  'game:round_end': ClientGameState['roundResult'];
  'game:match_end': MatchResult;
  'game:error': string;
  'game:can_resume': { roomCode: string };
  'game:round_ready_update': { readyUserIds: string[]; total: number };
  'game:force_ended': { message: string };
  'game:abandoned': { message: string };
  'chat:received': ChatMessage;
  'lobby:rooms_updated': void;
  'spectate:state': SpectatorGameState;
  'spectate:joined': { roomCode: string; spectatorCount: number };
  'spectate:error': string;
  'spectate:count': { count: number };
  'spectate:game_ended': { message: string; winner: string };
  'auth:banned': { message: string };
  'auth:kicked': { message: string };
  'admin:config_updated': PublicAdminConfig;
  'admin:notification': { id: string; title: string; message: string; type: 'info' | 'warning' | 'success'; sentAt: string };
  'wallet:prize_won': { amount: number; balance: number };
  // Tournament
  'tournament:started':       { tournamentId: string; gameNumber: number; entryFee: number; prizeAmount: number; roomCode: string };
  'tournament:resumed':       { tournamentId: string; gameNumber: number; playerWins: number; botWins: number; entryFee: number; prizeAmount: number; roomCode: string | null };
  'tournament:game_result':   { gameNumber: number; playerWins: number; botWins: number; draws: number; isDraw: boolean; playerWon: boolean; playerScore: number; botScore: number; tournamentOver: boolean; won?: boolean; overallDraw?: boolean; prizeAmount?: number; totalReturn?: number; nextGameNumber?: number; nextRoomCode?: string };
  'tournament:status_result': { tournamentId: string; gameNumber: number; playerWins: number; botWins: number; entryFee: number; prizeAmount: number; currentRoomCode: string | null } | null;
  'tournament:cancelled':     { refunded: boolean; amount: number };
  'tournament:error':         string;
  // Survival Championship
  'survival:started':         { survivalId: string; tier: string; currentStage: number; totalStages: number; entryPoints: number; roomCode: string; botName: string; personality: string };
  'survival:resumed':         { survivalId: string; tier: string; currentStage: number; totalStages: number; entryPoints: number; totalPointsEarned: number; stageResults: any[]; currentRoomCode: string | null };
  'survival:stage_result':    { stage: number; totalStages: number; personality: string; botName: string; playerWon: boolean; isDraw: boolean; playerScore: number; botScore: number; pointsEarned: number; stageResults: any[]; tournamentOver: boolean; won?: boolean; totalPointsEarned?: number; nextStage?: number; nextRoomCode?: string; nextBotName?: string; nextPersonality?: string; newWalletBalance?: number };
  'survival:status_result':   any;
  'survival:abandoned':       { totalPointsEarned: number; refunded?: boolean; refundAmount?: number; forcedByAdmin?: boolean };
  'survival:error':           string;
  'progression:update':       { xpGained: number; multiplier: number; newXp: number; newLevel: number; newRank: string; leveled: boolean; rankedUp: boolean; winStreak: number; xpProgress: number; xpNeeded: number; newAchievements?: any[] };
  // Voice chat (WebRTC signaling)
  'voice:peers': { userId: string; username: string }[];
  'voice:peer_joined': { userId: string; username: string };
  'voice:peer_left': { userId: string };
  'voice:offer': { fromUserId: string; offer: object };
  'voice:answer': { fromUserId: string; answer: object };
  'voice:ice_candidate': { fromUserId: string; candidate: object };
  'voice:error': string;
};

export function on<K extends keyof EventMap>(
  event: K,
  handler: (data: EventMap[K]) => void
): () => void {
  const s = getSocket();
  s.on(event as string, handler as any);
  return () => s.off(event as string, handler as any);
}

export function once<K extends keyof EventMap>(
  event: K,
  handler: (data: EventMap[K]) => void
) {
  getSocket().once(event as string, handler as any);
}

export function onSpectator<K extends keyof EventMap>(
  event: K,
  handler: (data: EventMap[K]) => void
): () => void {
  const s = spectatorSocket ?? connectSpectatorSocket();
  s.on(event as string, handler as any);
  return () => s.off(event as string, handler as any);
}
