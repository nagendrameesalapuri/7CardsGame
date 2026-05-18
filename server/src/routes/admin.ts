import { Router, Request, Response } from "express";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { requireAdmin } from "../middleware/adminAuth";
import { AdminConfig, getAdminConfig } from "../models/AdminConfig";
import { User } from "../models/User";
import { Room } from "../models/Room";
import { Game } from "../models/Game";
import { SurvivalTournament } from "../models/SurvivalTournament";
import {
  getAllActiveRoomInfos,
  forceEndGame,
  kickPlayerFromGame,
  getActiveGame,
} from "../socket/handlers/gameHandler";
import { refundAbandonedGame } from "../socket/handlers/roomHandler";
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

export default function createAdminRouter(io: Server) {
  const router = Router();

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
      expiresIn: "8h",
    });
    res.json({ token });
  });

  // ── Public config (no auth) ─────────────────────────────────────────────────
  router.get("/config/public", async (_req: Request, res: Response) => {
    try {
      const cfg = await getAdminConfig();
      res.json({
        featureFlags: cfg.featureFlags,
        gameConfig: cfg.gameConfig,
        walletConfig: cfg.walletConfig,
        survivalConfig: cfg.survivalConfig,
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

      await cfg.save();

      // Notify all connected clients of the updated config
      io.emit("admin:config_updated", {
        featureFlags: cfg.featureFlags,
        gameConfig: cfg.gameConfig,
        walletConfig: cfg.walletConfig,
        survivalConfig: cfg.survivalConfig,
      });

      res.json(cfg);
    } catch {
      res.status(500).json({ error: "Failed to update config" });
    }
  });

  // ── Overview stats ──────────────────────────────────────────────────────────
  router.get("/stats", async (_req: Request, res: Response) => {
    try {
      const [totalUsers, totalGames, activeRooms] = await Promise.all([
        User.countDocuments(),
        Game.countDocuments({ status: "finished" }),
        Room.countDocuments({ status: { $in: ["waiting", "playing"] } }),
      ]);
      const onlineCount = getOnlineUserIds().size;
      const liveGames = getAllActiveRoomInfos().filter(
        (r) => r.status === "playing",
      ).length;

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
        res.json({ balance: user.walletBalance, username: user.username });
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
        balance: updatedUser!.walletBalance,
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
          balance: (u as any).walletBalance ?? 0,
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

      const wr = await WithdrawalRequest.findById(req.params.id);
      if (!wr) return res.status(404).json({ error: "Request not found" });
      if (wr.status !== "pending")
        return res.status(400).json({ error: "Already processed" });

      wr.status = status;
      wr.adminNote = adminNote;
      wr.processedAt = new Date();
      await wr.save();

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

      const dr = await DepositRequest.findById(req.params.id);
      if (!dr) return res.status(404).json({ error: "Request not found" });
      if (dr.status !== "pending")
        return res.status(400).json({ error: "Already processed" });

      dr.status = status;
      dr.adminNote = adminNote;
      dr.processedAt = new Date();
      await dr.save();

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
