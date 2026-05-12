/**
 * voiceHandler — WebRTC signaling for in-game voice chat.
 *
 * This server only relays SDP offers/answers and ICE candidates between peers.
 * All actual audio streams are peer-to-peer (server never touches media).
 *
 * Topology: full mesh — each player connects to every other voice participant.
 * Suitable for 2–5 players (max 4 peer connections per client).
 */

import { Server, Socket } from 'socket.io';

interface VoicePeer {
  socketId: string;
  username: string;
}

// roomCode → Map<userId, VoicePeer>
const voiceRooms = new Map<string, Map<string, VoicePeer>>();

function getOrCreateRoom(roomCode: string): Map<string, VoicePeer> {
  if (!voiceRooms.has(roomCode)) voiceRooms.set(roomCode, new Map());
  return voiceRooms.get(roomCode)!;
}

function cleanupUser(socket: Socket, userId: string, username: string) {
  const roomCode = socket.data.roomCode;
  if (!roomCode) return;
  const room = voiceRooms.get(roomCode);
  if (!room || !room.has(userId)) return;

  room.delete(userId);
  socket.to(roomCode).emit('voice:peer_left', { userId });
  console.log(`[Voice] ${username} left voice in ${roomCode} (${room.size} remaining)`);

  if (room.size === 0) voiceRooms.delete(roomCode);
}

export function registerVoiceHandlers(io: Server, socket: Socket) {
  const userId: string = (socket as any).userId;
  const username: string = (socket as any).username;

  // ── Join voice channel ────────────────────────────────────────────────────
  socket.on('voice:join', () => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return socket.emit('voice:error', 'Not in a room');

    const room = getOrCreateRoom(roomCode);
    if (room.has(userId)) return; // already in voice

    // Send existing participants to the new joiner (they will initiate offers)
    const existing = Array.from(room.entries()).map(([uid, peer]) => ({
      userId: uid,
      username: peer.username,
    }));
    socket.emit('voice:peers', existing);

    // Register self
    room.set(userId, { socketId: socket.id, username });

    // Notify everyone else that a new peer joined
    socket.to(roomCode).emit('voice:peer_joined', { userId, username });

    console.log(`[Voice] ${username} joined voice in ${roomCode} (${room.size} total)`);
  });

  // ── Forward SDP offer to target peer ─────────────────────────────────────
  socket.on('voice:offer', ({ targetUserId, offer }: { targetUserId: string; offer: object }) => {
    const room = voiceRooms.get(socket.data.roomCode);
    const target = room?.get(targetUserId);
    if (!target) return;
    io.to(target.socketId).emit('voice:offer', { fromUserId: userId, offer });
  });

  // ── Forward SDP answer to target peer ────────────────────────────────────
  socket.on('voice:answer', ({ targetUserId, answer }: { targetUserId: string; answer: object }) => {
    const room = voiceRooms.get(socket.data.roomCode);
    const target = room?.get(targetUserId);
    if (!target) return;
    io.to(target.socketId).emit('voice:answer', { fromUserId: userId, answer });
  });

  // ── Forward ICE candidate to target peer ─────────────────────────────────
  socket.on('voice:ice_candidate', ({ targetUserId, candidate }: { targetUserId: string; candidate: object }) => {
    const room = voiceRooms.get(socket.data.roomCode);
    const target = room?.get(targetUserId);
    if (!target) return;
    io.to(target.socketId).emit('voice:ice_candidate', { fromUserId: userId, candidate });
  });

  // ── Leave voice channel ───────────────────────────────────────────────────
  socket.on('voice:leave', () => cleanupUser(socket, userId, username));

  // Cleanup on full disconnect (fires after roomHandler disconnect too, order fine)
  socket.on('disconnect', () => cleanupUser(socket, userId, username));
}
