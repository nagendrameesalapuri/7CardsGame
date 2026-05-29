import { Server, Socket } from "socket.io";
import { Room, IRoom } from "../../models/Room";
import { User } from "../../models/User";
import { Transaction } from "../../models/Transaction";
import {
  ClientGameState,
  Room as RoomType,
} from "../../../../shared/src/types";
import { sendBulkNotification } from "../../services/fcmService";
import { getOnlineUserIds } from "../index";

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
    players: room.players.map((p) => ({
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
  socket.on(
    "room:create",
    async (data: {
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
      const entryFee = Math.max(0, Math.min(data.entryFee ?? 0, 10000));
      let code = "";
      let holdPlaced = false;
      let walletBefore = 0;
      let holdBefore = 0;
      try {
        if (entryFee > 0) {
          const guestCheck = await User.findById(userId).select("isGuest");
          if (!guestCheck) return socket.emit("room:error", "User not found");
          if (guestCheck.isGuest)
            return socket.emit(
              "room:error",
              "Guests cannot create cash game rooms",
            );
          if (isHoldCooldownActive(userId))
            return socket.emit(
              "room:error",
              "Too many hold releases detected. Please wait before joining another cash game.",
            );
        }

        let attempts = 0;
        do {
          code = generateRoomCode();
          attempts++;
        } while ((await Room.exists({ code })) && attempts < 10);

        // ── ENTRY HOLD (new system): reserve funds without deducting ──────────
        if (entryFee > 0) {
          // Ensure available balance = walletBalance - heldBalance >= entryFee
          const creator = await User.findOneAndUpdate(
            {
              _id: userId,
              $expr: {
                $gte: [
                  {
                    $subtract: [
                      "$walletBalance",
                      { $ifNull: ["$heldBalance", 0] },
                    ],
                  },
                  entryFee,
                ],
              },
            },
            { $inc: { heldBalance: entryFee } },
            { new: false },
          );
          if (!creator) {
            return socket.emit(
              "room:error",
              `Insufficient available balance. You need ₹${entryFee} to create this room.`,
            );
          }
          walletBefore = creator.walletBalance;
          holdBefore = creator.heldBalance ?? 0;
          await Transaction.create({
            userId,
            type: "entry_hold",
            amount: entryFee,
            status: "completed",
            description: `Entry hold — room ${code}`,
            balanceBefore: walletBefore,
            balanceAfter: walletBefore,
            heldBefore: holdBefore,
            heldAfter: holdBefore + entryFee,
            metadata: { roomCode: code, matchState: "forming" },
          });
          holdPlaced = true;
        }

        const roomName = String(data.name || `${username}'s Room`).trim();
        const sanitizedRoomName =
          roomName.length > 30 ? `${roomName.slice(0, 27)}...` : roomName;

        const room = await Room.create({
          code,
          name: sanitizedRoomName,
          hostId: userId,
          players: [
            {
              userId,
              username,
              avatar,
              isReady: false,
              isHost: true,
              isBot: false,
              socketId: socket.id,
            },
          ],
          config: {
            maxPlayers: Math.min(data.maxPlayers ?? 4, 10),
            roundCount: data.roundCount ?? 5,
            isPrivate: data.isPrivate ?? false,
            turnTimeLimit: data.turnTimeLimit ?? 30,
            allowBots: data.allowBots ?? true,
            botCount: Math.min(data.botCount ?? 0, 9),
            entryFee,
            botPersonality: data.botPersonality ?? "smart",
          },
          paidPlayerIds: [],
          heldPlayerIds: entryFee > 0 ? [userId] : [],
          matchState: "forming",
        });
        holdPlaced = false; // room persisted — hold is now committed

        await socket.join(room.code);
        socket.data.roomCode = room.code;

        const dto = roomToDTO(room);
        console.log(`[Room] ${username} created room ${room.code}`);
        socket.emit("room:joined", dto);
        io.to(room.code).emit("room:updated", dto);
        if (!dto.config.isPrivate) io.emit("lobby:rooms_updated");

        const invitedIds = Array.isArray(data.invitedUserIds)
          ? data.invitedUserIds.filter((id) => id && id !== userId).slice(0, 20)
          : [];
        if (invitedIds.length > 0) {
          const modeLabel =
            room.config.entryFee > 0
              ? `Wager ₹${room.config.entryFee}`
              : "Free Play";
          sendBulkNotification(invitedIds, {
            title: `🎮 ${username} invited you to play!`,
            message: `Join "${room.name}" · ${modeLabel} · Code: ${room.code}`,
            category: "multiplayer",
            type: "info",
            actionUrl: `/lobby?join=${room.code}`,
            skipThrottle: true,
          }).catch((err) =>
            console.error(`[Room] Invite notification error:`, err),
          );
        }
      } catch (err) {
        console.error("[Room] Create error:", err);
        if (holdPlaced) {
          await User.findByIdAndUpdate(userId, {
            $inc: { heldBalance: -entryFee },
          }).catch(console.error);
          await Transaction.create({
            userId,
            type: "entry_released",
            amount: entryFee,
            status: "completed",
            description: `Entry hold released — room creation failed (room ${code})`,
            balanceBefore: walletBefore,
            balanceAfter: walletBefore,
            heldBefore: holdBefore + entryFee,
            heldAfter: holdBefore,
            metadata: { roomCode: code, releaseReason: "room_create_failed" },
          }).catch(console.error);
        }
        socket.emit("room:error", "Failed to create room");
      }
    },
  );

  // ── Join Room ──────────────────────────────────────────────────────────────
  socket.on("room:join", async (code: string) => {
    if (joiningUsers.has(userId)) return;
    joiningUsers.add(userId);
    // Hoisted so catch can release a hold placed before an error
    let joinEntryFee = 0;
    let joinRoomCode = "";
    let joinHoldPlaced = false;
    try {
      const room = await Room.findOne({ code: code.toUpperCase() });

      if (!room) return socket.emit("room:error", "Room not found");
      if (room.status !== "waiting")
        return socket.emit("room:error", "Game already in progress");

      cancelPendingWaitingDelete(room.code);
      joinRoomCode = room.code;

      const alreadyIn = room.players.some((p) => p.userId === userId);

      if (!alreadyIn) {
        const connectedSockets = await io.fetchSockets();
        const connectedIds = new Set(connectedSockets.map((s) => s.id));
        const activePlayers = room.players.filter(
          (p) => p.socketId && connectedIds.has(p.socketId),
        );
        if (activePlayers.length !== room.players.length) {
          room.players = activePlayers;
        }
      }

      if (!alreadyIn && room.players.length >= room.config.maxPlayers) {
        return socket.emit("room:error", "Room is full");
      }

      // ── ENTRY HOLD (new system) ────────────────────────────────────────────
      joinEntryFee = (room.config as any).entryFee ?? 0;
      if (!alreadyIn && joinEntryFee > 0) {
        const userCheck = await User.findById(userId).select("isGuest");
        if (!userCheck) return socket.emit("room:error", "User not found");
        if (userCheck.isGuest)
          return socket.emit("room:error", "Guests cannot join cash games");
        if (isHoldCooldownActive(userId))
          return socket.emit(
            "room:error",
            "Too many hold releases detected. Please wait before joining another cash game.",
          );

        if (!room.heldPlayerIds) room.heldPlayerIds = [];
        if (!room.heldPlayerIds.includes(userId)) {
          const held = await User.findOneAndUpdate(
            {
              _id: userId,
              $expr: {
                $gte: [
                  {
                    $subtract: [
                      "$walletBalance",
                      { $ifNull: ["$heldBalance", 0] },
                    ],
                  },
                  joinEntryFee,
                ],
              },
            },
            { $inc: { heldBalance: joinEntryFee } },
            { new: false },
          );
          if (!held) {
            return socket.emit(
              "room:error",
              `Insufficient available balance. Entry fee: ₹${joinEntryFee}`,
            );
          }
          room.heldPlayerIds.push(userId);
          joinHoldPlaced = true;

          // Record anti-exploit signal
          trackHoldPlaced(userId);

          await Transaction.create({
            userId,
            type: "entry_hold",
            amount: joinEntryFee,
            status: "completed",
            description: `Entry hold — room ${room.code}`,
            balanceBefore: held.walletBalance,
            balanceAfter: held.walletBalance,
            heldBefore: held.heldBalance ?? 0,
            heldAfter: (held.heldBalance ?? 0) + joinEntryFee,
            metadata: { roomCode: room.code, matchState: "forming" },
          });
        }
      }

      if (!alreadyIn) {
        const isHost = room.hostId === userId;
        room.players.push({
          userId,
          username,
          avatar,
          isReady: false,
          isHost,
          isBot: false,
          socketId: socket.id,
        });
        if (isHost)
          room.players.forEach((p, i) => {
            if (p.userId !== userId) room.players[i].isHost = false;
          });
      } else {
        const idx = room.players.findIndex((p) => p.userId === userId);
        if (idx >= 0) room.players[idx].socketId = socket.id;
      }
      await room.save();
      joinHoldPlaced = false; // room saved — hold is committed

      await socket.join(room.code);
      socket.data.roomCode = room.code;

      const dto = roomToDTO(room);
      socket.emit("room:joined", dto);
      io.to(room.code).emit("room:updated", dto);
      if (!dto.config.isPrivate) io.emit("lobby:rooms_updated");
    } catch (err) {
      console.error("[Room] Join error:", err);
      if (joinHoldPlaced) {
        await User.findByIdAndUpdate(userId, {
          $inc: { heldBalance: -joinEntryFee },
        }).catch(console.error);
        await Transaction.create({
          userId,
          type: "entry_released",
          amount: joinEntryFee,
          status: "completed",
          description: `Entry hold released — join failed (room ${joinRoomCode})`,
          balanceBefore: 0,
          balanceAfter: 0,
          heldBefore: joinEntryFee,
          heldAfter: 0,
          metadata: { roomCode: joinRoomCode, releaseReason: "join_failed" },
        }).catch(console.error);
      }
      socket.emit("room:error", "Failed to join room");
    } finally {
      joiningUsers.delete(userId);
    }
  });

  // ── Toggle Ready ───────────────────────────────────────────────────────────
  socket.on("room:ready", async () => {
    try {
      const room = await Room.findOne({ code: socket.data.roomCode });
      if (!room) return;

      const player = room.players.find((p) => p.userId === userId);
      if (player) {
        player.isReady = !player.isReady;
        await room.save();
        io.to(room.code).emit("room:updated", roomToDTO(room));
      }
    } catch (_) {}
  });

  // ── Set Bot Count (host only) ──────────────────────────────────────────────
  socket.on("room:set_bots", async (count: number) => {
    try {
      const room = await Room.findOne({ code: socket.data.roomCode });
      if (!room || room.hostId !== userId) return;
      if (room.status !== "waiting") return;
      const maxBots = room.config.maxPlayers - room.players.length;
      room.config.botCount = Math.max(0, Math.min(count, maxBots));
      await room.save();
      io.to(room.code).emit("room:updated", roomToDTO(room));
    } catch (_) {}
  });


  // ── Invite Favorites to Room ───────────────────────────────────────────────
  socket.on("room:invite_friends", async ({ targetUserIds }: { targetUserIds: string[] }) => {
    try {
      if (!Array.isArray(targetUserIds) || targetUserIds.length === 0) return;
      const roomCode = socket.data.roomCode as string | undefined;
      if (!roomCode) return;

      const room = await Room.findOne({ code: roomCode, status: 'waiting' }).lean();
      if (!room) return;

      // Verify sender is in this room
      const inRoom = (room.players as any[]).some((p: any) => p.userId === userId);
      if (!inRoom) return;

      const modeName = (room.config as any).botPersonality
        ? ({ safe: 'Casual Duel', smart: 'Survival Clash', aggressive: 'Chaos Arena', bluff: 'Bluff Mode', boss: 'Boss Rush' } as any)[(room.config as any).botPersonality] ?? 'Multiplayer'
        : 'Multiplayer';

      const onlineIds = getOnlineUserIds();
      const validIds = targetUserIds.filter(id => id && id !== userId).slice(0, 10);
      const offlineIds: string[] = [];

      for (const targetId of validIds) {
        if (onlineIds.has(targetId)) {
          // Real-time invite
          io.to(`user:${targetId}`).emit('room:invite_received', {
            roomCode: room.code,
            roomName: (room as any).name,
            inviterUsername: username,
            inviterAvatar: avatar,
            modeName,
            entryFee: (room.config as any).entryFee ?? 0,
          });
        } else {
          offlineIds.push(targetId);
        }
      }

      // DB notification for offline users
      if (offlineIds.length > 0) {
        sendBulkNotification(offlineIds, {
          title: `🎮 ${username} invited you!`,
          message: `Join "${(room as any).name}" · ${modeName} · Code: ${room.code}`,
          category: 'multiplayer',
          type: 'info',
          actionUrl: `/lobby?join=${room.code}`,
          skipThrottle: true,
        }).catch(() => {});
      }
    } catch (_) {}
  });

  // ── Leave Room ─────────────────────────────────────────────────────────────
  socket.on("room:leave", async () => {
    try {
      await handleLeave(io, socket, userId);
    } catch (_) {}
  });

  // ── Disconnect ─────────────────────────────────────────────────────────────
  socket.on("disconnect", async () => {
    try {
      await handleLeave(io, socket, userId);
    } catch (_) {}
  });
}

// ── Grace-period timers ────────────────────────────────────────────────────────

const pendingAbandon = new Map<string, ReturnType<typeof setTimeout>>();

export function cancelPendingAbandon(roomCode: string): void {
  const t = pendingAbandon.get(roomCode);
  if (t) {
    clearTimeout(t);
    pendingAbandon.delete(roomCode);
  }
}

const pendingWaitingDelete = new Map<string, ReturnType<typeof setTimeout>>();

function cancelPendingWaitingDelete(roomCode: string): void {
  const t = pendingWaitingDelete.get(roomCode);
  if (t) {
    clearTimeout(t);
    pendingWaitingDelete.delete(roomCode);
  }
}

// Per-user join lock
const joiningUsers = new Set<string>();

// ── Anti-exploit: hold-release frequency tracking ─────────────────────────────

interface HoldTracker {
  releases: number[]; // timestamps of recent releases
  cooldownUntil?: number;
}

const holdExploitTracker = new Map<string, HoldTracker>();
const HOLD_RELEASE_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const MAX_RELEASES_IN_WINDOW = 8; // raised from 3 — active players legitimately join many games
const COOLDOWN_MS = 10 * 60 * 1000; // 10 min cooldown (was 15)

export function trackHoldPlaced(_userId: string) {
  // placeholder — holds placed are not flagged, only releases
}

export function trackHoldReleased(userId: string): {
  flagged: boolean;
  cooldownUntil?: number;
} {
  const now = Date.now();
  const tracker = holdExploitTracker.get(userId) ?? { releases: [] };

  // Prune old releases outside window
  tracker.releases = tracker.releases.filter(
    (t) => now - t < HOLD_RELEASE_WINDOW_MS,
  );
  // Debounce: ignore duplicate release events within short interval (2s)
  const last = tracker.releases[tracker.releases.length - 1];
  if (!last || now - last > 2000) {
    tracker.releases.push(now);
  } else {
    console.debug(
      `[AntiExploit] Ignored duplicate hold release for ${userId} (debounced)`,
    );
  }

  let flagged = false;
  if (tracker.releases.length >= MAX_RELEASES_IN_WINDOW) {
    tracker.cooldownUntil = now + COOLDOWN_MS;
    flagged = true;
    console.warn(
      `[AntiExploit] User ${userId} has ${tracker.releases.length} hold releases in 30 min — cooldown applied`,
    );
  }

  holdExploitTracker.set(userId, tracker);
  return { flagged, cooldownUntil: tracker.cooldownUntil };
}

export function isHoldCooldownActive(userId: string): boolean {
  const tracker = holdExploitTracker.get(userId);
  if (!tracker?.cooldownUntil) return false;
  return Date.now() < tracker.cooldownUntil;
}

export function getHoldExploitStats(userId: string) {
  const tracker = holdExploitTracker.get(userId);
  if (!tracker) return { releases: 0, cooldownUntil: null };
  const now = Date.now();
  const recent = tracker.releases.filter(
    (t) => now - t < HOLD_RELEASE_WINDOW_MS,
  ).length;
  return { releases: recent, cooldownUntil: tracker.cooldownUntil ?? null };
}

// Test-only helper to reset tracker state (used by unit tests)
export function _resetHoldExploitTracker() {
  holdExploitTracker.clear();
}

// ── Core hold helpers ─────────────────────────────────────────────────────────

/**
 * Release a player's entry hold (before game went LIVE).
 * Does NOT create a wallet deduction/credit — hold is simply lifted.
 * Creates an entry_released transaction for audit trail.
 */
export async function releaseEntryHold(
  userId: string,
  entryFee: number,
  roomCode: string,
  reason: string,
) {
  if (entryFee <= 0) return;

  const userBefore = (await User.findById(userId)
    .select("walletBalance heldBalance")
    .lean()) as any;
  if (!userBefore) {
    console.error(`[Hold] releaseEntryHold: user ${userId} not found`);
    return;
  }

  const heldBefore: number = userBefore.heldBalance ?? 0;
  const safeRelease = Math.min(entryFee, heldBefore);

  if (safeRelease <= 0) {
    console.warn(
      `[Hold] releaseEntryHold: no held balance for user ${userId} in room ${roomCode}`,
    );
    return;
  }

  const updated = await User.findByIdAndUpdate(
    userId,
    { $inc: { heldBalance: -safeRelease } },
    { new: true },
  );
  if (!updated) {
    console.error(`[Hold] releaseEntryHold: update failed for user ${userId}`);
    return;
  }

  // Anti-exploit tracking
  const { flagged } = trackHoldReleased(userId);

  await Transaction.create({
    userId,
    type: "entry_released",
    amount: safeRelease,
    status: "completed",
    description: `Entry released — ${reason} (room ${roomCode})`,
    balanceBefore: userBefore.walletBalance,
    balanceAfter: userBefore.walletBalance,
    heldBefore,
    heldAfter: updated.heldBalance,
    metadata: { roomCode, releaseReason: reason, exploitFlag: flagged },
  });

  console.log(
    `[Hold] Entry hold ₹${entryFee} released for ${userId} — room ${roomCode} (${reason})`,
  );
}

/**
 * Lock a player's entry hold when match goes LIVE.
 * Converts held funds to a real wallet deduction.
 * Moves player from heldPlayerIds → paidPlayerIds.
 */
export async function lockEntryHold(
  userId: string,
  entryFee: number,
  roomCode: string,
): Promise<boolean> {
  if (entryFee <= 0) return true;

  // Idempotency guard — prevent double-charge if called twice for same room
  const alreadyLocked = await Transaction.findOne({
    userId,
    type: 'entry_locked',
    'metadata.roomCode': roomCode,
  }).select('_id').lean();
  if (alreadyLocked) {
    console.log(`[Hold] Entry already locked for ${userId} in room ${roomCode} — skipping duplicate`);
    return true;
  }

  const userBefore = (await User.findById(userId)
    .select("walletBalance heldBalance")
    .lean()) as any;
  if (!userBefore) {
    console.error(`[Hold] lockEntryHold: user ${userId} not found`);
    return false;
  }

  const heldBefore: number = userBefore.heldBalance ?? 0;
  const walletBefore: number = userBefore.walletBalance;

  // Atomically deduct both walletBalance and heldBalance
  const updated = await User.findOneAndUpdate(
    {
      _id: userId,
      walletBalance: { $gte: entryFee },
      heldBalance: { $gte: entryFee },
    },
    { $inc: { walletBalance: -entryFee, heldBalance: -entryFee } },
    { new: true },
  );

  if (!updated) {
    // Fallback: wallet was sufficient but held didn't match — still deduct wallet
    const fallback = await User.findOneAndUpdate(
      { _id: userId, walletBalance: { $gte: entryFee } },
      {
        $inc: {
          walletBalance: -entryFee,
          heldBalance: -Math.min(entryFee, heldBefore),
        },
      },
      { new: true },
    );
    if (!fallback) {
      console.error(
        `[Hold] lockEntryHold: insufficient balance for ${userId} room ${roomCode}`,
      );
      return false;
    }
    await Transaction.create({
      userId,
      type: "entry_locked",
      amount: entryFee,
      status: "completed",
      description: `Entry locked (hold gap corrected) — room ${roomCode}`,
      balanceBefore: walletBefore,
      balanceAfter: fallback.walletBalance,
      heldBefore,
      heldAfter: fallback.heldBalance,
      metadata: { roomCode, matchState: "live" },
    });
    console.log(
      `[Hold] Entry ₹${entryFee} locked (fallback) for ${userId} — room ${roomCode}`,
    );
    return true;
  }

  await Transaction.create({
    userId,
    type: "entry_locked",
    amount: entryFee,
    status: "completed",
    description: `Entry locked — room ${roomCode}`,
    balanceBefore: walletBefore,
    balanceAfter: updated.walletBalance,
    heldBefore,
    heldAfter: updated.heldBalance,
    metadata: { roomCode, matchState: "live" },
  });

  console.log(
    `[Hold] Entry ₹${entryFee} locked for ${userId} — room ${roomCode}. Balance: ₹${walletBefore} → ₹${updated.walletBalance}`,
  );
  return true;
}

/**
 * Release all active holds for a room (pre-LIVE cancel/abandon).
 * Used when the room is destroyed before a game starts.
 */
export async function releaseAllHolds(room: IRoom, reason: string) {
  const entryFee = (room.config as any).entryFee ?? 0;
  if (entryFee <= 0 || !room.heldPlayerIds?.length) return;

  for (const pid of room.heldPlayerIds) {
    await releaseEntryHold(pid, entryFee, room.code, reason);
  }
  room.heldPlayerIds = [];
  room.matchState = "cancelled";
}

/**
 * Abandon a LIVE game and release locked entries back to players.
 * Used when all players disconnect mid-game.
 */
export async function refundAbandonedGame(room: IRoom) {
  const entryFee = (room.config as any).entryFee ?? 0;
  if (entryFee <= 0 || !room.paidPlayerIds?.length) return;

  for (const pid of room.paidPlayerIds) {
    const userBefore = (await User.findById(pid)
      .select("walletBalance heldBalance")
      .lean()) as any;
    const walletBefore: number = userBefore?.walletBalance ?? 0;
    const heldBefore: number = userBefore?.heldBalance ?? 0;

    const updated = await User.findByIdAndUpdate(
      pid,
      { $inc: { walletBalance: entryFee } },
      { new: true },
    );
    if (!updated) {
      console.error(
        `[Refund] User ${pid} not found — abandoned resolution of ₹${entryFee} NOT credited. room=${room.code}`,
      );
      await Transaction.create({
        userId: pid,
        type: "abandoned_resolution",
        amount: entryFee,
        status: "failed",
        description: `FAILED: Abandoned resolution ₹${entryFee} for room ${room.code} — user not found`,
        balanceBefore: 0,
        balanceAfter: 0,
        heldBefore: 0,
        heldAfter: 0,
        metadata: { roomCode: room.code, failReason: "user_not_found" },
      }).catch(console.error);
      continue;
    }

    await Transaction.create({
      userId: pid,
      type: "abandoned_resolution",
      amount: entryFee,
      status: "completed",
      description: `Match abandoned — entry fee returned (room ${room.code})`,
      balanceBefore: walletBefore,
      balanceAfter: updated.walletBalance,
      heldBefore,
      heldAfter: heldBefore,
      metadata: { roomCode: room.code, matchState: "abandoned" },
    });
    console.log(
      `[Refund] ₹${entryFee} returned (abandoned) to ${pid} for room ${room.code}. Balance: ₹${walletBefore} → ₹${updated.walletBalance}`,
    );
  }
  room.paidPlayerIds = [];
  room.matchState = "abandoned";
}

export async function handleLeave(io: Server, socket: Socket, userId: string) {
  const room = await Room.findOne({ code: socket.data.roomCode });
  if (!room) return;

  const entryFee = (room.config as any).entryFee ?? 0;

  // ── Release hold if player leaves before game goes LIVE ─────────────────────
  if (
    room.status === "waiting" &&
    entryFee > 0 &&
    room.heldPlayerIds?.includes(userId)
  ) {
    await releaseEntryHold(
      userId,
      entryFee,
      room.code,
      "Left room before match started",
    );
    room.heldPlayerIds = room.heldPlayerIds.filter((id) => id !== userId);
  }

  room.players = room.players.filter((p) => p.userId !== userId);
  await socket.leave(room.code);

  // ── 90-second reconnect protection for LIVE games ───────────────────────────
  const humanPlayersLeft = room.players.filter((p) => !p.isBot).length;
  if (
    room.status === "playing" &&
    humanPlayersLeft === 0 &&
    (room.paidPlayerIds?.length ?? 0) > 0 &&
    !pendingAbandon.has(room.code)
  ) {
    const roomCode = room.code;
    io.to(roomCode).emit("game:reconnect_warning", {
      message:
        "All players disconnected. Match will be abandoned in 90 seconds if nobody reconnects.",
      seconds: 90,
    });
    const timer = setTimeout(async () => {
      pendingAbandon.delete(roomCode);
      try {
        const liveRoom = await Room.findOne({ code: roomCode });
        if (!liveRoom) return;
        if (liveRoom.status !== "playing") return;
        if ((liveRoom.paidPlayerIds?.length ?? 0) === 0) return;
        const stillNoHumans =
          liveRoom.players.filter((p: any) => !p.isBot).length === 0;
        if (stillNoHumans) {
          await refundAbandonedGame(liveRoom);
          await liveRoom.save();
          await Room.deleteOne({ _id: liveRoom._id });
          io.to(roomCode).emit("game:abandoned", {
            message:
              "All players disconnected — entry fees have been returned.",
          });
        }
      } catch (e) {
        console.error("[Room] Delayed abandon error:", e);
      }
    }, 90_000);
    pendingAbandon.set(roomCode, timer);
  }

  if (room.players.length === 0) {
    if (room.status === "waiting" && !pendingWaitingDelete.has(room.code)) {
      // Give 30 s for host to return before releasing holds and deleting
      const roomCode = room.code;
      const isPrivate = room.config.isPrivate;
      await room.save();
      const timer = setTimeout(async () => {
        pendingWaitingDelete.delete(roomCode);
        try {
          const liveRoom = await Room.findOne({ code: roomCode });
          if (!liveRoom || liveRoom.players.length > 0) return;
          await releaseAllHolds(liveRoom, "Room expired — no players returned");
          await Room.deleteOne({ _id: liveRoom._id });
          if (!isPrivate) io.emit("lobby:rooms_updated");
        } catch (e) {
          console.error("[Room] Waiting delete error:", e);
        }
      }, 30_000);
      pendingWaitingDelete.set(roomCode, timer);
      if (!isPrivate) io.emit("lobby:rooms_updated");
      return;
    }
    if (pendingAbandon.has(room.code)) {
      // 90-second refund timer is already running — must keep the room in DB
      // so the timer callback can find it and call refundAbandonedGame.
      // Deleting here would make Room.findOne return null inside the timer → no refund.
      await room.save();
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
  io.to(room.code).emit("room:updated", dto);
  if (!dto.config.isPrivate) io.emit("lobby:rooms_updated");
  socket.emit("room:left");
}
