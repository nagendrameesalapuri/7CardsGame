import { Router, Request, Response } from "express";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { requireAdmin } from "../middleware/adminAuth";
import { AdminConfig, getAdminConfig } from "../models/AdminConfig";
import { SpinLog } from "../models/SpinLog";
import { User } from "../models/User";
import { Room } from "../models/Room";
import { Game } from "../models/Game";
import { SurvivalTournament } from "../models/SurvivalTournament";
import { SurvivalTeam } from "../models/SurvivalTeam";
import {
  getAllActiveRoomInfos,
  forceEndGame,
  kickPlayerFromGame,
  getActiveGame,
} from "../socket/handlers/gameHandler";
import { refundAbandonedGame, getHoldExploitStats, _resetHoldExploitTracker } from "../socket/handlers/roomHandler";
import { getSpectatorCounts } from "../socket/handlers/spectatorHandler";
import { getOnlineUserIds } from "../socket/index";
import { WithdrawalRequest } from "../models/WithdrawalRequest";
import { DepositRequest } from "../models/DepositRequest";
import { Transaction } from "../models/Transaction";
import { SupportTicket } from "../models/SupportTicket";
import { getAnalyticsSnapshot, resetAnalytics } from "../utils/gameAnalytics";
import { PlayerProgress } from "../models/PlayerProgress";
import { computeAndCacheBadge } from "../utils/badgeCache";
import {
  sendNotification,
  sendBulkNotification,
  sendGlobalNotification,
  sendInactivityNotifications,
} from "../services/fcmService";
import { NotificationToken }      from "../models/NotificationToken";
import { NotificationBroadcast }  from "../models/NotificationBroadcast";
import type { NotificationCategory } from "../models/Notification";
import { Announcement }           from "../models/Announcement";
import createPlayerIntelRouter    from "./playerIntelligence";

export default function createAdminRouter(io: Server) {
  const router = Router();

  // ── Player Intelligence & Audit System ─────────────────────────────────────
  router.use('/player-intel', requireAdmin, createPlayerIntelRouter());

  // ── Admin login ─────────────────────────────────────────────────────────────
  router.post("/login", (req: Request, res: Response) => {
    const password = (req.body as { password: string }).password?.trim();
    const secret = process.env.ADMIN_SECRET;

    if (!secret) {
      return res
        .status(503)
        .json({ error: "Admin access not configured on this server" });
    }
    if (!password || password !== secret) {
      return res.status(401).json({ error: "Invalid admin password" });
    }

    const token = jwt.sign({ role: "admin" }, process.env.JWT_SECRET!, {
      expiresIn: "30d",
    });
    res.json({ token });
  });

  // ── Public config (no auth) ─────────────────────────────────────────────────
  router.get("/config/public", async (_req: Request, res: Response) => {
    try {
      const cfg = await getAdminConfig();
      const sc = (cfg as any).spinConfig;
      res.json({
        featureFlags: cfg.featureFlags,
        gameConfig: cfg.gameConfig,
        walletConfig: cfg.walletConfig,
        survivalConfig: cfg.survivalConfig,
        spinConfig: { moneySpinDailyLimit: sc?.moneySpinDailyLimit ?? 3, pointsSpinDailyLimit: sc?.pointsSpinDailyLimit ?? 10 },
      });
    } catch {
      res.status(500).json({ error: "Failed to load config" });
    }
  });

  // ── All admin routes below require admin token ───────────────────────────────
  router.use(requireAdmin);

  // ── Get full config ─────────────────────────────────────────────────────────
  router.get("/config", async (_req: Request, res: Response) => {
    try {
      const cfg = await getAdminConfig();
      res.json(cfg);
    } catch {
      res.status(500).json({ error: "Failed to load config" });
    }
  });

  // ── Update config ───────────────────────────────────────────────────────────
  router.patch("/config", async (req: Request, res: Response) => {
    try {
      const { featureFlags, gameConfig, walletConfig, survivalConfig } =
        req.body;
      const cfg = await getAdminConfig();

      if (featureFlags) {
        if (typeof featureFlags.spectatorModeEnabled === "boolean") {
          cfg.featureFlags.spectatorModeEnabled =
            featureFlags.spectatorModeEnabled;
        }
        if (typeof featureFlags.publicRoomsEnabled === "boolean") {
          cfg.featureFlags.publicRoomsEnabled = featureFlags.publicRoomsEnabled;
        }
        if (typeof featureFlags.tournamentBannerEnabled === "boolean") {
          cfg.featureFlags.tournamentBannerEnabled =
            featureFlags.tournamentBannerEnabled;
        }
        if (typeof featureFlags.survivalEnabled === "boolean") {
          (cfg.featureFlags as any).survivalEnabled =
            featureFlags.survivalEnabled;
        }
        if (
          featureFlags.survivalTiers &&
          typeof featureFlags.survivalTiers === "object"
        ) {
          const st = featureFlags.survivalTiers;
          if (!cfg.featureFlags.survivalTiers) {
            (cfg.featureFlags as any).survivalTiers = {
              beginner: true,
              pro: true,
              elite: true,
              boss_arena: true,
            };
          }
          if (typeof st.beginner === "boolean")
            cfg.featureFlags.survivalTiers.beginner = st.beginner;
          if (typeof st.pro === "boolean")
            cfg.featureFlags.survivalTiers.pro = st.pro;
          if (typeof st.elite === "boolean")
            cfg.featureFlags.survivalTiers.elite = st.elite;
          if (typeof st.boss_arena === "boolean")
            cfg.featureFlags.survivalTiers.boss_arena = st.boss_arena;
        }
        if (typeof featureFlags.teamArenaEnabled === "boolean") {
          (cfg.featureFlags as any).teamArenaEnabled = featureFlags.teamArenaEnabled;
        }
        if (typeof featureFlags.teamArenaDisabledReason === "string") {
          (cfg.featureFlags as any).teamArenaDisabledReason = featureFlags.teamArenaDisabledReason.trim().slice(0, 100);
        }
        if (typeof featureFlags.leaderboardEnabled === "boolean") {
          (cfg.featureFlags as any).leaderboardEnabled = featureFlags.leaderboardEnabled;
        }
      }

      if (gameConfig) {
        const gc = cfg.gameConfig;
        if (gameConfig.minPlayers !== undefined)
          gc.minPlayers = Math.max(2, Math.min(10, gameConfig.minPlayers));
        if (gameConfig.maxPlayers !== undefined)
          gc.maxPlayers = Math.max(2, Math.min(10, gameConfig.maxPlayers));
        if (gameConfig.minRounds !== undefined)
          gc.minRounds = Math.max(1, Math.min(50, gameConfig.minRounds));
        if (gameConfig.maxRounds !== undefined)
          gc.maxRounds = Math.max(1, Math.min(50, gameConfig.maxRounds));
        if (gameConfig.maxSpectators !== undefined)
          gc.maxSpectators = Math.max(
            0,
            Math.min(50, gameConfig.maxSpectators),
          );
        if (gameConfig.maxBots !== undefined)
          gc.maxBots = Math.max(0, Math.min(9, gameConfig.maxBots));
        // Ensure min <= max
        if (gc.minPlayers > gc.maxPlayers) gc.maxPlayers = gc.minPlayers;
        if (gc.minRounds > gc.maxRounds) gc.maxRounds = gc.minRounds;
      }

      if (walletConfig) {
        const wc = cfg.walletConfig;
        if (typeof walletConfig.depositEnabled === "boolean")
          wc.depositEnabled = walletConfig.depositEnabled;
        if (typeof walletConfig.withdrawEnabled === "boolean")
          wc.withdrawEnabled = walletConfig.withdrawEnabled;
        if (typeof walletConfig.qrEnabled === "boolean")
          wc.qrEnabled = walletConfig.qrEnabled;
        if (typeof walletConfig.upiId === "string")
          wc.upiId = walletConfig.upiId.trim();
        if (typeof walletConfig.upiName === "string")
          wc.upiName = walletConfig.upiName.trim();
        if (typeof walletConfig.qrCodeUrl === "string")
          wc.qrCodeUrl = walletConfig.qrCodeUrl.trim();
      }

      if (survivalConfig && typeof survivalConfig === "object") {
        const TIERS = ["beginner", "pro", "elite", "boss_arena"] as const;
        const DEFAULTS: Record<
          string,
          { entryPoints: number; stageRewards: number[] }
        > = {
          beginner: {
            entryPoints: 1000,
            stageRewards: [100, 200, 300, 450, 700],
          },
          pro: { entryPoints: 2000, stageRewards: [200, 350, 600, 900, 1500] },
          elite: {
            entryPoints: 5000,
            stageRewards: [600, 900, 1400, 2200, 3800],
          },
          boss_arena: {
            entryPoints: 10000,
            stageRewards: [1200, 1800, 2600, 4200, 7600],
          },
        };
        for (const tier of TIERS) {
          const tc = survivalConfig[tier];
          if (!tc) continue;
          const sc = (cfg.survivalConfig as any)[tier] ?? DEFAULTS[tier];
          if (tc.reset) {
            // Reset to defaults
            sc.entryPoints = DEFAULTS[tier].entryPoints;
            sc.stageRewards = [...DEFAULTS[tier].stageRewards];
          } else {
            if (typeof tc.entryPoints === "number" && tc.entryPoints > 0)
              sc.entryPoints = Math.max(1, Math.round(tc.entryPoints));
            if (
              Array.isArray(tc.stageRewards) &&
              tc.stageRewards.length === 5
            ) {
              sc.stageRewards = tc.stageRewards.map((r: any) =>
                Math.max(0, Math.round(Number(r) || 0)),
              );
            }
          }
          (cfg.survivalConfig as any)[tier] = sc;
        }
        cfg.markModified("survivalConfig");
      }

      const { spinConfig } = req.body;
      if (spinConfig) {
        const existing = (cfg as any).spinConfig ?? {};
        if (typeof spinConfig.moneySpinDailyLimit === 'number')
          existing.moneySpinDailyLimit = Math.max(1, Math.min(50, Math.round(spinConfig.moneySpinDailyLimit)));
        if (typeof spinConfig.pointsSpinDailyLimit === 'number')
          existing.pointsSpinDailyLimit = Math.max(1, Math.min(100, Math.round(spinConfig.pointsSpinDailyLimit)));
        (cfg as any).spinConfig = existing;
        cfg.markModified('spinConfig');
      }

      await cfg.save();

      const savedSc = (cfg as any).spinConfig;
      // Notify all connected clients of the updated config
      io.emit("admin:config_updated", {
        featureFlags: cfg.featureFlags,
        gameConfig: cfg.gameConfig,
        walletConfig: cfg.walletConfig,
        survivalConfig: cfg.survivalConfig,
        spinConfig: { moneySpinDailyLimit: savedSc?.moneySpinDailyLimit ?? 3, pointsSpinDailyLimit: savedSc?.pointsSpinDailyLimit ?? 10 },
      });

      res.json(cfg);
    } catch {
      res.status(500).json({ error: "Failed to update config" });
    }
  });

  // ── Overview stats ──────────────────────────────────────────────────────────
  router.get("/stats", async (_req: Request, res: Response) => {
    try {
      const [totalUsers, totalGames] = await Promise.all([
        User.countDocuments(),
        Game.countDocuments({ status: "finished" }),
      ]);
      const onlineCount = getOnlineUserIds().size;

      // Count active rooms using the same logic as the rooms list endpoint
      // (in-memory + DB not in memory, excluding private survival/tiebreak waiting rooms)
      const inMemoryInfos = getAllActiveRoomInfos();
      const inMemoryCodes = new Set(inMemoryInfos.map((r) => r.roomCode));
      const dbOnlyCount = await Room.countDocuments({
        status: { $in: ["waiting", "playing"] },
        code: { $nin: [...inMemoryCodes] },
        $nor: [{ 'config.isPrivate': true, status: 'waiting', name: /^(Survival|Tiebreak)/ }],
      });
      const activeRooms = inMemoryInfos.length + dbOnlyCount;
      const liveGames = inMemoryInfos.filter((r) => r.status === "playing").length;

      res.json({ totalUsers, totalGames, activeRooms, onlineCount, liveGames });
    } catch {
      res.status(500).json({ error: "Failed to load stats" });
    }
  });

  // ── Live rooms ──────────────────────────────────────────────────────────────
  router.get("/rooms", async (_req: Request, res: Response) => {
    try {
      const spectatorCounts = getSpectatorCounts();
      const inMemory = getAllActiveRoomInfos();
      const inMemoryCodes = new Set(inMemory.map((r) => r.roomCode));

      // Fetch ALL active rooms from DB not already covered by in-memory state.
      // Include both "waiting" AND "playing" so orphaned rooms (e.g. after a
      // server restart that cleared in-memory games) are still visible.
      const dbRooms = await Room.find({
        status: { $in: ["waiting", "playing"] },
        code: { $nin: [...inMemoryCodes] },
        // Exclude private survival/tiebreaker rooms stuck in waiting — they're managed internally
        $nor: [{ 'config.isPrivate': true, status: 'waiting', name: /^(Survival|Tiebreak)/ }],
      }).lean();

      const rooms = [
        ...inMemory.map((r) => ({
          code: r.roomCode,
          name: r.name,
          status: r.status,
          playerCount: r.playerCount,
          maxPlayers: r.maxPlayers,
          roundNumber: r.roundNumber,
          roundCount: r.roundCount,
          spectatorCount: spectatorCounts.get(r.roomCode) ?? 0,
          players: r.players,
          config: null,
        })),
        ...dbRooms.map((r) => ({
          code: r.code,
          name: r.name,
          status: r.status,
          playerCount: r.players.length,
          maxPlayers: r.config.maxPlayers,
          roundNumber: 0,
          roundCount: r.config.roundCount,
          spectatorCount: spectatorCounts.get(r.code) ?? 0,
          players: r.players.map((p) => ({
            username: p.username,
            userId: p.userId,
            isBot: p.isBot,
          })),
          config: r.config,
        })),
      ];

      res.json({ rooms });
    } catch {
      res.status(500).json({ error: "Failed to fetch rooms" });
    }
  });

  // ── End a game/room (admin force-end) ───────────────────────────────────────
  router.delete("/rooms/:code", async (req: Request, res: Response) => {
    try {
      const { code } = req.params;

      // Refund entry fees if this was a cash game in progress
      const room = await Room.findOne({ code: code.toUpperCase() });
      if (room) {
        await refundAbandonedGame(room);
      }

      // Force-end in-memory game
      const ended = forceEndGame(io, code);

      // Clean up DB room
      await Room.deleteOne({ code: code.toUpperCase() });

      // Notify everyone in that room
      io.to(code).emit("game:abandoned", {
        message:
          "This room was ended by an admin. Entry fees have been refunded.",
      });
      io.to(code).emit("room:force_ended", {
        message: "This room was ended by an admin",
      });
      io.socketsLeave(code);

      // Refresh lobby for all connected clients
      io.emit("lobby:rooms_updated");

      res.json({ success: true, gameEnded: ended });
    } catch {
      res.status(500).json({ error: "Failed to end room" });
    }
  });

  // ── Kick player from room ───────────────────────────────────────────────────
  router.post(
    "/rooms/:code/kick/:userId",
    async (req: Request, res: Response) => {
      try {
        const { code, userId } = req.params;

        // Kick from in-memory game
        kickPlayerFromGame(io, code, userId);

        // Find their socket and disconnect from room
        const sockets = await io.in(code).fetchSockets();
        for (const s of sockets) {
          if ((s as any).userId === userId) {
            s.emit("room:kicked", { message: "You were kicked by an admin" });
            s.leave(code);
            break;
          }
        }

        // Remove from DB room
        await Room.updateOne(
          { code: code.toUpperCase() },
          { $pull: { players: { userId } } },
        );

        res.json({ success: true });
      } catch {
        res.status(500).json({ error: "Failed to kick player" });
      }
    },
  );

  // ── Users list ──────────────────────────────────────────────────────────────
  router.get("/users", async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = 50;
      const search = (req.query.search as string) || "";

      const query = search
        ? { username: { $regex: search, $options: "i" } }
        : {};

      const [users, total] = await Promise.all([
        User.find(query)
          .select("-guestToken -googleId")
          .sort({ lastSeenAt: -1, createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        User.countDocuments(query),
      ]);

      const onlineIds = getOnlineUserIds();

      res.json({
        users: users.map((u) => ({
          id: u._id,
          username: u.username,
          email: (u as any).email ?? null,
          avatar: u.avatar,
          isGuest: u.isGuest,
          isBanned: (u as any).isBanned ?? false,
          isAdmin: (u as any).isAdmin ?? false,
          aiPoints: (u as any).aiPoints ?? 0,
          walletBalance: (u as any).walletBalance ?? 0,
          isOnline: onlineIds.has(u._id.toString()),
          stats: u.stats,
          createdAt: u.createdAt,
          lastSeenAt: (u as any).lastSeenAt ?? null,
        })),
        total,
        page,
        pages: Math.ceil(total / limit),
      });
    } catch {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // ── Ban / unban user ────────────────────────────────────────────────────────
  router.post("/users/:id/ban", async (req: Request, res: Response) => {
    try {
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { isBanned: true },
        { new: true },
      );
      if (!user) return res.status(404).json({ error: "User not found" });

      // Disconnect their active socket
      const sockets = await io.fetchSockets();
      for (const s of sockets) {
        if ((s as any).userId === req.params.id) {
          s.emit("auth:banned", { message: "Your account has been banned" });
          s.disconnect(true);
          break;
        }
      }

      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to ban user" });
    }
  });

  router.post("/users/:id/unban", async (req: Request, res: Response) => {
    try {
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { isBanned: false },
        { new: true },
      );
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to unban user" });
    }
  });

  // ── Grant / revoke admin ────────────────────────────────────────────────────
  router.post("/users/:id/set-admin", async (req: Request, res: Response) => {
    try {
      const { isAdmin } = req.body as { isAdmin: boolean };
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { isAdmin: !!isAdmin },
        { new: true },
      );
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json({ success: true, isAdmin: user.isAdmin });
    } catch {
      res.status(500).json({ error: "Failed to update admin status" });
    }
  });

  // ── AI Points: add or deduct ─────────────────────────────────────────────────
  router.post("/users/:id/ai-points", async (req: Request, res: Response) => {
    try {
      const { delta, note } = req.body as { delta: number; note?: string };
      if (typeof delta !== 'number' || delta === 0)
        return res.status(400).json({ error: 'delta must be a non-zero number' });
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      const current = user.aiPoints ?? 0;
      const newPoints = Math.max(0, current + delta);
      await User.findByIdAndUpdate(req.params.id, { aiPoints: newPoints });
      const action = delta > 0 ? 'added' : 'deducted';
      const label = delta > 0 ? `+${delta}` : `${delta}`;
      console.log(`[Admin] AI points ${action} for ${user.username}: ${current} → ${newPoints} (${label}) ${note ? '— ' + note : ''}`);
      res.json({ aiPoints: newPoints, username: user.username });
    } catch {
      res.status(500).json({ error: 'Failed to update AI points' });
    }
  });

  // ── Kick user (disconnect socket only, no ban) ──────────────────────────────
  router.post("/users/:id/kick", async (req: Request, res: Response) => {
    try {
      const sockets = await io.fetchSockets();
      let kicked = false;
      for (const s of sockets) {
        if ((s as any).userId === req.params.id) {
          s.emit("auth:kicked", { message: "You were kicked by an admin" });
          s.disconnect(true);
          kicked = true;
          break;
        }
      }
      res.json({ success: true, kicked });
    } catch {
      res.status(500).json({ error: "Failed to kick user" });
    }
  });

  // ── Reset user stats ────────────────────────────────────────────────────────
  router.post("/users/:id/reset-stats", async (req: Request, res: Response) => {
    try {
      await User.findByIdAndUpdate(req.params.id, {
        $set: {
          "stats.gamesPlayed": 0,
          "stats.gamesWon": 0,
          "stats.roundsPlayed": 0,
          "stats.roundsWon": 0,
          "stats.totalPointsEarned": 0,
          "stats.showAttempts": 0,
          "stats.showSuccesses": 0,
        },
      });
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to reset stats" });
    }
  });

  // ── Delete all guest accounts ───────────────────────────────────────────────
  router.delete("/users/guests", async (_req: Request, res: Response) => {
    try {
      const result = await User.deleteMany({ isGuest: true });
      res.json({ success: true, deleted: result.deletedCount });
    } catch {
      res.status(500).json({ error: "Failed to delete guest accounts" });
    }
  });

  // ── Delete user account permanently ────────────────────────────────────────
  router.delete("/users/:id", async (req: Request, res: Response) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ error: "User not found" });

      // Disconnect their socket if online
      const sockets = await io.fetchSockets();
      for (const s of sockets) {
        if ((s as any).userId === req.params.id) {
          s.emit("auth:kicked", {
            message: "Your account has been deleted by an admin",
          });
          s.disconnect(true);
          break;
        }
      }

      await User.findByIdAndDelete(req.params.id);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // ── Leaderboard (admin view) ────────────────────────────────────────────────
  router.get("/leaderboard", async (_req: Request, res: Response) => {
    try {
      const users = await User.find({ "stats.gamesPlayed": { $gt: 0 } })
        .select("username avatar stats isGuest isBanned")
        .sort({ "stats.gamesWon": -1 })
        .limit(100)
        .lean();

      res.json({
        leaderboard: users.map((u, i) => ({
          rank: i + 1,
          id: u._id,
          username: u.username,
          avatar: u.avatar,
          isGuest: u.isGuest,
          isBanned: (u as any).isBanned ?? false,
          gamesWon: u.stats.gamesWon,
          gamesPlayed: u.stats.gamesPlayed,
          winRate:
            u.stats.gamesPlayed > 0
              ? Math.round((u.stats.gamesWon / u.stats.gamesPlayed) * 100)
              : 0,
        })),
      });
    } catch {
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  // ── Wallet: credit a user's wallet ──────────────────────────────────────────
  router.post(
    "/wallets/:userId/credit",
    async (req: Request, res: Response) => {
      try {
        const { amount, note } = req.body as { amount: number; note?: string };
        if (!amount || amount <= 0)
          return res.status(400).json({ error: "Invalid amount" });
        const user = await User.findByIdAndUpdate(
          req.params.userId,
          { $inc: { walletBalance: amount } },
          { new: true },
        );
        if (!user) return res.status(404).json({ error: "User not found" });
        await Transaction.create({
          userId: req.params.userId,
          type: "deposit",
          amount,
          status: "completed",
          description: note
            ? `[Admin] ${note}`
            : `[Admin] Manual credit of ₹${amount}`,
        });
        res.json({ balance: Math.round(user.walletBalance * 100) / 100, username: user.username });
      } catch {
        res.status(500).json({ error: "Failed to credit wallet" });
      }
    },
  );

  // ── Wallet: admin debit ──────────────────────────────────────────────────────
  router.post("/wallets/:userId/debit", async (req: Request, res: Response) => {
    try {
      const { amount, note } = req.body as { amount: number; note?: string };
      if (!amount || amount <= 0)
        return res.status(400).json({ error: "Invalid amount" });
      const user = await User.findById(req.params.userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      if ((user.walletBalance ?? 0) < amount)
        return res.status(400).json({ error: "Insufficient balance" });

      const updatedUser = await User.findByIdAndUpdate(
        req.params.userId,
        { $inc: { walletBalance: -amount } },
        { new: true },
      );
      await Transaction.create({
        userId: req.params.userId,
        type: "withdrawal",
        amount,
        status: "completed",
        description: note
          ? `[Admin] ${note}`
          : `[Admin] Manual debit of ₹${amount}`,
      });
      res.json({
        balance: Math.round(updatedUser!.walletBalance * 100) / 100,
        username: updatedUser!.username,
      });
    } catch {
      res.status(500).json({ error: "Failed to debit wallet" });
    }
  });

  // ── Wallet: list all registered (Google) users ──────────────────────────────
  router.get("/wallets", async (_req: Request, res: Response) => {
    try {
      const users = await User.find({ isGuest: false })
        .select("username email avatar isGuest walletBalance createdAt")
        .sort({ username: 1 })
        .limit(500)
        .lean();
      res.json({
        wallets: users.map((u) => ({
          id: u._id,
          username: u.username,
          email: u.email,
          avatar: u.avatar,
          isGuest: u.isGuest,
          balance: Math.round(((u as any).walletBalance ?? 0) * 100) / 100,
        })),
      });
    } catch {
      res.status(500).json({ error: "Failed to load wallets" });
    }
  });

  // ── Wallet: admin credit history ─────────────────────────────────────────────
  router.get("/wallets/credits", async (_req: Request, res: Response) => {
    try {
      const txns = await Transaction.find({ description: /^\[Admin\]/ })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();
      // Enrich with username
      const userIds = [...new Set(txns.map((t) => t.userId))];
      const users = await User.find({ _id: { $in: userIds } })
        .select("username email avatar")
        .lean();
      const userMap = Object.fromEntries(users.map((u) => [String(u._id), u]));
      res.json({
        credits: txns.map((t) => ({
          id: t._id,
          userId: t.userId,
          username: userMap[t.userId]?.username ?? "Unknown",
          avatar: (userMap[t.userId] as any)?.avatar ?? "",
          type: t.type,
          amount: t.amount,
          description: t.description,
          createdAt: t.createdAt,
        })),
      });
    } catch {
      res.status(500).json({ error: "Failed to load credit history" });
    }
  });

  // ── Withdrawal requests ──────────────────────────────────────────────────────
  router.get("/withdrawals", async (_req: Request, res: Response) => {
    try {
      const list = await WithdrawalRequest.find()
        .sort({ createdAt: -1 })
        .limit(200)
        .lean();
      res.json({ withdrawals: list });
    } catch {
      res.status(500).json({ error: "Failed to load withdrawals" });
    }
  });

  router.patch("/withdrawals/:id", async (req: Request, res: Response) => {
    try {
      const { status, adminNote } = req.body as {
        status: "approved" | "rejected";
        adminNote?: string;
      };
      if (!["approved", "rejected"].includes(status)) {
        return res
          .status(400)
          .json({ error: "Status must be approved or rejected" });
      }

      const wr = await WithdrawalRequest.findOneAndUpdate(
        { _id: req.params.id, status: "pending" },
        { $set: { status, adminNote, processedAt: new Date() } },
        { new: true },
      );
      if (!wr) return res.status(400).json({ error: "Not found or already processed" });

      // If rejected → refund the held amount back to user
      if (status === "rejected") {
        await User.findByIdAndUpdate(wr.userId, {
          $inc: { walletBalance: wr.amount },
        });
      }

      // Update linked transaction status
      await Transaction.findOneAndUpdate(
        { "metadata.withdrawalRequestId": wr.id, type: "withdrawal" },
        { status: status === "approved" ? "completed" : "failed" },
      );

      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to process withdrawal" });
    }
  });

  // ── Deposit requests (admin view) ───────────────────────────────────────────
  router.get("/deposits", async (_req: Request, res: Response) => {
    try {
      const list = await DepositRequest.find()
        .sort({ createdAt: -1 })
        .limit(200)
        .lean();
      res.json({ deposits: list });
    } catch {
      res.status(500).json({ error: "Failed to load deposit requests" });
    }
  });

  router.patch("/deposits/:id", async (req: Request, res: Response) => {
    try {
      const { status, adminNote } = req.body as {
        status: "approved" | "rejected";
        adminNote?: string;
      };
      if (!["approved", "rejected"].includes(status)) {
        return res
          .status(400)
          .json({ error: "Status must be approved or rejected" });
      }

      const dr = await DepositRequest.findOneAndUpdate(
        { _id: req.params.id, status: "pending" },
        { $set: { status, adminNote, processedAt: new Date() } },
        { new: true },
      );
      if (!dr) return res.status(400).json({ error: "Not found or already processed" });

      if (status === "approved") {
        // Credit wallet
        await User.findByIdAndUpdate(dr.userId, {
          $inc: { walletBalance: dr.amount },
        });
        // Record transaction
        const desc =
          dr.submissionType === "voucher"
            ? `₹${dr.amount} credited — ${dr.voucherBrand} voucher approved`
            : `₹${dr.amount} credited — UTR ${dr.utrNumber} verified`;
        await Transaction.create({
          userId: dr.userId,
          type: "deposit",
          amount: dr.amount,
          status: "completed",
          description: desc,
          metadata: { depositRequestId: dr.id, utrNumber: dr.utrNumber },
        });
      }

      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to process deposit request" });
    }
  });

  // ── Voucher reward delivery ──────────────────────────────────────────────────
  router.patch(
    "/withdrawals/:id/deliver",
    async (req: Request, res: Response) => {
      try {
        const {
          deliveredVoucherNumber,
          deliveredVoucherPin,
          deliveredVoucherExpiry,
          adminMessage,
        } = req.body as {
          deliveredVoucherNumber: string;
          deliveredVoucherPin: string;
          deliveredVoucherExpiry: string;
          adminMessage?: string;
        };
        if (
          !deliveredVoucherNumber?.trim() ||
          !deliveredVoucherPin?.trim() ||
          !deliveredVoucherExpiry?.trim()
        ) {
          return res
            .status(400)
            .json({ error: "Voucher number, PIN and expiry are required" });
        }

        const wr = await WithdrawalRequest.findById(req.params.id);
        if (!wr) return res.status(404).json({ error: "Request not found" });
        if (wr.redemptionType !== "voucher")
          return res.status(400).json({ error: "Not a voucher redemption" });
        if (wr.status === "delivered")
          return res.status(400).json({ error: "Already delivered" });
        if (wr.status === "rejected")
          return res.status(400).json({ error: "Request was rejected" });

        wr.status = "delivered";
        wr.deliveredVoucherNumber = deliveredVoucherNumber.trim();
        wr.deliveredVoucherPin = deliveredVoucherPin.trim();
        wr.deliveredVoucherExpiry = deliveredVoucherExpiry.trim();
        wr.adminMessage = adminMessage?.trim();
        wr.deliveredAt = new Date();
        await wr.save();

        await Transaction.findOneAndUpdate(
          { "metadata.withdrawalRequestId": wr.id, type: "withdrawal" },
          {
            status: "completed",
            description: `Reward delivered — ${wr.voucherBrand} voucher ₹${wr.amount}`,
          },
        );

        res.json({ success: true });
      } catch {
        res.status(500).json({ error: "Failed to deliver voucher" });
      }
    },
  );

  // ── AI Survival Championship (admin view) ──────────────────────────────────
  router.get("/tournaments", async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, parseInt((req.query.page as string) ?? "1"));
      const limit = 50;
      const tier = req.query.tier as string | undefined;
      const filter: Record<string, any> = {};
      if (tier && ["beginner", "pro", "elite", "boss_arena"].includes(tier))
        filter.tier = tier;

      const [records, total] = await Promise.all([
        SurvivalTournament.find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        SurvivalTournament.countDocuments(filter),
      ]);

      const userIds = [...new Set(records.map((r) => String(r.userId)))];
      const users = await User.find({ _id: { $in: userIds } })
        .select("username avatar email")
        .lean();
      const userMap = Object.fromEntries(users.map((u) => [String(u._id), u]));

      const [
        totalWon,
        totalLost,
        totalActive,
        totalAbandoned,
        totalPointsPaid,
      ] = await Promise.all([
        SurvivalTournament.countDocuments({ status: "won" }),
        SurvivalTournament.countDocuments({ status: "lost" }),
        SurvivalTournament.countDocuments({ status: "active" }),
        SurvivalTournament.countDocuments({ status: "abandoned" }),
        SurvivalTournament.aggregate([
          { $match: { status: "won" } },
          { $group: { _id: null, total: { $sum: "$totalPointsEarned" } } },
        ]).then((r) => r[0]?.total ?? 0),
      ]);

      const tierCounts = await SurvivalTournament.aggregate([
        {
          $group: {
            _id: "$tier",
            count: { $sum: 1 },
            won: { $sum: { $cond: [{ $eq: ["$status", "won"] }, 1, 0] } },
          },
        },
      ]);

      res.json({
        records: records.map((r) => ({
          id: r._id,
          userId: String(r.userId),
          username: (userMap[String(r.userId)] as any)?.username ?? "Unknown",
          avatar: (userMap[String(r.userId)] as any)?.avatar ?? "",
          email: (userMap[String(r.userId)] as any)?.email ?? "",
          tier: r.tier,
          status: r.status,
          currentStage: r.currentStage,
          stagesCompleted: r.stageResults?.length ?? 0,
          totalPointsEarned: r.totalPointsEarned,
          createdAt: r.createdAt,
          completedAt: (r as any).completedAt ?? null,
          stageResults: r.stageResults,
        })),
        total,
        page,
        pages: Math.ceil(total / limit),
        summary: {
          totalWon,
          totalLost,
          totalActive,
          totalAbandoned,
          totalPointsPaid,
          tierBreakdown: tierCounts,
        },
      });
    } catch {
      res
        .status(500)
        .json({ error: "Failed to load survival championship data" });
    }
  });

  // ── Progression leaderboard (XP / achievements) ─────────────────────────────
  router.get(
    "/progression/leaderboard",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const category = (req.query.category as string) ?? "xp";
        let sortField: Record<string, -1> = { xp: -1 };
        if (category === "achievements") sortField = { achievementCount: -1 };

        let records: any[];
        if (category === "achievements") {
          records = await PlayerProgress.aggregate([
            {
              $addFields: {
                achievementCount: { $size: { $ifNull: ["$achievements", []] } },
              },
            },
            { $sort: { achievementCount: -1 } },
            { $limit: 50 },
            {
              $project: {
                userId: 1,
                level: 1,
                rank: 1,
                xp: 1,
                achievements: 1,
                achievementCount: 1,
              },
            },
          ]);
        } else {
          records = await PlayerProgress.find({})
            .sort(sortField as any)
            .limit(50)
            .select("userId level rank xp achievements")
            .lean();
        }

        const userIds = records.map((r) => r.userId);
        const users = await User.find({ _id: { $in: userIds } })
          .select("username avatar isGuest")
          .lean();
        const userMap = new Map(users.map((u) => [String(u._id), u]));

        const leaderboard = records.map((r, i) => {
          const u = userMap.get(r.userId);
          const badge = computeAndCacheBadge(
            r.userId,
            (r.achievements ?? []).map((a: any) => a.id),
          );
          return {
            rank: i + 1,
            userId: r.userId,
            username: u?.username ?? "Unknown",
            avatar: (u as any)?.avatar ?? "avatar_1",
            isGuest: u?.isGuest ?? false,
            level: r.level ?? 1,
            playerRank: r.rank ?? "bronze",
            xp: r.xp ?? 0,
            achievementCount: r.achievementCount ?? r.achievements?.length ?? 0,
            achievementIds: (r.achievements ?? []).map((a: any) => a.id),
            badge: badge ?? null,
          };
        });

        res.json({ leaderboard, category });
      } catch {
        res
          .status(500)
          .json({ error: "Failed to fetch progression leaderboard" });
      }
    },
  );

  // ── Reset full leaderboard ──────────────────────────────────────────────────
  router.post("/leaderboard/reset", async (_req: Request, res: Response) => {
    try {
      const result = await User.updateMany(
        {},
        {
          $set: {
            "stats.gamesPlayed": 0,
            "stats.gamesWon": 0,
            "stats.roundsPlayed": 0,
            "stats.roundsWon": 0,
            "stats.totalPointsEarned": 0,
            "stats.showAttempts": 0,
            "stats.showSuccesses": 0,
          },
        },
      );
      res.json({ message: `Reset stats for ${result.modifiedCount} users` });
    } catch {
      res.status(500).json({ error: "Failed to reset leaderboard" });
    }
  });

  // ── Support Tickets ─────────────────────────────────────────────────────────
  router.get("/support", requireAdmin, async (req: Request, res: Response) => {
    try {
      const status = req.query.status as string | undefined;
      const filter = status && status !== "all" ? { status } : {};
      const tickets = await SupportTicket.find(filter)
        .sort({ createdAt: -1 })
        .limit(200)
        .lean();
      const openCount = await SupportTicket.countDocuments({ status: "open" });
      const inProgressCount = await SupportTicket.countDocuments({
        status: "in_progress",
      });
      const resolvedCount = await SupportTicket.countDocuments({
        status: "resolved",
      });
      res.json({
        tickets,
        summary: {
          open: openCount,
          in_progress: inProgressCount,
          resolved: resolvedCount,
        },
      });
    } catch {
      res.status(500).json({ error: "Failed to load support tickets" });
    }
  });

  router.patch(
    "/support/:id",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const { status, adminNote, adminReply } = req.body;
        const update: any = {};
        if (status) update.status = status;
        if (adminNote !== undefined) update.adminNote = adminNote;
        if (adminReply !== undefined) update.adminReply = adminReply;
        const ticket = await SupportTicket.findByIdAndUpdate(
          req.params.id,
          update,
          { new: true },
        );
        if (!ticket) return res.status(404).json({ error: "Ticket not found" });
        res.json({ ticket });
      } catch {
        res.status(500).json({ error: "Failed to update ticket" });
      }
    },
  );

  // ── Push notifications (broadcast to all connected users) ──────────────────
  router.post("/notify", requireAdmin, async (req: Request, res: Response) => {
    try {
      const {
        title,
        message,
        type = "info",
      } = req.body as {
        title: string;
        message: string;
        type?: "info" | "warning" | "success";
      };
      if (!title?.trim() || !message?.trim()) {
        return res
          .status(400)
          .json({ error: "Title and message are required" });
      }
      const payload = {
        id: Date.now().toString(),
        title: title.trim(),
        message: message.trim(),
        type,
        sentAt: new Date().toISOString(),
      };
      io.emit("admin:notification", payload);
      res.json({ success: true, recipients: io.sockets.sockets.size });
    } catch {
      res.status(500).json({ error: "Failed to send notification" });
    }
  });

  // ── FCM push notifications (targeted) ──────────────────────────────────────
  router.post("/push/send", requireAdmin, async (req: Request, res: Response) => {
    try {
      const {
        userIds,
        title, message,
        category = "system",
        type = "info",
        actionUrl,
        global: isGlobal,
        inactiveHours,
      } = req.body as {
        userIds?: string[];
        title: string;
        message: string;
        category?: NotificationCategory;
        type?: "info" | "warning" | "success";
        actionUrl?: string;
        global?: boolean;
        inactiveHours?: number;
      };

      if (!title?.trim() || !message?.trim())
        return res.status(400).json({ error: "title and message required" });

      if (isGlobal) {
        // Create broadcast record first so deliveredCount can be incremented
        const broadcast = await NotificationBroadcast.create({
          title, message, category, type, actionUrl,
          targetType: 'global', intendedCount: 0,
        });
        const { intendedCount } = await sendGlobalNotification({
          title, message, category, type, actionUrl, skipThrottle: true,
          broadcastId: String(broadcast._id),
        });
        await NotificationBroadcast.findByIdAndUpdate(broadcast._id, { intendedCount });
        res.json({ ok: true, mode: "global", broadcastId: String(broadcast._id) });

      } else if (inactiveHours) {
        await sendInactivityNotifications(inactiveHours);
        res.json({ ok: true, mode: "inactive" });

      } else if (userIds?.length) {
        const broadcast = await NotificationBroadcast.create({
          title, message, category, type, actionUrl,
          targetType: 'targeted', intendedCount: userIds.length,
        });
        await sendBulkNotification(userIds, {
          title, message, category, type, actionUrl, skipThrottle: true,
          broadcastId: String(broadcast._id),
        });
        res.json({ ok: true, mode: "targeted", count: userIds.length, broadcastId: String(broadcast._id) });

      } else {
        res.status(400).json({ error: "Provide userIds, global:true, or inactiveHours" });
      }
    } catch {
      res.status(500).json({ error: "Failed to send push notifications" });
    }
  });

  router.get("/push/health", requireAdmin, async (_req: Request, res: Response) => {
    const projectId   = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey  = process.env.FIREBASE_PRIVATE_KEY;
    const envOk = !!(projectId && clientEmail && privateKey);
    const tokenCount = await NotificationToken.countDocuments();
    res.json({
      envVarsSet: envOk,
      projectId:  projectId ?? null,
      tokenCount,
      hint: !envOk
        ? 'Add FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY to Render env vars'
        : tokenCount === 0
        ? 'No FCM tokens registered yet — users must open the app and allow notifications first'
        : 'Firebase looks configured. If push still fails check Render logs for [FCM] errors',
    });
  });

  router.get("/push/broadcasts", requireAdmin, async (req: Request, res: Response) => {
    try {
      const page  = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
      const limit = 20;
      const [broadcasts, total] = await Promise.all([
        NotificationBroadcast.find()
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        NotificationBroadcast.countDocuments(),
      ]);
      res.json({ broadcasts, total, page, pages: Math.ceil(total / limit) });
    } catch {
      res.status(500).json({ error: "Failed to fetch broadcasts" });
    }
  });

  router.get("/push/users", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const tokens = await NotificationToken.find().select("userId deviceType lastActiveAt").lean();
      const userMap: Record<string, { deviceCount: number; lastActiveAt: Date; devices: string[] }> = {};
      for (const t of tokens) {
        if (!userMap[t.userId]) userMap[t.userId] = { deviceCount: 0, lastActiveAt: t.lastActiveAt, devices: [] };
        userMap[t.userId].deviceCount++;
        userMap[t.userId].devices.push(t.deviceType);
        if (t.lastActiveAt > userMap[t.userId].lastActiveAt) userMap[t.userId].lastActiveAt = t.lastActiveAt;
      }
      res.json({ users: userMap, total: Object.keys(userMap).length });
    } catch {
      res.status(500).json({ error: "Failed to list token users" });
    }
  });

  // ── Announcements ───────────────────────────────────────────────────────────
  router.get("/announcements", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const list = await Announcement.find().sort({ createdAt: -1 }).limit(50).lean();
      res.json({ announcements: list });
    } catch {
      res.status(500).json({ error: "Failed to fetch announcements" });
    }
  });

  router.post("/announcements", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { message, type = "banner", expiresAt } = req.body as {
        message: string;
        type?: "banner" | "marquee" | "popup";
        expiresAt?: string;
      };
      if (!message?.trim()) return res.status(400).json({ error: "message required" });
      const ann = await Announcement.create({
        message: message.trim(),
        type,
        active: true,
        ...(expiresAt ? { expiresAt: new Date(expiresAt) } : {}),
      });
      res.json({ announcement: ann });
    } catch {
      res.status(500).json({ error: "Failed to create announcement" });
    }
  });

  router.patch("/announcements/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const update: any = {};
      if (req.body.active !== undefined) update.active = req.body.active;
      if (req.body.message !== undefined) update.message = String(req.body.message).trim();
      if (req.body.type !== undefined) update.type = req.body.type;
      const ann = await Announcement.findByIdAndUpdate(req.params.id, update, { new: true });
      if (!ann) return res.status(404).json({ error: "Not found" });
      res.json({ announcement: ann });
    } catch {
      res.status(500).json({ error: "Failed to update announcement" });
    }
  });

  router.delete("/announcements/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await Announcement.findByIdAndDelete(req.params.id);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete announcement" });
    }
  });

  // ── Game Review ──────────────────────────────────────────────────────────────
  router.get("/game-review/:roomId", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { roomId } = req.params;
      const [game, rawTransactions] = await Promise.all([
        Game.findOne({ roomId: roomId.toUpperCase() }).lean(),
        Transaction.find({ "metadata.roomCode": roomId.toUpperCase() }).sort({ createdAt: 1 }).lean(),
      ]);
      if (!game) return res.status(404).json({ error: "Game not found" });

      // Build userId → username map from game players first
      const usernameMap: Record<string, string> = {};
      for (const p of (game as any).players ?? []) {
        if (p.userId) usernameMap[String(p.userId)] = p.username;
      }

      // For any transaction userId not already in game.players (e.g. player who left before start)
      const missingIds = [...new Set(rawTransactions.map((t: any) => String(t.userId)))]
        .filter(id => !usernameMap[id]);
      if (missingIds.length > 0) {
        const extraUsers = await User.find({ _id: { $in: missingIds } }).select("username").lean();
        for (const u of extraUsers as any[]) {
          usernameMap[String(u._id)] = u.username;
        }
      }

      // Enrich each transaction with the player's name
      const transactions = rawTransactions.map((t: any) => ({
        ...t,
        playerUsername: usernameMap[String(t.userId)] ?? "Unknown",
      }));

      res.json({ game, transactions });
    } catch (err) {
      console.error("[Admin] game-review error:", err);
      res.status(500).json({ error: "Failed to fetch game" });
    }
  });

  // ── Missed Prize Payouts (failed / unresolved winning transactions) ─────────
  router.get("/missed-payouts", requireAdmin, async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = 30;
      const [failed, orphaned, unrefundedTeamEntries] = await Promise.all([
        // Transactions explicitly marked failed
        Transaction.find({ type: "winning", status: "failed" })
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        // Games finished with an entry fee but no winning transaction recorded
        // (indicates distributePrize may have silently skipped)
        Game.aggregate([
          { $match: { status: "finished" } },
          // Lookup prize transactions (winning type)
          {
            $lookup: {
              from: "transactions",
              let: { rid: "$roomId" },
              pipeline: [
                { $match: { $expr: { $and: [{ $eq: ["$type", "winning"] }, { $eq: [{ $toString: "$metadata.roomCode" }, { $toString: "$$rid" }] }] } } },
              ],
              as: "prizes",
            },
          },
          // Lookup entry fee transactions
          {
            $lookup: {
              from: "transactions",
              let: { rid: "$roomId" },
              pipeline: [
                { $match: { $expr: { $and: [{ $eq: ["$type", "entry_fee"] }, { $eq: [{ $toString: "$metadata.roomCode" }, { $toString: "$$rid" }] }] } } },
              ],
              as: "fees",
            },
          },
          // Lookup refund transactions — players who joined+paid but left before game start
          // are refunded, so they should NOT be counted as net paid players.
          {
            $lookup: {
              from: "transactions",
              let: { rid: "$roomId" },
              pipeline: [
                { $match: { $expr: { $and: [{ $eq: ["$type", "refund"] }, { $eq: [{ $toString: "$metadata.roomCode" }, { $toString: "$$rid" }] }] } } },
              ],
              as: "refunds",
            },
          },
          // Add computed fields before filtering
          {
            $addFields: {
              netPaidCount: { $subtract: [{ $size: "$fees" }, { $size: "$refunds" }] },
              feeAmount: { $ifNull: [{ $arrayElemAt: ["$fees.amount", 0] }, 0] },
            },
          },
          // Only rooms where at least 1 net-paid player exists and no prize was awarded
          {
            $match: {
              $expr: { $and: [
                { $gt: ["$netPaidCount", 0] },
                { $eq: [{ $size: "$prizes" }, 0] },
              ]},
            },
          },
          { $sort: { endedAt: -1 } },
          { $limit: 50 },
          {
            $project: {
              roomId: 1, endedAt: 1, winnerId: 1, winnerUsername: 1,
              // paidCount = net paid players (entry fees minus refunds)
              paidCount: "$netPaidCount",
              // totalPot uses net paid count so it matches what the winner should receive
              totalPot: { $multiply: ["$feeAmount", "$netPaidCount"] },
            },
          },
        ]),
        // Team Survival: entry_locked transactions with no subsequent refund/settlement for same userId+teamId
        Transaction.aggregate([
          // All team survival entry locks (has metadata.teamId)
          { $match: { type: 'entry_locked', 'metadata.teamId': { $exists: true, $ne: '' } } },
          // Lookup the SurvivalTeam — only include completed/abandoned (not still forming/playing)
          {
            $lookup: {
              from: 'survivalteams',
              let: { tid: '$metadata.teamId' },
              pipeline: [
                { $match: { $expr: { $eq: [{ $toString: '$_id' }, '$$tid'] } } },
                { $project: { teamCode: 1, status: 1, tier: 1 } },
              ],
              as: 'team',
            },
          },
          { $unwind: { path: '$team', preserveNullAndEmptyArrays: false } },
          // Skip tournaments still in progress
          { $match: { 'team.status': { $in: ['completed', 'abandoned'] } } },
          // Check if a refund/settlement exists for same userId + teamId
          {
            $lookup: {
              from: 'transactions',
              let: { uid: '$userId', tid: '$metadata.teamId' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ['$userId', '$$uid'] },
                        { $eq: ['$metadata.teamId', '$$tid'] },
                        { $in: ['$type', ['refund', 'match_settlement', 'winning']] },
                      ],
                    },
                  },
                },
              ],
              as: 'settlements',
            },
          },
          // Only unsettled entries
          { $match: { $expr: { $eq: [{ $size: '$settlements' }, 0] } } },
          // Join user for display
          {
            $lookup: {
              from: 'users',
              let: { uid: '$userId' },
              pipeline: [
                { $match: { $expr: { $eq: [{ $toString: '$_id' }, '$$uid'] } } },
                { $project: { username: 1, avatar: 1 } },
              ],
              as: 'userDoc',
            },
          },
          { $unwind: { path: '$userDoc', preserveNullAndEmptyArrays: true } },
          { $sort: { createdAt: -1 } },
          { $limit: 100 },
          {
            $project: {
              _id: 1,
              userId: 1,
              amount: 1,
              createdAt: 1,
              teamId: '$metadata.teamId',
              teamCode: '$team.teamCode',
              teamStatus: '$team.status',
              teamTier: '$team.tier',
              username: '$userDoc.username',
              avatar: '$userDoc.avatar',
            },
          },
        ]),
      ]);

      const total = await Transaction.countDocuments({ type: "winning", status: "failed" });
      res.json({ failed, orphaned, unrefundedTeamEntries, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
    } catch (err) {
      console.error("[Admin] missed-payouts error:", err);
      res.status(500).json({ error: "Failed to fetch missed payouts" });
    }
  });

  // Refund a team survival entry lock (creates a proper refund transaction tagged with teamId)
  router.post("/missed-payouts/refund-team-entry", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId, amount, teamId, teamCode, note } = req.body;
      if (!userId || !amount || amount <= 0 || !teamId) {
        return res.status(400).json({ error: "userId, amount, and teamId are required" });
      }

      const userBefore = await User.findById(userId).select("walletBalance username").lean() as any;
      if (!userBefore) return res.status(404).json({ error: "User not found" });

      const updated = await User.findByIdAndUpdate(userId, { $inc: { walletBalance: amount } }, { new: true });
      if (!updated) return res.status(500).json({ error: "Failed to update wallet" });

      await Transaction.create({
        userId,
        type: "refund",
        amount,
        status: "completed",
        description: `Admin refund: Team Survival entry (${teamCode ?? teamId})${note ? ` — ${note}` : ""}`,
        balanceBefore: userBefore.walletBalance,
        balanceAfter: userBefore.walletBalance + amount,
        metadata: { teamId, adminNote: note ?? "Admin refund via missed-payouts dashboard" },
      });

      console.log(`[Admin] Refunded team entry ₹${amount} to ${userBefore.username} (${userId}). team=${teamCode}`);
      res.json({ ok: true, balance: updated.walletBalance, username: userBefore.username });
    } catch (err) {
      console.error("[Admin] refund-team-entry error:", err);
      res.status(500).json({ error: "Refund failed" });
    }
  });

  // Manually credit a missed prize to a user
  router.post("/missed-payouts/repay", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId, amount, roomCode, note } = req.body;
      if (!userId || !amount || amount <= 0) return res.status(400).json({ error: "userId and amount required" });

      const userBefore = await User.findById(userId).select("walletBalance username").lean() as any;
      if (!userBefore) return res.status(404).json({ error: "User not found" });

      const updated = await User.findByIdAndUpdate(userId, { $inc: { walletBalance: amount } }, { new: true });
      if (!updated) return res.status(500).json({ error: "Failed to update wallet" });

      await Transaction.create({
        userId,
        type: "winning",
        amount,
        status: "completed",
        description: `Admin repay: missed prize for room ${roomCode ?? "unknown"}${note ? ` — ${note}` : ""}`,
        balanceBefore: userBefore.walletBalance,
        balanceAfter: updated.walletBalance,
        metadata: { roomCode: roomCode ?? "", adminRepay: true },
      });

      console.log(`[Admin] Repaid missed prize ₹${amount} to ${userBefore.username} (${userId}). room=${roomCode}`);
      res.json({ ok: true, balance: updated.walletBalance, username: userBefore.username });
    } catch (err) {
      console.error("[Admin] repay error:", err);
      res.status(500).json({ error: "Repay failed" });
    }
  });

  // ── Team Arena telemetry ────────────────────────────────────────────────────
  router.get("/team-arena/analytics", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const [total, abandoned, completed] = await Promise.all([
        SurvivalTeam.countDocuments(),
        SurvivalTeam.countDocuments({ status: 'abandoned' }),
        SurvivalTeam.countDocuments({ status: 'completed' }),
      ]);

      // Stage clear rates: for each stage 1–5, how many runs cleared it
      const stageClearCounts = await Promise.all(
        [1,2,3,4,5].map(stage =>
          SurvivalTeam.countDocuments({ 'stageResults': { $elemMatch: { stage, teamWon: true } } })
        )
      );

      // Stage 5 win rate (completed the entire tournament)
      const fullWins = await SurvivalTeam.countDocuments({
        status: 'completed',
        'stageResults.4.teamWon': true,
      });

      // Runs that were abandoned with 0 stages played (refunded rage quits)
      const earlyAbandons = await SurvivalTeam.countDocuments({
        status: 'abandoned',
        stageResults: { $size: 0 },
      });

      // Average stage reached (across all non-forming runs)
      const avgStageAgg = await SurvivalTeam.aggregate([
        { $match: { status: { $in: ['completed', 'abandoned'] } } },
        { $project: { stagesPlayed: { $size: '$stageResults' } } },
        { $group: { _id: null, avg: { $avg: '$stagesPlayed' } } },
      ]);
      const avgStageReached = avgStageAgg[0]?.avg ?? 0;

      // Tier breakdown
      const tierBreakdown = await SurvivalTeam.aggregate([
        { $group: { _id: '$tier', count: { $sum: 1 }, wins: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } } } },
        { $sort: { count: -1 } },
      ]);

      // Fee mode split
      const feeModeCounts = await SurvivalTeam.aggregate([
        { $group: { _id: '$entryFeeMode', count: { $sum: 1 } } },
      ]);

      const runs = total > 0 ? total : 1; // avoid div/0
      res.json({
        overview: {
          totalRuns:       total,
          completedRuns:   completed,
          abandonedRuns:   abandoned,
          earlyAbandons,
          completionRate:  +((completed / runs) * 100).toFixed(1),
          abandonRate:     +((abandoned / runs) * 100).toFixed(1),
          avgStageReached: +avgStageReached.toFixed(2),
        },
        stageClearRates: [1,2,3,4,5].map((stage, i) => ({
          stage,
          cleared: stageClearCounts[i],
          clearRate: +((stageClearCounts[i] / runs) * 100).toFixed(1),
        })),
        stage5WinRate: total > 0 ? +((fullWins / runs) * 100).toFixed(1) : 0,
        tierBreakdown: tierBreakdown.map(t => ({
          tier: t._id,
          count: t.count,
          wins: t.wins,
          winRate: t.count > 0 ? +((t.wins / t.count) * 100).toFixed(1) : 0,
        })),
        feeModeBreakdown: feeModeCounts.map(f => ({ mode: f._id, count: f.count })),
      });
    } catch (err) {
      console.error('[Admin] Team arena analytics error:', err);
      res.status(500).json({ error: 'Failed to load team arena analytics' });
    }
  });

  // ── Hold System: Active Holds Overview ─────────────────────────────────────
  router.get("/hold-system/overview", requireAdmin, async (_req: Request, res: Response) => {
    try {
      // Rooms with active holds (pre-LIVE)
      const roomsWithHolds = await Room.find(
        { heldPlayerIds: { $exists: true, $not: { $size: 0 } }, status: 'waiting' },
      ).select('code name heldPlayerIds config matchState createdAt').lean();

      // Players with non-zero heldBalance
      const playersWithHolds = await User.find({ heldBalance: { $gt: 0 } })
        .select('username walletBalance heldBalance lastSeenAt').lean();

      // Recent entry_hold, entry_released, abandoned_resolution in last 24h
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [holdCount, releaseCount, abandonCount] = await Promise.all([
        Transaction.countDocuments({ type: 'entry_hold', createdAt: { $gte: since } }),
        Transaction.countDocuments({ type: 'entry_released', createdAt: { $gte: since } }),
        Transaction.countDocuments({ type: 'abandoned_resolution', createdAt: { $gte: since } }),
      ]);

      // Exploit flagged releases in last 24h
      const exploitFlagged = await Transaction.find({
        type: 'entry_released',
        'metadata.exploitFlag': true,
        createdAt: { $gte: since },
      }).select('userId amount description metadata createdAt').sort({ createdAt: -1 }).limit(50).lean();

      res.json({
        roomsWithHolds: roomsWithHolds.map(r => ({
          code: r.code,
          name: r.name,
          heldCount: (r as any).heldPlayerIds?.length ?? 0,
          entryFee: (r.config as any).entryFee ?? 0,
          matchState: (r as any).matchState,
          createdAt: r.createdAt,
        })),
        playersWithHolds: playersWithHolds.map((p: any) => ({
          userId: String(p._id),
          username: p.username,
          walletBalance: p.walletBalance,
          heldBalance: p.heldBalance,
          availableBalance: Math.max(0, p.walletBalance - p.heldBalance),
          lastSeenAt: p.lastSeenAt,
        })),
        stats24h: { holdCount, releaseCount, abandonCount },
        exploitFlagged,
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to load hold overview' });
    }
  });

  // ── Hold System: Per-user exploit stats ─────────────────────────────────────
  router.get("/hold-system/exploit/:userId", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const stats = getHoldExploitStats(userId);
      const recentReleases = await Transaction.find({
        userId,
        type: { $in: ['entry_released', 'abandoned_resolution'] },
      }).sort({ createdAt: -1 }).limit(20).lean();
      res.json({ userId, ...stats, recentReleases });
    } catch (err) {
      res.status(500).json({ error: 'Failed to load exploit stats' });
    }
  });

  // ── Hold System: Clear all hold/release transactions + reset tracker ─────────
  router.post("/hold-system/clear", requireAdmin, async (_req: Request, res: Response) => {
    try {
      // Delete all entry_hold and entry_released transactions (internal accounting, no real money movement)
      const deleted = await Transaction.deleteMany({
        type: { $in: ['entry_hold', 'entry_released'] },
      });
      // Unset exploitFlag on any remaining flagged transactions
      await Transaction.updateMany(
        { 'metadata.exploitFlag': true },
        { $unset: { 'metadata.exploitFlag': '' } },
      );
      // Reset the in-memory anti-exploit tracker for all users
      _resetHoldExploitTracker();
      res.json({ success: true, deleted: deleted.deletedCount });
    } catch (err) {
      res.status(500).json({ error: 'Failed to clear hold data' });
    }
  });

  // ── Spin analytics ──────────────────────────────────────────────────────────
  router.get('/spin-analytics', requireAdmin, async (_req: Request, res: Response) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const cfg = await getAdminConfig();
      const sc = (cfg as any).spinConfig ?? {};
      const moneyLimit  = sc.moneySpinDailyLimit  ?? 3;
      const pointsLimit = sc.pointsSpinDailyLimit ?? 10;

      // SpinLog aggregate: all-time stats per user (all users who spun after SpinLog was added)
      const spinLogAgg = await SpinLog.aggregate([
        {
          $group: {
            _id: '$userId',
            allTimeMoneySpin:  { $sum: { $cond: [{ $eq: ['$spinType', 'money']  }, 1, 0] } },
            allTimePointsSpin: { $sum: { $cond: [{ $eq: ['$spinType', 'points'] }, 1, 0] } },
            totalMoneyWon:     { $sum: { $cond: [{ $and: [{ $eq: ['$spinType', 'money'] }, { $eq: ['$prizeType', 'cash'] }] }, '$prizeAmount', 0] } },
            totalMoneySpent:   { $sum: { $cond: [{ $and: [{ $eq: ['$spinType', 'money'] }, { $eq: ['$isFree', false] }] }, '$costRupees', 0] } },
            totalPointsSpent:  { $sum: { $cond: [{ $and: [{ $eq: ['$spinType', 'points'] }, { $eq: ['$isFree', false] }] }, '$costPoints', 0] } },
            lastSpinAt:        { $max: '$createdAt' },
          },
        },
      ]);
      const slMap = Object.fromEntries(spinLogAgg.map(a => [String(a._id), a]));
      const spinLogUserIds = spinLogAgg.map(a => a._id);

      // Get all users: those in SpinLog OR those with active daily spin counts
      const spinners = await User.find({
        $or: [
          { _id: { $in: spinLogUserIds } },
          { spinDailyCount: { $gt: 0 } },
          { pointsSpinDailyCount: { $gt: 0 } },
        ],
        isGuest: false,
      }).select('username avatar spinLastDate spinDailyCount pointsSpinLastDate pointsSpinDailyCount').lean() as any[];

      const result = spinners.map((u: any) => {
        const uid = String(u._id);
        const sl = slMap[uid] ?? {};
        const moneyToday  = u.spinLastDate === today  ? (u.spinDailyCount  ?? 0) : 0;
        const pointsToday = u.pointsSpinLastDate === today ? (u.pointsSpinDailyCount ?? 0) : 0;
        return {
          id: uid,
          username: u.username,
          avatar: u.avatar ?? 'avatar_1',
          moneySpinsToday:  moneyToday,
          moneySpinLimit:   moneyLimit,
          pointsSpinsToday: pointsToday,
          pointsSpinLimit:  pointsLimit,
          allTimeMoneySpin:  sl.allTimeMoneySpin  ?? (u.spinDailyCount  ?? 0),
          allTimePointsSpin: sl.allTimePointsSpin ?? (u.pointsSpinDailyCount ?? 0),
          totalMoneyWon:     Math.round((sl.totalMoneyWon ?? 0) * 100) / 100,
          totalMoneySpent:   Math.round((sl.totalMoneySpent ?? 0) * 100) / 100,
          totalPointsSpent:  sl.totalPointsSpent ?? 0,
          lastSpinAt: sl.lastSpinAt ?? (u.spinLastDate ? new Date(u.spinLastDate) : null),
        };
      }).filter((u: any) => u.allTimeMoneySpin > 0 || u.allTimePointsSpin > 0 || u.moneySpinsToday > 0 || u.pointsSpinsToday > 0)
        .sort((a: any, b: any) => (b.moneySpinsToday + b.pointsSpinsToday) - (a.moneySpinsToday + a.pointsSpinsToday));

      res.json({ users: result, moneySpinLimit: moneyLimit, pointsSpinLimit: pointsLimit });
    } catch (err) {
      console.error('[Admin] spin-analytics error:', err);
      res.status(500).json({ error: 'Failed to load spin analytics' });
    }
  });

  router.get('/spin-analytics/daily', requireAdmin, async (_req: Request, res: Response) => {
    try {
      // Per-player per-day aggregate from SpinLog (permanent records, never reset)
      const playerAgg = await SpinLog.aggregate([
        {
          $group: {
            _id: {
              date:   { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              userId: '$userId',
            },
            moneyCount:   { $sum: { $cond: [{ $eq: ['$spinType', 'money']  }, 1, 0] } },
            pointsCount:  { $sum: { $cond: [{ $eq: ['$spinType', 'points'] }, 1, 0] } },
            freeCount:    { $sum: { $cond: ['$isFree', 1, 0] } },
            moneySpent:   { $sum: { $cond: [{ $and: [{ $eq: ['$spinType','money']  }, { $not: '$isFree' }] }, '$costRupees',  0] } },
            pointsSpent:  { $sum: { $cond: [{ $and: [{ $eq: ['$spinType','points'] }, { $not: '$isFree' }] }, '$costPoints', 0] } },
            moneyWon:     { $sum: { $cond: [{ $and: [{ $eq: ['$spinType','money']  }, { $eq: ['$prizeType','cash'] }] }, '$prizeAmount', 0] } },
            pointsWon:    { $sum: { $cond: [{ $eq: ['$spinType','points'] }, '$prizeAmount', 0] } },
            lastSpin:     { $max: '$createdAt' },
          },
        },
        { $sort: { '_id.date': -1, '_id.userId': 1 } },
      ]);

      // Resolve usernames in bulk
      const uids = [...new Set(playerAgg.map((r:any) => r._id.userId))];
      const users = uids.length ? await User.find({ _id: { $in: uids } }).select('username avatar').lean() as any[] : [];
      const uMap  = Object.fromEntries(users.map((u:any) => [String(u._id), u]));

      // Group by date
      const dayMap = new Map<string, { date:string; moneyCount:number; pointsCount:number; moneySpent:number; pointsSpent:number; moneyWon:number; pointsWon:number; players:any[] }>();
      for (const r of playerAgg) {
        const date   = r._id.date as string;
        const userId = String(r._id.userId);
        const u      = uMap[userId] ?? {};
        if (!dayMap.has(date)) dayMap.set(date, { date, moneyCount:0, pointsCount:0, moneySpent:0, pointsSpent:0, moneyWon:0, pointsWon:0, players:[] });
        const day = dayMap.get(date)!;
        day.moneyCount   += r.moneyCount;
        day.pointsCount  += r.pointsCount;
        day.moneySpent   += r.moneySpent;
        day.pointsSpent  += r.pointsSpent;
        day.moneyWon     += r.moneyWon;
        day.pointsWon    += r.pointsWon;
        day.players.push({
          userId,
          username:    u.username ?? userId.slice(-6),
          avatar:      u.avatar ?? 'avatar_1',
          moneyCount:  r.moneyCount,
          pointsCount: r.pointsCount,
          freeCount:   r.freeCount,
          moneySpent:  Math.round(r.moneySpent  * 100) / 100,
          pointsSpent: r.pointsSpent,
          moneyWon:    Math.round(r.moneyWon    * 100) / 100,
          pointsWon:   r.pointsWon,
          lastSpin:    r.lastSpin,
        });
      }

      const rows = [...dayMap.values()].map(d => ({
        ...d,
        moneySpent:  Math.round(d.moneySpent  * 100) / 100,
        moneyWon:    Math.round(d.moneyWon    * 100) / 100,
        uniqueUsers: d.players.length,
      }));

      res.json({ rows });
    } catch (err) {
      console.error('[Admin] spin-analytics/daily error:', err);
      res.status(500).json({ error: 'Failed to load daily spin report' });
    }
  });

  router.post('/spin-analytics/:userId/reset', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { type } = req.body as { type: 'money' | 'points' };
      if (type === 'money') {
        await User.findByIdAndUpdate(userId, { spinDailyCount: 0, spinLastDate: '' });
      } else if (type === 'points') {
        await User.findByIdAndUpdate(userId, { pointsSpinDailyCount: 0, pointsSpinLastDate: '' });
      } else {
        return res.status(400).json({ error: 'type must be money or points' });
      }
      res.json({ ok: true });
    } catch (err) {
      console.error('[Admin] reset spin error:', err);
      res.status(500).json({ error: 'Failed to reset spins' });
    }
  });

  // ── Room History / Tracker ────────────────────────────────────────────────────
  router.get('/rooms/history', requireAdmin, async (req: Request, res: Response) => {
    try {
      const page   = Math.max(1, parseInt(req.query.page as string) || 1);
      const PER    = 25;
      const type   = (req.query.type   as string) || 'all';
      const stFil  = (req.query.status as string) || 'all';
      const days   = parseInt(req.query.days   as string) || 30;
      const search = ((req.query.search as string) || '').trim();
      const since  = days > 0 ? new Date(Date.now() - days * 86400 * 1000) : new Date(0);

      const includeGames = ['all','multiplayer_free','multiplayer_wager','ai_game'].includes(type);
      const includeSolo  = type === 'survival_solo';
      const includeTeam  = type === 'survival_team';

      // ── Helpers ──────────────────────────────────────────────────────────────
      // entry_hold = no wallet deduction (just a hold record); only entry_locked / entry_fee actually debit the wallet
      const txnSummary = (txns: any[]) => ({
        totalFees:     txns.filter(t => ['entry_fee','entry_locked'].includes(t.type)).reduce((s,t)=>s+t.amount,0),
        totalPaid:     txns.filter(t => ['winning','match_settlement'].includes(t.type)).reduce((s,t)=>s+t.amount,0),
        totalRefunded: txns.filter(t => t.type==='refund').reduce((s,t)=>s+t.amount,0),
        // per-player map so client can compute per-person refund amounts
        perPlayerFees: txns
          .filter(t => ['entry_fee','entry_locked'].includes(t.type))
          .reduce<Record<string,number>>((m,t) => { m[t.userId] = (m[t.userId]??0) + t.amount; return m; }, {}),
        list: txns.map(t=>({ id:String(t._id), type:t.type, amount:t.amount, status:t.status, userId:t.userId, description:t.description, createdAt:t.createdAt })),
      });

      // ── GAME records ─────────────────────────────────────────────────────────
      let items: any[] = [];

      if (includeGames) {
        const gMatch: any = { startedAt: { $gte: since } };
        if (type === 'multiplayer_free')  { gMatch.players = { $not:{$elemMatch:{isBot:true}} }; gMatch.entryFee = { $lte: 0 }; }
        if (type === 'multiplayer_wager') { gMatch.players = { $not:{$elemMatch:{isBot:true}} }; gMatch.entryFee = { $gt: 0 }; }
        if (type === 'ai_game')           { gMatch['players.isBot'] = true; }
        if (stFil === 'finished')  gMatch.status = 'finished';
        if (stFil === 'playing')   gMatch.status = 'playing';
        if (stFil === 'abandoned') gMatch.$expr = { $eq: [false, true] }; // games don't have "abandoned" — return empty
        if (search) gMatch.$or = [
          { roomId:          { $regex: search, $options:'i' } },
          { 'players.username': { $regex: search, $options:'i' } },
          { winnerUsername:  { $regex: search, $options:'i' } },
        ];

        const games = await Game.find(gMatch).sort({ startedAt: -1 }).limit(400).lean() as any[];

        const roomIds = games.map((g:any) => g.roomId);
        const txns = roomIds.length
          ? await Transaction.find({ 'metadata.roomCode': { $in: roomIds } }).lean() as any[]
          : [];
        const txnMap = new Map<string, any[]>();
        for (const t of txns) {
          const rc = String(t.metadata?.roomCode ?? '');
          if (!txnMap.has(rc)) txnMap.set(rc, []);
          txnMap.get(rc)!.push(t);
        }

        for (const g of games) {
          const hasBots  = g.players.some((p:any) => p.isBot);
          const gType    = hasBots ? 'ai_game' : (g.entryFee ?? 0) > 0 ? 'multiplayer_wager' : 'multiplayer_free';
          const rt       = txnMap.get(g.roomId) ?? [];
          const summ     = txnSummary(rt);
          const humanPct = g.players.filter((p:any)=>!p.isBot).length;
          items.push({
            id: String(g._id), type: gType, roomCode: g.roomId,
            status: g.status,
            players: g.players.map((p:any)=>({ userId:p.userId, username:p.username, avatar:p.avatar??'avatar_1', isBot:p.isBot, isWinner:p.userId===g.winnerId, score:p.totalScore??0 })),
            winner: g.winnerId ? { userId:g.winnerId, username:g.winnerUsername??'' } : null,
            entryFee: g.entryFee??0, entryPoints:0,
            pot: (g.entryFee??0) * humanPct,
            ...summ,
            hasRefundIssue: summ.totalFees > 0 && summ.totalPaid === 0 && g.status === 'finished',
            roundCount: g.rounds?.length ?? 0,
            rounds: (g.rounds??[]).map((r:any)=>{
              // winnerId / showPlayerId are game-session player IDs (p.id), NOT userId.
              // Look them up in playerResults which stores { playerId: p.id, username, isBot }.
              const pr: any[] = r.playerResults ?? [];
              const rWinnerPR  = pr.find((x:any) => x.playerId === r.winnerId);
              const rShowPR    = pr.find((x:any) => x.playerId === r.showPlayerId);
              // isBot: check game players by username as fallback
              const isBotByName = (uname: string) => g.players.some((p:any) => p.isBot && p.username === uname);
              return {
                roundNumber:r.roundNumber, jokerRank:r.jokerRank,
                showPlayerWon:r.showPlayerWon,
                winnerUsername:  rWinnerPR?.username ?? null,
                winnerIsBot:     rWinnerPR ? isBotByName(rWinnerPR.username) : false,
                showCallerUsername: rShowPR?.username ?? null,
                showCallerIsBot:    rShowPR ? isBotByName(rShowPR.username) : false,
                playerCount: pr.length,
              };
            }),
            startedAt: g.startedAt, endedAt: g.endedAt??null,
          });
        }
      }

      // ── SURVIVAL SOLO ─────────────────────────────────────────────────────────
      if (includeSolo) {
        const sMatch: any = { createdAt: { $gte: since } };
        if (stFil==='finished')  sMatch.status = { $in:['won','lost'] };
        if (stFil==='playing')   sMatch.status = 'active';
        if (stFil==='abandoned') sMatch.status = 'abandoned';
        if (search) sMatch.$or = [{ tier:{ $regex:search,$options:'i' } }];

        const runs = await SurvivalTournament.find(sMatch).sort({ createdAt:-1 }).limit(400).lean() as any[];
        const uids = [...new Set(runs.map(r=>r.userId))];
        const users = uids.length ? await User.find({ _id:{$in:uids} }).select('username avatar').lean() as any[] : [];
        const uMap = Object.fromEntries(users.map(u=>[String(u._id),u]));

        const tIds = runs.map(r=>String(r._id));
        const txns = tIds.length ? await Transaction.find({ 'metadata.survivalTournamentId':{ $in:tIds } }).lean() as any[] : [];
        const txnMap = new Map<string,any[]>();
        for (const t of txns) {
          const k = String(t.metadata?.survivalTournamentId??'');
          if (!txnMap.has(k)) txnMap.set(k,[]);
          txnMap.get(k)!.push(t);
        }

        // Fetch all survival AI games for these users in bulk (to get room codes + rounds per stage)
        const soloUserIds = [...new Set(runs.map((r:any)=>r.userId))];
        const minDate = runs.reduce((min:Date,r:any)=> r.createdAt < min ? r.createdAt : min, runs[0]?.createdAt ?? new Date());
        const soloStageGames = soloUserIds.length ? await Game.find({
          'players.userId': { $in: soloUserIds },
          'players.isBot': true,
          startedAt: { $gte: minDate },
        }).select('roomId players rounds startedAt endedAt winnerId winnerUsername').lean() as any[] : [];
        // Group by userId for fast lookup
        const soloGamesByUser = new Map<string, any[]>();
        for (const g of soloStageGames) {
          const hPlayer = g.players.find((p:any)=>!p.isBot);
          if (!hPlayer) continue;
          const uid = String(hPlayer.userId);
          if (!soloGamesByUser.has(uid)) soloGamesByUser.set(uid,[]);
          soloGamesByUser.get(uid)!.push(g);
        }

        const stMap: Record<string,string> = { won:'finished', lost:'finished', abandoned:'abandoned', active:'playing' };
        for (const r of runs) {
          const u    = uMap[r.userId]??{};
          const tid  = String(r._id);
          const summ = txnSummary(txnMap.get(tid)??[]);

          // Match stage games: games played by this user between tournamentStart and tournamentEnd, sorted by startedAt
          const userGames = (soloGamesByUser.get(r.userId)??[])
            .filter((g:any) => g.startedAt >= r.createdAt && (!r.completedAt || g.startedAt <= r.completedAt))
            .sort((a:any,b:any)=> new Date(a.startedAt).getTime()-new Date(b.startedAt).getTime());

          const enrichedStageResults = (r.stageResults??[]).map((s:any, idx:number) => {
            const stageGame = userGames[idx];
            if (!stageGame) return { ...s };
            const allP: any[] = stageGame.players ?? [];
            const pr: any[] = [];
            return {
              ...s,
              roomCode: stageGame.roomId,
              roomStartedAt: stageGame.startedAt,
              roomEndedAt:   stageGame.endedAt,
              rounds: (stageGame.rounds??[]).map((round:any) => {
                const roundPR: any[] = round.playerResults ?? pr;
                const rWinnerPR  = roundPR.find((x:any) => x.playerId === round.winnerId);
                const rShowPR    = roundPR.find((x:any) => x.playerId === round.showPlayerId);
                const isBotByNameStage = (uname: string) => allP.some((p:any) => p.isBot && p.username === uname);
                return {
                  roundNumber: round.roundNumber,
                  jokerRank:   round.jokerRank,
                  showPlayerWon:     round.showPlayerWon,
                  winnerUsername:    rWinnerPR?.username ?? null,
                  winnerIsBot:       rWinnerPR ? isBotByNameStage(rWinnerPR.username) : false,
                  showCallerUsername: rShowPR?.username ?? null,
                  showCallerIsBot:    rShowPR ? isBotByNameStage(rShowPR.username) : false,
                };
              }),
            };
          });

          items.push({
            id: tid, type:'survival_solo', roomCode:`ST-${r.tier?.slice(0,3).toUpperCase()}-${tid.slice(-5)}`,
            status: stMap[r.status]??'finished', tournamentResult:r.status, tier:r.tier,
            players:[{ userId:r.userId, username:u.username??'?', avatar:u.avatar??'avatar_1', isBot:false, isWinner:r.status==='won', score:r.totalPointsEarned??0 }],
            winner: r.status==='won' ? { userId:r.userId, username:u.username??'?' } : null,
            entryFee:0, entryPoints:r.entryPoints??0,
            pot:r.totalPointsEarned??0, ...summ, hasRefundIssue:false,
            roundCount:r.roundsPlayed??0, rounds:[],
            stageResults: enrichedStageResults,
            startedAt:r.createdAt, endedAt:r.completedAt??null,
          });
        }
      }

      // ── SURVIVAL TEAM ─────────────────────────────────────────────────────────
      if (includeTeam) {
        const tMatch: any = { createdAt: { $gte: since } };
        if (stFil==='finished')  tMatch.status = 'completed';
        if (stFil==='playing')   tMatch.status = { $in:['forming','playing'] };
        if (stFil==='abandoned') tMatch.status = 'abandoned';
        if (search) tMatch.$or = [
          { teamCode:{ $regex:search,$options:'i' } },
          { 'members.username':{ $regex:search,$options:'i' } },
        ];

        const teams = await SurvivalTeam.find(tMatch).sort({ createdAt:-1 }).limit(400).lean() as any[];
        const teamIds = teams.map(t=>String(t._id));
        const txns = teamIds.length ? await Transaction.find({ 'metadata.teamId':{ $in:teamIds } }).lean() as any[] : [];
        const txnMap = new Map<string,any[]>();
        for (const t of txns) {
          const k = String(t.metadata?.teamId??'');
          if (!txnMap.has(k)) txnMap.set(k,[]);
          txnMap.get(k)!.push(t);
        }

        // Fetch stage games for team arena in bulk
        const teamMinDate = teams.reduce((min:Date,t:any)=> t.createdAt < min ? t.createdAt : min, teams[0]?.createdAt ?? new Date());
        const allHumanMemberIds = teams.flatMap((t:any)=>(t.members??[]).filter((m:any)=>!m.isBot).map((m:any)=>m.userId));
        const teamStageGames = allHumanMemberIds.length ? await Game.find({
          'players.userId': { $in: allHumanMemberIds },
          'players.isBot': true,
          startedAt: { $gte: teamMinDate },
        }).select('roomId players rounds startedAt endedAt winnerId winnerUsername').lean() as any[] : [];

        const stMap: Record<string,string> = { completed:'finished', abandoned:'abandoned', playing:'playing', forming:'playing' };
        for (const t of teams) {
          const tid  = String(t._id);
          const members = t.members??[];
          const humanMemberIds = members.filter((m:any)=>!m.isBot).map((m:any)=>m.userId);
          const summ = txnSummary(txnMap.get(tid)??[]);

          // Match team stage games: games where any human member played, within tournament time range
          const teamGames = teamStageGames
            .filter((g:any) => {
              const gPlayers: any[] = g.players ?? [];
              return gPlayers.some((p:any) => !p.isBot && humanMemberIds.includes(p.userId)) &&
                g.startedAt >= t.createdAt && (!t.completedAt || g.startedAt <= t.completedAt);
            })
            .sort((a:any,b:any)=> new Date(a.startedAt).getTime()-new Date(b.startedAt).getTime());

          const enrichedTeamStageResults = (t.stageResults??[]).map((s:any, idx:number) => {
            const stageGame = teamGames[idx];
            if (!stageGame) return { ...s };
            const allP: any[] = stageGame.players ?? [];
            const isBotByName2 = (uname: string) => allP.some((p:any) => p.isBot && p.username === uname);
            return {
              ...s,
              roomCode: stageGame.roomId,
              roomStartedAt: stageGame.startedAt,
              roomEndedAt:   stageGame.endedAt,
              rounds: (stageGame.rounds??[]).map((round:any) => {
                const roundPR: any[] = round.playerResults ?? [];
                const rWinnerPR  = roundPR.find((x:any) => x.playerId === round.winnerId);
                const rShowPR    = roundPR.find((x:any) => x.playerId === round.showPlayerId);
                return {
                  roundNumber: round.roundNumber,
                  jokerRank:   round.jokerRank,
                  showPlayerWon:     round.showPlayerWon,
                  winnerUsername:    rWinnerPR?.username ?? null,
                  winnerIsBot:       rWinnerPR ? isBotByName2(rWinnerPR.username) : false,
                  showCallerUsername: rShowPR?.username ?? null,
                  showCallerIsBot:    rShowPR ? isBotByName2(rShowPR.username) : false,
                };
              }),
            };
          });

          items.push({
            id: tid, type:'survival_team', roomCode:t.teamCode??tid.slice(-6),
            status: stMap[t.status]??'playing', teamStatus:t.status, tier:t.tier,
            entryFeeMode: t.entryFeeMode??'split', hostId: t.hostId,
            players: members.filter((m:any)=>!m.isBot).map((m:any)=>({ userId:m.userId, username:m.username??'?', avatar:m.avatar??'avatar_1', isBot:false, isWinner:t.status==='completed', score:t.totalPointsEarned??0 })),
            allMembers: members.map((m:any)=>({ userId:m.userId, username:m.username??'?', avatar:m.avatar??'avatar_1', isBot:m.isBot??false, personality:m.personality??null })),
            winner: t.status==='completed' ? { userId:t.hostId, username:members[0]?.username??'?' } : null,
            entryFee:0, entryPoints:t.entryPoints??0,
            pot:t.totalPointsEarned??0, ...summ,
            hasRefundIssue: summ.totalFees>0 && summ.totalPaid===0 && !['playing','forming'].includes(t.status),
            roundCount:t.roundsPlayed??0, rounds:[],
            stageResults: enrichedTeamStageResults,
            startedAt:t.createdAt, endedAt:t.completedAt??null,
          });
        }
      }

      // sort merged list by most recent first, then paginate
      items.sort((a,b)=> new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
      if (stFil === 'no_result') items = items.filter(i => i.hasRefundIssue);
      const total = items.length;
      const paged = items.slice((page-1)*PER, page*PER);

      res.json({ items:paged, total, page, pages:Math.max(1, Math.ceil(total/PER)) });
    } catch (err) {
      console.error('[Admin] rooms/history error:', err);
      res.status(500).json({ error: 'Failed to load room history' });
    }
  });

  // ── Game analytics ──────────────────────────────────────────────────────────
  router.get("/analytics", (_req: Request, res: Response) => {
    res.json(getAnalyticsSnapshot());
  });

  router.post("/analytics/reset", (_req: Request, res: Response) => {
    resetAnalytics();
    res.json({ success: true, message: "Analytics reset" });
  });

  return router;
}
