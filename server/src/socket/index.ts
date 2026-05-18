import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { registerRoomHandlers } from './handlers/roomHandler';
import { registerGameHandlers, getActiveGame, getActiveGameByUserId, getAllActiveGamesByUserId } from './handlers/gameHandler';
import { registerChatHandlers } from './handlers/chatHandler';
import { registerVoiceHandlers } from './handlers/voiceHandler';
import { registerSpectatorHandlers } from './handlers/spectatorHandler';
import { registerSurvivalHandlers } from './handlers/survivalHandler';
import { PlayerProgress } from '../models/PlayerProgress';
import { computeAndCacheBadge, getBadge } from '../utils/badgeCache';

// In-memory set of online user IDs
const onlineUsers = new Map<string, string>(); // userId → socketId

export function getOnlineUserIds(): Map<string, string> {
  return onlineUsers;
}

export function initSocketIO(io: Server) {
  // ── Auth middleware ─────────────────────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token as string | undefined;
      const guestToken = socket.handshake.auth.guestToken as string | undefined;

      // Allow spectator connections with a special flag (no user account needed)
      const isSpectator = socket.handshake.auth.spectator === true;
      if (isSpectator) {
        (socket as any).userId = `spectator_${socket.id}`;
        (socket as any).username = 'Spectator';
        (socket as any).avatar = 'spectator';
        (socket as any).isSpectator = true;
        return next();
      }

      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
        const user = await User.findById(decoded.userId);
        if (!user) return next(new Error('User not found'));
        if (user.isBanned) return next(new Error('Account banned'));

        (socket as any).userId = user.id;
        (socket as any).username = user.username;
        (socket as any).avatar = user.avatar;
        (socket as any).isGuest = false;
      } else if (guestToken) {
        const user = await User.findOne({ guestToken });
        if (!user) return next(new Error('Guest session expired'));
        if (user.isBanned) return next(new Error('Account banned'));

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
    const uid: string = (socket as any).userId;
    const isSpectator: boolean = (socket as any).isSpectator ?? false;

    console.log(`[Socket] ${(socket as any).username} connected (${socket.id})`);

    // Track online users (skip spectator virtual IDs)
    if (!isSpectator) {
      onlineUsers.set(uid, socket.id);
      // Join personal room so progression events reach this user
      socket.join(`user:${uid}`);
      // Prime the badge cache for this user
      PlayerProgress.findOne({ userId: uid })
        .then(p => { if (p) computeAndCacheBadge(uid, p.achievements.map(a => a.id)); })
        .catch(() => {});
      // Record last seen on connect
      User.findByIdAndUpdate(uid, { lastSeenAt: new Date() }).catch(() => {});
    }

    registerRoomHandlers(io, socket);
    registerGameHandlers(io, socket);
    registerChatHandlers(io, socket);
    registerVoiceHandlers(io, socket);
    registerSpectatorHandlers(io, socket);
    registerSurvivalHandlers(io, socket);

    // Notify client of all active games they can resume
    if (!isSpectator) {
      const actives = getAllActiveGamesByUserId(uid);
      if (actives.length > 0) {
        socket.emit('game:can_resume', { roomCodes: actives.map(a => a.roomCode) });
      }
    }

    socket.on('game:resume_request', () => {
      if (isSpectator) return;
      const actives = getAllActiveGamesByUserId(uid);
      if (actives.length > 0) {
        socket.emit('game:can_resume', { roomCodes: actives.map(a => a.roomCode) });
      }
    });

    // Reconnection: restore game state
    socket.on('game:reconnect', async (roomCode: string) => {
      const game = getActiveGame(roomCode);
      if (!game) {
        socket.emit('game:error', 'Game not found or already finished');
        return;
      }

      await socket.join(roomCode);
      socket.data.roomCode = roomCode;

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

      socket.emit('game:state', buildClientStateForSocket(game, uid));
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] ${(socket as any).username} disconnected`);

      if (!isSpectator) {
        onlineUsers.delete(uid);
        // Record last seen on disconnect so "last seen" is accurate
        User.findByIdAndUpdate(uid, { lastSeenAt: new Date() }).catch(() => {});
      }

      const game = getActiveGame(socket.data.roomCode);
      if (game) {
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
      badge: p.isBot ? undefined : getBadge(p.userId),
    })),
    deckCount: state.deck?.length ?? 0,
    myHand: myPlayer?.hand ?? [],
    myPlayerId: myPlayer?.id ?? '',
  };
}
