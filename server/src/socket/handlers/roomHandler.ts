import { Server, Socket } from 'socket.io';
import { Room, IRoom } from '../../models/Room';
import { User } from '../../models/User';
import { Transaction } from '../../models/Transaction';
import { ClientGameState, Room as RoomType } from '../../../../shared/src/types';
import { sendBulkNotification } from '../../services/fcmService';

/** Generate a random 6-character uppercase room code. */
function generateRoomCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function roomToDTO(room: IRoom): RoomType {
  return {
    id: room.id,
    code: room.code,
    name: room.name,
    hostId: room.hostId,
    players: room.players.map(p => ({
      userId: p.userId,
      username: p.username,
      avatar: p.avatar,
      isReady: p.isReady,
      isHost: p.isHost,
      isBot: p.isBot,
    })),
    config: room.config,
    status: room.status,
    gameId: room.gameId,
    createdAt: (room.createdAt as Date).toISOString(),
  };
}

export function registerRoomHandlers(io: Server, socket: Socket) {
  const userId: string = (socket as any).userId;
  const username: string = (socket as any).username;
  const avatar: string = (socket as any).avatar;

  // ── Create Room ────────────────────────────────────────────────────────────
  socket.on('room:create', async (data: {
    name: string;
    maxPlayers?: number;
    roundCount?: number;
    isPrivate?: boolean;
    turnTimeLimit?: number;
    allowBots?: boolean;
    botCount?: number;
    entryFee?: number;
    botPersonality?: string;
    invitedUserIds?: string[];
  }) => {
    try {
      const entryFee = Math.max(0, Math.min(data.entryFee ?? 0, 10000));

      // Cash game: creator must have enough balance to pay their own entry fee
      let creator = null;
      if (entryFee > 0) {
        creator = await User.findById(userId).select('walletBalance isGuest');
        if (!creator) return socket.emit('room:error', 'User not found');
        if (creator.isGuest) return socket.emit('room:error', 'Guests cannot create cash game rooms');
        if ((creator.walletBalance ?? 0) < entryFee) {
          return socket.emit('room:error', `Insufficient balance. You need ₹${entryFee} to create this room.`);
        }
      }

      let code: string;
      let attempts = 0;
      do {
        code = generateRoomCode();
        attempts++;
      } while (await Room.exists({ code }) && attempts < 10);

      // Deduct entry fee now that we have the room code
      if (entryFee > 0 && creator) {
        await User.findByIdAndUpdate(userId, { $inc: { walletBalance: -entryFee } });
        await Transaction.create({
          userId,
          type: 'entry_fee',
          amount: entryFee,
          status: 'completed',
          description: `Entry fee — room ${code}`,
          metadata: { roomCode: code },
        });
      }

      const roomName = String(data.name || `${username}'s Room`).trim();
      const sanitizedRoomName = roomName.length > 30 ? `${roomName.slice(0, 27)}...` : roomName;

      const room = await Room.create({
        code,
        name: sanitizedRoomName,
        hostId: userId,
        players: [{
          userId,
          username,
          avatar,
          isReady: false,
          isHost: true,
          isBot: false,
          socketId: socket.id,
        }],
        config: {
          // Double deck: 113 usable cards, 7 per player → max 10 players total
          maxPlayers: Math.min(data.maxPlayers ?? 4, 10),
          roundCount: data.roundCount ?? 5,
          isPrivate: data.isPrivate ?? false,
          turnTimeLimit: data.turnTimeLimit ?? 30,
          allowBots: data.allowBots ?? true,
          botCount: Math.min(data.botCount ?? 0, 9),
          entryFee,
          botPersonality: data.botPersonality ?? 'smart',
        },
        paidPlayerIds: entryFee > 0 ? [userId] : [],
      });

      await socket.join(room.code);
      socket.data.roomCode = room.code;

      const dto = roomToDTO(room);
      console.log(`[Room] ${username} created room ${room.code}`);
      socket.emit('room:joined', dto);
      io.to(room.code).emit('room:updated', dto);
      // Notify all clients in lobby so they can refresh the public room list
      if (!dto.config.isPrivate) io.emit('lobby:rooms_updated');

      // Send invitations to selected users
      const invitedIds = Array.isArray(data.invitedUserIds)
        ? data.invitedUserIds.filter(id => id && id !== userId).slice(0, 20)
        : [];
      if (invitedIds.length > 0) {
        const modeLabel = room.config.entryFee > 0 ? `Wager ₹${room.config.entryFee}` : 'Free Play';
        console.log(`[Room] Sending invites for room ${room.code} to ${invitedIds.length} user(s):`, invitedIds);
        sendBulkNotification(invitedIds, {
          title: `🎮 ${username} invited you to play!`,
          message: `Join "${room.name}" · ${modeLabel} · Code: ${room.code}`,
          category: 'multiplayer',
          type: 'info',
          actionUrl: `/lobby?join=${room.code}`,
          skipThrottle: true,
        }).then(() => {
          console.log(`[Room] Invites sent for room ${room.code}`);
        }).catch((err) => {
          console.error(`[Room] Invite notification error for room ${room.code}:`, err);
        });
      }
    } catch (err) {
      console.error('[Room] Create error:', err);
      socket.emit('room:error', 'Failed to create room');
    }
  });

  // ── Join Room ──────────────────────────────────────────────────────────────
  socket.on('room:join', async (code: string) => {
    try {
      console.log(`[Room] ${username} attempting to join room: ${code}`);
      const room = await Room.findOne({ code: code.toUpperCase() });

      if (!room) { console.log('[Room] Not found:', code); return socket.emit('room:error', 'Room not found'); }
      if (room.status !== 'waiting') { console.log('[Room] Not waiting:', room.status); return socket.emit('room:error', 'Game already in progress'); }

      const alreadyIn = room.players.some(p => p.userId === userId);

      // Purge stale players whose sockets are no longer connected
      if (!alreadyIn) {
        const connectedSockets = await io.fetchSockets();
        const connectedIds = new Set(connectedSockets.map(s => s.id));
        const activePlayers = room.players.filter(p => p.socketId && connectedIds.has(p.socketId));
        if (activePlayers.length !== room.players.length) {
          console.log(`[Room] Purging ${room.players.length - activePlayers.length} stale players`);
          room.players = activePlayers;
        }
      }

      if (!alreadyIn && room.players.length >= room.config.maxPlayers) {
        console.log('[Room] Full:', room.players.length, '/', room.config.maxPlayers);
        return socket.emit('room:error', 'Room is full');
      }

      // Cash room: deduct entry fee if player hasn't paid yet
      const entryFee = (room.config as any).entryFee ?? 0;
      if (!alreadyIn && entryFee > 0) {
        const user = await User.findById(userId).select('walletBalance isGuest');
        if (!user) return socket.emit('room:error', 'User not found');
        if (user.isGuest) return socket.emit('room:error', 'Guests cannot join cash games');
        if ((user.walletBalance ?? 0) < entryFee) {
          return socket.emit('room:error', `Insufficient balance. Entry fee: ₹${entryFee}`);
        }
        if (!room.paidPlayerIds) room.paidPlayerIds = [];
        if (!room.paidPlayerIds.includes(userId)) {
          await User.findByIdAndUpdate(userId, { $inc: { walletBalance: -entryFee } });
          room.paidPlayerIds.push(userId);
          await Transaction.create({
            userId,
            type: 'entry_fee',
            amount: entryFee,
            status: 'completed',
            description: `Entry fee — room ${room.code}`,
            metadata: { roomCode: room.code },
          });
        }
      }

      if (!alreadyIn) {
        room.players.push({ userId, username, avatar, isReady: false, isHost: false, isBot: false, socketId: socket.id });
      } else {
        const idx = room.players.findIndex(p => p.userId === userId);
        if (idx >= 0) room.players[idx].socketId = socket.id;
      }
      await room.save();

      await socket.join(room.code);
      socket.data.roomCode = room.code;

      const dto = roomToDTO(room);
      console.log(`[Room] ${username} joined ${room.code} (${room.players.length}/${room.config.maxPlayers})`);
      socket.emit('room:joined', dto);
      io.to(room.code).emit('room:updated', dto);
      if (!dto.config.isPrivate) io.emit('lobby:rooms_updated');
    } catch (err) {
      console.error('[Room] Join error:', err);
      socket.emit('room:error', 'Failed to join room');
    }
  });

  // ── Toggle Ready ───────────────────────────────────────────────────────────
  socket.on('room:ready', async () => {
    try {
      const room = await Room.findOne({ code: socket.data.roomCode });
      if (!room) return;

      const player = room.players.find(p => p.userId === userId);
      if (player) {
        player.isReady = !player.isReady;
        await room.save();
        io.to(room.code).emit('room:updated', roomToDTO(room));
      }
    } catch (_) {}
  });

  // ── Set Bot Count (host only) ──────────────────────────────────────────────
  socket.on('room:set_bots', async (count: number) => {
    try {
      const room = await Room.findOne({ code: socket.data.roomCode });
      if (!room || room.hostId !== userId) return;
      if (room.status !== 'waiting') return;
      const maxBots = room.config.maxPlayers - room.players.length;
      room.config.botCount = Math.max(0, Math.min(count, maxBots));
      await room.save();
      io.to(room.code).emit('room:updated', roomToDTO(room));
    } catch (_) {}
  });

  // ── Leave Room ─────────────────────────────────────────────────────────────
  socket.on('room:leave', async () => {
    try {
      await handleLeave(io, socket, userId);
    } catch (_) {}
  });

  // ── Disconnect ─────────────────────────────────────────────────────────────
  socket.on('disconnect', async () => {
    try {
      await handleLeave(io, socket, userId);
    } catch (_) {}
  });
}

/** Refund the entry fee to every player who paid in a cash game room. */
export async function refundAbandonedGame(room: IRoom) {
  const entryFee = (room.config as any).entryFee ?? 0;
  if (entryFee <= 0 || !room.paidPlayerIds?.length) return;

  for (const pid of room.paidPlayerIds) {
    await User.findByIdAndUpdate(pid, { $inc: { walletBalance: entryFee } });
    await Transaction.create({
      userId: pid,
      type: 'refund',
      amount: entryFee,
      status: 'completed',
      description: `Refund — game abandoned in room ${room.code}`,
      metadata: { roomCode: room.code },
    });
  }
  room.paidPlayerIds = [];
}

export async function handleLeave(io: Server, socket: Socket, userId: string) {
  const room = await Room.findOne({ code: socket.data.roomCode });
  if (!room) return;

  const entryFee = (room.config as any).entryFee ?? 0;

  // Refund this player if they leave before the game starts
  if (room.status === 'waiting' && entryFee > 0 && room.paidPlayerIds?.includes(userId)) {
    await User.findByIdAndUpdate(userId, { $inc: { walletBalance: entryFee } });
    room.paidPlayerIds = room.paidPlayerIds.filter(id => id !== userId);
    await Transaction.create({
      userId,
      type: 'refund',
      amount: entryFee,
      status: 'completed',
      description: `Refund for leaving room ${room.code}`,
      metadata: { roomCode: room.code },
    });
  }

  room.players = room.players.filter(p => p.userId !== userId);
  await socket.leave(room.code);

  // If game was in progress and no human players remain → abandoned, refund everyone
  const humanPlayersLeft = room.players.filter(p => !p.isBot).length;
  if (room.status === 'playing' && humanPlayersLeft === 0) {
    await refundAbandonedGame(room);
    await Room.deleteOne({ _id: room._id });
    io.to(room.code).emit('game:abandoned', {
      message: 'All players left — entry fees have been refunded.',
    });
    return;
  }

  if (room.players.length === 0) {
    await Room.deleteOne({ _id: room._id });
    return;
  }

  // Transfer host if needed
  if (room.hostId === userId && room.players.length > 0) {
    room.players[0].isHost = true;
    room.hostId = room.players[0].userId;
  }

  await room.save();
  const dto = roomToDTO(room);
  io.to(room.code).emit('room:updated', dto);
  if (!dto.config.isPrivate) io.emit('lobby:rooms_updated');
  socket.emit('room:left');
}
