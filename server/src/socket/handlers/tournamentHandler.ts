import { Server, Socket } from 'socket.io';
import { Tournament } from '../../models/Tournament';
import { User } from '../../models/User';
import { Room } from '../../models/Room';
import { Transaction } from '../../models/Transaction';
import { startRoomGame, getActiveGame } from './gameHandler';
import { ClientGameState } from '../../../../shared/src/types';

const PRIZE_MAP: Record<number, number> = { 10: 15, 20: 25 };

async function createTournamentRoom(
  userId: string, username: string, avatar: string, socketId: string,
): Promise<string> {
  let code: string;
  let attempts = 0;
  do {
    code = Math.random().toString(36).substring(2, 8).toUpperCase();
    attempts++;
  } while (await Room.exists({ code }) && attempts < 10);

  await Room.create({
    code,
    name: `Tournament — ${username}`,
    hostId: userId,
    players: [{ userId, username, avatar, isReady: true, isHost: true, isBot: false, socketId }],
    config: { maxPlayers: 2, roundCount: 2, isPrivate: true, turnTimeLimit: 30, allowBots: true, botCount: 1, entryFee: 0 },
    paidPlayerIds: [],
    status: 'waiting',
  });

  return code!;
}

function emitGameStateToSocket(socket: Socket, roomCode: string, userId: string) {
  const gameState = getActiveGame(roomCode);
  if (!gameState) {
    console.warn(`[Tournament] emitGameStateToSocket: no active game for room ${roomCode}`);
    return;
  }
  const myPlayer = gameState.players.find(p => p.userId === userId);
  const clientState: ClientGameState = {
    id: gameState.id,
    roomId: gameState.roomId,
    status: gameState.status,
    players: gameState.players.map(p => ({
      id: p.id,
      userId: p.userId,
      username: p.username,
      avatar: p.avatar,
      handCount: p.handCount,
      totalScore: p.totalScore,
      roundScore: p.roundScore,
      isConnected: p.isConnected,
      isEliminated: p.isEliminated,
      seatIndex: p.seatIndex,
      isBot: p.isBot,
    })),
    discardPile: gameState.discardPile,
    deckCount: gameState.deck.length,
    jokerRank: gameState.jokerRank,
    jokerCard: gameState.jokerCard,
    currentPlayerIndex: gameState.currentPlayerIndex,
    turnNumber: gameState.turnNumber,
    turnStartTime: gameState.turnStartTime,
    turnTimeLimit: gameState.turnTimeLimit,
    attackChain: gameState.attackChain,
    roundCount: gameState.roundCount,
    roundNumber: gameState.roundNumber,
    hasDrawnThisTurn: gameState.hasDrawnThisTurn,
    showPlayerId: gameState.showPlayerId,
    roundResult: gameState.roundResult,
    chatMessages: gameState.chatMessages,
    myHand: myPlayer?.hand ?? [],
    myPlayerId: myPlayer?.id ?? '',
  };
  console.log(`[Tournament] Emitting game:state directly to ${userId} for room ${roomCode}`);
  socket.emit('game:state', clientState);
}

export function registerTournamentHandlers(io: Server, socket: Socket) {
  const userId: string   = (socket as any).userId;
  const username: string = (socket as any).username;
  const avatar: string   = (socket as any).avatar;
  const isGuest: boolean = (socket as any).isGuest;

  socket.on('tournament:start', async (data: { entryFee: number }) => {
    try {
      const { entryFee } = data;

      if (isGuest) return socket.emit('tournament:error', 'Guests cannot join tournaments. Please sign in.');
      if (entryFee !== 10 && entryFee !== 20) return socket.emit('tournament:error', 'Entry fee must be ₹10 or ₹20');

      const existing = await Tournament.findOne({ userId, status: 'active' });
      if (existing) {
        // Resume existing tournament
        if (existing.currentRoomCode) {
          await socket.join(existing.currentRoomCode);
          socket.data.roomCode = existing.currentRoomCode;
          // Send game state if a game is already running
          emitGameStateToSocket(socket, existing.currentRoomCode, userId);
        }
        return socket.emit('tournament:resumed', {
          tournamentId: existing.id,
          gameNumber:   existing.gamesPlayed + 1,
          playerWins:   existing.playerWins,
          botWins:      existing.botWins,
          entryFee:     existing.entryFee,
          prizeAmount:  PRIZE_MAP[existing.entryFee] ?? 0,
          roomCode:     existing.currentRoomCode,
        });
      }

      const user = await User.findById(userId).select('walletBalance');
      if (!user) return socket.emit('tournament:error', 'User not found');
      if ((user.walletBalance ?? 0) < entryFee) {
        return socket.emit('tournament:error', `Insufficient balance. Need ₹${entryFee} to enter.`);
      }

      await User.findByIdAndUpdate(userId, { $inc: { walletBalance: -entryFee } });

      const roomCode   = await createTournamentRoom(userId, username, avatar, socket.id);
      console.log(`[Tournament] Created room ${roomCode} for ${username} (socket ${socket.id})`);

      const tournament = await Tournament.create({
        userId,
        entryFee,
        currentRoomCode: roomCode,
        prizeAmount: PRIZE_MAP[entryFee] ?? 0,
      });

      await Transaction.create({
        userId,
        type: 'entry_fee',
        amount: entryFee,
        status: 'completed',
        description: `Tournament entry fee`,
        metadata: { tournamentId: tournament.id },
      });

      await socket.join(roomCode);
      socket.data.roomCode = roomCode;
      console.log(`[Tournament] Socket ${socket.id} joined room ${roomCode}, starting game…`);

      await startRoomGame(io, roomCode);
      console.log(`[Tournament] startRoomGame complete for ${roomCode}`);

      // Directly emit game state to ensure client receives it regardless of broadcastGameState timing
      emitGameStateToSocket(socket, roomCode, userId);

      socket.emit('tournament:started', {
        tournamentId: tournament.id,
        gameNumber:   1,
        entryFee,
        prizeAmount:  tournament.prizeAmount,
        roomCode,
      });
    } catch (err) {
      console.error('[Tournament] Start error:', err);
      socket.emit('tournament:error', 'Failed to start tournament. Please try again.');
    }
  });

  // Client queries active tournament status (e.g. on page load)
  socket.on('tournament:status', async () => {
    try {
      const t = await Tournament.findOne({ userId, status: 'active' });
      socket.emit('tournament:status_result', t ? {
        tournamentId:   t.id,
        gameNumber:     t.gamesPlayed + 1,
        playerWins:     t.playerWins,
        botWins:        t.botWins,
        entryFee:       t.entryFee,
        prizeAmount:    PRIZE_MAP[t.entryFee] ?? 0,
        currentRoomCode: t.currentRoomCode,
      } : null);
    } catch { /* ignore */ }
  });
}
