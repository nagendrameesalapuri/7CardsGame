import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { registerRoomHandlers } from './handlers/roomHandler';
import { registerGameHandlers, getActiveGame, getActiveGameByUserId } from './handlers/gameHandler';
import { registerChatHandlers } from './handlers/chatHandler';
import { registerVoiceHandlers } from './handlers/voiceHandler';

export function initSocketIO(io: Server) {
  // ── Auth middleware ─────────────────────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token as string | undefined;
      const guestToken = socket.handshake.auth.guestToken as string | undefined;

      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
        const user = await User.findById(decoded.userId);
        if (!user) return next(new Error('User not found'));

        (socket as any).userId = user.id;
        (socket as any).username = user.username;
        (socket as any).avatar = user.avatar;
        (socket as any).isGuest = false;
      } else if (guestToken) {
        const user = await User.findOne({ guestToken });
        if (!user) return next(new Error('Guest session expired'));

        (socket as any).userId = user.id;
        (socket as any).username = user.username;
        (socket as any).avatar = user.avatar;
        (socket as any).isGuest = true;
      } else {
        return next(new Error('Authentication required'));
      }

      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  // ── Connection ──────────────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    console.log(`[Socket] ${(socket as any).username} connected (${socket.id})`);

    registerRoomHandlers(io, socket);
    registerGameHandlers(io, socket);
    registerChatHandlers(io, socket);
    registerVoiceHandlers(io, socket);

    // Notify client if they have an active game they can resume
    const uid = (socket as any).userId as string;
    const active = getActiveGameByUserId(uid);
    if (active) {
      socket.emit('game:can_resume', { roomCode: active.roomCode });
    }

    // Reconnection: restore game state
    socket.on('game:reconnect', async (roomCode: string) => {
      const game = getActiveGame(roomCode);
      if (!game) {
        socket.emit('game:error', 'Game not found or already finished');
        return;
      }

      await socket.join(roomCode);
      socket.data.roomCode = roomCode;

      // Mark player as reconnected
      const uid = (socket as any).userId;
      const player = game.players.find(p => p.userId === uid);
      if (player) {
        player.isConnected = true;
        io.to(roomCode).emit('game:action', {
          type: 'system',
          playerId: player.id,
          message: `${player.username} reconnected`,
          timestamp: new Date().toISOString(),
        });
      }

      // Send full state to reconnected player
      socket.emit('game:state', buildClientStateForSocket(game, uid));
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] ${(socket as any).username} disconnected`);
      const game = getActiveGame(socket.data.roomCode);
      if (game) {
        const uid = (socket as any).userId;
        const player = game.players.find(p => p.userId === uid);
        if (player) {
          player.isConnected = false;
          io.to(socket.data.roomCode).emit('game:action', {
            type: 'system',
            playerId: player.id,
            message: `${player.username} disconnected`,
            timestamp: new Date().toISOString(),
          });
        }
      }
    });
  });
}

function buildClientStateForSocket(state: any, userId: string) {
  const myPlayer = state.players.find((p: any) => p.userId === userId);
  return {
    ...state,
    deck: undefined,
    players: state.players.map((p: any) => ({
      id: p.id, userId: p.userId, username: p.username, avatar: p.avatar,
      handCount: p.handCount, totalScore: p.totalScore, roundScore: p.roundScore,
      isConnected: p.isConnected, isEliminated: p.isEliminated,
      seatIndex: p.seatIndex, isBot: p.isBot,
    })),
    deckCount: state.deck?.length ?? 0,
    myHand: myPlayer?.hand ?? [],
    myPlayerId: myPlayer?.id ?? '',
  };
}
