import { Server, Socket } from 'socket.io';
import { Room, IRoom } from '../../models/Room';
import { ClientGameState, Room as RoomType } from '../../../../shared/src/types';

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
  }) => {
    try {
      let code: string;
      let attempts = 0;
      do {
        code = generateRoomCode();
        attempts++;
      } while (await Room.exists({ code }) && attempts < 10);

      const room = await Room.create({
        code,
        name: data.name || `${username}'s Room`,
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
          maxPlayers: data.maxPlayers ?? 4,
          roundCount: data.roundCount ?? 5,
          isPrivate: data.isPrivate ?? false,
          turnTimeLimit: data.turnTimeLimit ?? 30,
          allowBots: data.allowBots ?? true,
          botCount: data.botCount ?? 0,
        },
      });

      await socket.join(room.code);
      socket.data.roomCode = room.code;

      const dto = roomToDTO(room);
      console.log(`[Room] ${username} created room ${room.code}`);
      socket.emit('room:joined', dto);
      io.to(room.code).emit('room:updated', dto);
      // Notify all clients in lobby so they can refresh the public room list
      if (!dto.config.isPrivate) io.emit('lobby:rooms_updated');
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

export async function handleLeave(io: Server, socket: Socket, userId: string) {
  const room = await Room.findOne({ code: socket.data.roomCode });
  if (!room) return;

  room.players = room.players.filter(p => p.userId !== userId);
  await socket.leave(room.code);

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
