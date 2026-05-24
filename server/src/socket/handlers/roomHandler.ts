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
        const guestCheck = await User.findById(userId).select('isGuest');
        if (!guestCheck) return socket.emit('room:error', 'User not found');
        if (guestCheck.isGuest) return socket.emit('room:error', 'Guests cannot create cash game rooms');
      }

      let code: string;
      let attempts = 0;
      do {
        code = generateRoomCode();
        attempts++;
      } while (await Room.exists({ code }) && attempts < 10);

      // Deduct entry fee now that we have the room code (atomic to prevent negative balance)
      if (entryFee > 0) {
        creator = await User.findOneAndUpdate(
          { _id: userId, walletBalance: { $gte: entryFee } },
          { $inc: { walletBalance: -entryFee } },
          { new: true },
        );
        if (!creator) {
          return socket.emit('room:error', `Insufficient balance. You need ₹${entryFee} to create this room.`);
        }
        await Transaction.create({
          userId,
          type: 'entry_fee',
          amount: entryFee,
          status: 'completed',
          description: `Entry fee — room ${code}`,
          balanceBefore: creator.walletBalance + entryFee,
          balanceAfter: creator.walletBalance,
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
    // Per-user lock: ignore rapid duplicate taps that would cause double-charge
    if (joiningUsers.has(userId)) return;
    joiningUsers.add(userId);
    try {
      console.log(`[Room] ${username} attempting to join room: ${code}`);
      const room = await Room.findOne({ code: code.toUpperCase() });

      if (!room) { console.log('[Room] Not found:', code); return socket.emit('room:error', 'Room not found'); }
      if (room.status !== 'waiting') { console.log('[Room] Not waiting:', room.status); return socket.emit('room:error', 'Game already in progress'); }

      // Cancel any pending grace-period delete so the room stays alive
      cancelPendingWaitingDelete(room.code);

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
        const userCheck = await User.findById(userId).select('isGuest');
        if (!userCheck) return socket.emit('room:error', 'User not found');
        if (userCheck.isGuest) return socket.emit('room:error', 'Guests cannot join cash games');
        if (!room.paidPlayerIds) room.paidPlayerIds = [];
        if (!room.paidPlayerIds.includes(userId)) {
          // Atomic conditional deduction — prevents double-deduction on concurrent joins
          const deducted = await User.findOneAndUpdate(
            { _id: userId, walletBalance: { $gte: entryFee } },
            { $inc: { walletBalance: -entryFee } },
            { new: true },
          );
          if (!deducted) {
            return socket.emit('room:error', `Insufficient balance. Entry fee: ₹${entryFee}`);
          }
          room.paidPlayerIds.push(userId);
          await Transaction.create({
            userId,
            type: 'entry_fee',
            amount: entryFee,
            status: 'completed',
            description: `Entry fee — room ${room.code}`,
            balanceBefore: deducted.walletBalance + entryFee,
            balanceAfter: deducted.walletBalance,
            metadata: { roomCode: room.code },
          });
        }
      }

      if (!alreadyIn) {
        // Restore host status if this player is the original host (coming back after disconnect)
        const isHost = room.hostId === userId;
        room.players.push({ userId, username, avatar, isReady: false, isHost, isBot: false, socketId: socket.id });
        if (isHost) room.players.forEach((p, i) => { if (p.userId !== userId) room.players[i].isHost = false; });
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
    } finally {
      joiningUsers.delete(userId);
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

// Grace-period timers: roomCode → timer handle.
// Started when all humans disconnect mid-game; cancelled on any reconnect.
const pendingAbandon = new Map<string, ReturnType<typeof setTimeout>>();

export function cancelPendingAbandon(roomCode: string): void {
  const t = pendingAbandon.get(roomCode);
  if (t) { clearTimeout(t); pendingAbandon.delete(roomCode); }
}

// Grace-period timers for empty WAITING rooms (host switched apps, etc.)
// Room is kept alive for 30 s so the host can come back.
const pendingWaitingDelete = new Map<string, ReturnType<typeof setTimeout>>();

function cancelPendingWaitingDelete(roomCode: string): void {
  const t = pendingWaitingDelete.get(roomCode);
  if (t) { clearTimeout(t); pendingWaitingDelete.delete(roomCode); }
}

// Per-user join lock: prevents concurrent double-join on rapid taps.
const joiningUsers = new Set<string>();

/** Refund the entry fee to every player who paid in a cash game room. */
export async function refundAbandonedGame(room: IRoom) {
  const entryFee = (room.config as any).entryFee ?? 0;
  if (entryFee <= 0 || !room.paidPlayerIds?.length) return;

  for (const pid of room.paidPlayerIds) {
    const userBefore = await User.findById(pid).select("walletBalance").lean() as any;
    const balanceBefore: number = userBefore?.walletBalance ?? 0;
    const updated = await User.findByIdAndUpdate(pid, { $inc: { walletBalance: entryFee } }, { new: true });
    if (!updated) {
      console.error(`[Refund] User ${pid} not found — refund of ₹${entryFee} NOT credited. room=${room.code}`);
      await Transaction.create({
        userId: pid, type: 'refund', amount: entryFee, status: 'failed',
        description: `FAILED: Refund ₹${entryFee} for abandoned room ${room.code} — user not found`,
        balanceBefore: 0, balanceAfter: 0, metadata: { roomCode: room.code, failReason: 'user_not_found' },
      }).catch(console.error);
      continue;
    }
    await Transaction.create({
      userId: pid,
      type: 'refund',
      amount: entryFee,
      status: 'completed',
      description: `Refund — game abandoned in room ${room.code}`,
      balanceBefore,
      balanceAfter: updated.walletBalance,
      metadata: { roomCode: room.code },
    });
    console.log(`[Refund] ₹${entryFee} refunded to ${pid} for abandoned room ${room.code}. Balance: ₹${balanceBefore} → ₹${updated.walletBalance}`);
  }
  room.paidPlayerIds = [];
}

export async function handleLeave(io: Server, socket: Socket, userId: string) {
  const room = await Room.findOne({ code: socket.data.roomCode });
  if (!room) return;

  const entryFee = (room.config as any).entryFee ?? 0;

  // Refund this player if they leave before the game starts
  if (room.status === 'waiting' && entryFee > 0 && room.paidPlayerIds?.includes(userId)) {
    const userBefore = await User.findById(userId).select("walletBalance").lean() as any;
    const balanceBefore: number = userBefore?.walletBalance ?? 0;
    const refunded = await User.findByIdAndUpdate(userId, { $inc: { walletBalance: entryFee } }, { new: true });
    room.paidPlayerIds = room.paidPlayerIds.filter(id => id !== userId);
    if (refunded) {
      await Transaction.create({
        userId,
        type: 'refund',
        amount: entryFee,
        status: 'completed',
        description: `Refund for leaving room ${room.code}`,
        balanceBefore,
        balanceAfter: refunded.walletBalance,
        metadata: { roomCode: room.code },
      });
    } else {
      console.error(`[Refund] User ${userId} not found — leave-refund of ₹${entryFee} failed. room=${room.code}`);
    }
  }

  room.players = room.players.filter(p => p.userId !== userId);
  await socket.leave(room.code);

  // If game was in progress and no human players remain, give a 60s grace window
  // before abandoning. Players closing/reopening the app reconnect via game:reconnect
  // without needing room:join — if they return within 60s the timer is cancelled.
  // This prevents the "refund on temporary disconnect" bug where all players briefly
  // disconnect (app backgrounded) and the room is deleted before they can resume.
  const humanPlayersLeft = room.players.filter(p => !p.isBot).length;
  if (
    room.status === 'playing' &&
    humanPlayersLeft === 0 &&
    (room.paidPlayerIds?.length ?? 0) > 0 &&
    !pendingAbandon.has(room.code)   // only start one timer per room
  ) {
    const roomCode = room.code;
    io.to(roomCode).emit('game:reconnect_warning', {
      message: 'All players disconnected. Game will be abandoned in 60 seconds if nobody reconnects.',
      seconds: 60,
    });
    const timer = setTimeout(async () => {
      pendingAbandon.delete(roomCode);
      try {
        const liveRoom = await Room.findOne({ code: roomCode });
        if (!liveRoom) return;
        if (liveRoom.status !== 'playing') return; // finished normally
        if ((liveRoom.paidPlayerIds?.length ?? 0) === 0) return; // prize already paid
        const stillNoHumans = liveRoom.players.filter((p: any) => !p.isBot).length === 0;
        if (stillNoHumans) {
          await refundAbandonedGame(liveRoom);
          await liveRoom.save();
          await Room.deleteOne({ _id: liveRoom._id });
          io.to(roomCode).emit('game:abandoned', {
            message: 'All players left — entry fees have been refunded.',
          });
        }
      } catch (e) {
        console.error('[Room] Delayed abandon error:', e);
      }
    }, 60_000);
    pendingAbandon.set(roomCode, timer);
    // Fall through — save the room below so it persists during the grace window
  }

  if (room.players.length === 0) {
    if (room.status === 'waiting' && !pendingWaitingDelete.has(room.code)) {
      // Host/last player switched apps — give 30 s to come back before deleting
      const roomCode = room.code;
      const isPrivate = room.config.isPrivate;
      await room.save();
      const timer = setTimeout(async () => {
        pendingWaitingDelete.delete(roomCode);
        try {
          const liveRoom = await Room.findOne({ code: roomCode });
          if (!liveRoom || liveRoom.players.length > 0) return;
          await refundAbandonedGame(liveRoom);
          await Room.deleteOne({ _id: liveRoom._id });
          if (!isPrivate) io.emit('lobby:rooms_updated');
        } catch (e) { console.error('[Room] Waiting delete error:', e); }
      }, 30_000);
      pendingWaitingDelete.set(roomCode, timer);
      if (!isPrivate) io.emit('lobby:rooms_updated');
      return;
    }
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
