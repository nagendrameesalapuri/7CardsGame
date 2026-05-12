import { Server, Socket } from 'socket.io';
import { getAdminConfig } from '../../models/AdminConfig';
import { getActiveGame } from './gameHandler';
import { DeckManager } from '../../engine/DeckManager';
import { GameState } from '../../../../shared/src/types';

// roomCode → Set of spectator socketIds
const spectatorRooms = new Map<string, Set<string>>();

export function getSpectatorCount(roomCode: string): number {
  return spectatorRooms.get(roomCode)?.size ?? 0;
}

export function getSpectatorCounts(): Map<string, number> {
  const result = new Map<string, number>();
  spectatorRooms.forEach((set, code) => result.set(code, set.size));
  return result;
}

/** Build a public (spectator-safe) game state: no card faces, no myHand */
export function buildSpectatorState(state: GameState) {
  return {
    id: state.id,
    roomId: state.roomId,
    status: state.status,
    players: state.players.map(p => ({
      id: p.id,
      userId: p.userId,
      username: p.username,
      avatar: p.avatar,
      handCount: p.handCount,
      handTotal: DeckManager.calculateHandTotal(p.hand),
      totalScore: p.totalScore,
      roundScore: p.roundScore,
      isConnected: p.isConnected,
      isEliminated: p.isEliminated,
      seatIndex: p.seatIndex,
      isBot: p.isBot,
    })),
    discardPile: state.discardPile,
    deckCount: state.deck.length,
    jokerRank: state.jokerRank,
    jokerCard: state.jokerCard,
    currentPlayerIndex: state.currentPlayerIndex,
    turnNumber: state.turnNumber,
    turnStartTime: state.turnStartTime,
    turnTimeLimit: state.turnTimeLimit,
    attackChain: state.attackChain,
    roundCount: state.roundCount,
    roundNumber: state.roundNumber,
    hasDrawnThisTurn: state.hasDrawnThisTurn,
    showPlayerId: state.showPlayerId,
    roundResult: state.roundResult,
    chatMessages: state.chatMessages,
    isSpectatorView: true,
  };
}

/** Broadcast public state to all spectators of a room. */
export function broadcastToSpectators(io: Server, state: GameState) {
  const spectatorRoom = `spectate:${state.roomId}`;
  const count = spectatorRooms.get(state.roomId)?.size ?? 0;
  if (count === 0) return;

  const spectatorState = buildSpectatorState(state);
  io.to(spectatorRoom).emit('spectate:state', spectatorState);
  // Also update spectator count for players
  io.to(state.roomId).emit('spectate:count', { count });
}

export function registerSpectatorHandlers(io: Server, socket: Socket) {
  const isSpectator: boolean = (socket as any).isSpectator ?? false;

  socket.on('spectate:join', async (roomCode: string) => {
    try {
      const cfg = await getAdminConfig();
      if (!cfg.featureFlags.spectatorModeEnabled) {
        socket.emit('spectate:error', 'Spectator mode is currently disabled');
        return;
      }

      const game = getActiveGame(roomCode);
      if (!game) {
        socket.emit('spectate:error', 'No active game found in that room');
        return;
      }

      // Enforce max spectator limit
      const current = spectatorRooms.get(roomCode)?.size ?? 0;
      if (current >= cfg.gameConfig.maxSpectators) {
        socket.emit('spectate:error', `Room is full (max ${cfg.gameConfig.maxSpectators} spectators)`);
        return;
      }

      // Join the spectator socket room
      const spectatorRoom = `spectate:${roomCode}`;
      await socket.join(spectatorRoom);
      socket.data.spectatingRoom = roomCode;

      // Track this spectator
      if (!spectatorRooms.has(roomCode)) spectatorRooms.set(roomCode, new Set());
      spectatorRooms.get(roomCode)!.add(socket.id);

      const newCount = spectatorRooms.get(roomCode)!.size;

      // Send current game state immediately
      socket.emit('spectate:state', buildSpectatorState(game));
      socket.emit('spectate:joined', { roomCode, spectatorCount: newCount });

      // Notify players of new spectator count
      io.to(roomCode).emit('spectate:count', { count: newCount });

      console.log(`[Spectator] ${socket.id} joined ${roomCode} (${newCount} spectators)`);
    } catch (err) {
      console.error('[Spectator] join error', err);
      socket.emit('spectate:error', 'Failed to join spectator room');
    }
  });

  socket.on('spectate:leave', () => {
    cleanupSpectator(io, socket);
  });

  socket.on('disconnect', () => {
    if (socket.data.spectatingRoom) {
      cleanupSpectator(io, socket);
    }
  });
}

function cleanupSpectator(io: Server, socket: Socket) {
  const roomCode = socket.data.spectatingRoom;
  if (!roomCode) return;

  const set = spectatorRooms.get(roomCode);
  if (set) {
    set.delete(socket.id);
    if (set.size === 0) spectatorRooms.delete(roomCode);
  }

  socket.leave(`spectate:${roomCode}`);
  socket.data.spectatingRoom = undefined;

  const count = spectatorRooms.get(roomCode)?.size ?? 0;
  io.to(roomCode).emit('spectate:count', { count });
}
