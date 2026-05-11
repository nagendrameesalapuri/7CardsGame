import { io, Socket } from 'socket.io-client';
import { ClientGameState, Room, GameAction, ChatMessage, MatchResult } from '../types';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) throw new Error('Socket not initialized — call connectSocket first');
  return socket;
}

export function connectSocket(token?: string, guestToken?: string): Socket {
  if (socket) {
    // Reuse existing socket — just update auth and reconnect if needed
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

// ── Event listener helpers (typed) ───────────────────────────────────────────

type EventMap = {
  'room:joined': Room;
  'room:updated': Room;
  'room:left': void;
  'room:error': string;
  'game:state': ClientGameState;
  'game:started': ClientGameState;
  'game:action': GameAction;
  'game:round_end': ClientGameState['roundResult'];
  'game:match_end': MatchResult;
  'game:error': string;
  'game:can_resume': { roomCode: string };
  'game:round_ready_update': { readyUserIds: string[]; total: number };
  'chat:received': ChatMessage;
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
