import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import passport from 'passport';
import rateLimit from 'express-rate-limit';

import { connectDatabase } from './config/database';
import { Announcement } from './models/Announcement';
import { configurePassport } from './config/passport';
import { initSocketIO } from './socket';
import { Room } from './models/Room';
import { User } from './models/User';
import { Transaction } from './models/Transaction';
import { refundAbandonedGame } from './socket/handlers/roomHandler';
import { getAllActiveRoomInfos } from './socket/handlers/gameHandler';

import authRoutes from './routes/auth';
import roomRoutes from './routes/rooms';
import userRoutes from './routes/users';
import gameRoutes from './routes/games';
import walletRoutes from './routes/wallet';
import supportRoutes from './routes/support';
import createAdminRouter from './routes/admin';
import survivalRoutes from './routes/survival';
import tournamentRoutes from './routes/tournaments';
import progressionRoutes from './routes/progression';
import notificationRoutes from './routes/notifications';
import { startTournamentScheduler } from './utils/tournamentScheduler';
import { startReengagementScheduler } from './utils/reengagementScheduler';

const PORT = parseInt(process.env.PORT ?? '5000', 10);
const isProd = process.env.NODE_ENV === 'production';

// Support comma-separated origins: CLIENT_URL=https://a.netlify.app,https://b.netlify.app
const rawOrigins = process.env.CLIENT_URL ?? 'http://localhost:3000';
const allowedOrigins = rawOrigins.split(',').map(o => o.trim()).filter(Boolean);
const corsOrigin = allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins;

async function bootstrap() {
  await connectDatabase();

  const app = express();
  const httpServer = createServer(app);

  // ── Middleware ──────────────────────────────────────────────────────────────
  app.set('trust proxy', 1); // trust first proxy (nginx / container ingress) for rate-limit IP resolution
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: corsOrigin, credentials: true }));
  app.use(express.json({ limit: '5mb' }));

  app.use(
    session({
      secret: process.env.SESSION_SECRET ?? 'dev-secret',
      resave: false,
      saveUninitialized: false,
      // SameSite=None;Secure required for cross-site OAuth redirects (mobile Safari)
      cookie: {
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());
  configurePassport();

  // Skip all rate limiting in test mode so E2E tests can run without hitting limits
  if (process.env.NODE_ENV !== 'test') {
    // General API rate limit — generous enough for active gameplay (most game actions are Socket.IO)
    app.use('/api/', rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many requests, please try again in a few minutes.' },
    }));

    // Google OAuth — redirect back to client with error instead of showing a raw 429 page
    app.use('/api/auth/google', rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 40,
      handler: (_req, res) => {
        const clientUrl = (process.env.CLIENT_URL ?? 'http://localhost:3000').split(',')[0].trim();
        res.redirect(`${clientUrl}/?error=too_many_requests`);
      },
    }));

    // Guest account creation — limit to prevent spam (successful logins don't count)
    app.use('/api/auth/guest', rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 15,
      skipSuccessfulRequests: true,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many login attempts, please wait a few minutes and try again.' },
    }));
  }

  // ── Routes ──────────────────────────────────────────────────────────────────
  app.use('/api/auth', authRoutes);
  app.use('/api/rooms', roomRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/games', gameRoutes);
  app.use('/api/wallet', walletRoutes);
  app.use('/api/survival', survivalRoutes);
  app.use('/api/tournaments', tournamentRoutes);
  app.use('/api/support', supportRoutes);
  app.use('/api/progression', progressionRoutes);
  app.use('/api/notifications', notificationRoutes);

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date() }));

  // Public: active announcements (no auth required)
  app.get('/api/announcements', async (_req, res) => {
    try {
      const now = new Date();
      const list = await Announcement.find({
        active: true,
        $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }],
      }).sort({ createdAt: -1 }).limit(5).lean();
      res.json({ announcements: list });
    } catch {
      res.status(500).json({ error: 'Failed to load announcements' });
    }
  });

  // ── Public: Email unsubscribe (linked from email footers, no auth) ───────────
  app.get('/api/email/unsubscribe/:token', async (req, res) => {
    const { token } = req.params;
    const clientUrl = (process.env.CLIENT_URL ?? 'http://localhost:3000').split(',')[0].trim();

    const unsubscribedHtml = (msg: string, isError = false) => `
      <!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Unsubscribe — Arena of Sevens</title>
      <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#0d0b1e;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}.card{background:#0f0d2a;border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:48px 40px;max-width:480px;width:100%;text-align:center}.icon{font-size:52px;margin-bottom:16px}.title{color:#f1f5f9;font-size:22px;font-weight:900;margin-bottom:10px}.msg{color:#94a3b8;font-size:15px;line-height:1.6;margin-bottom:28px}.btn{display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;font-weight:700;font-size:15px;border-radius:10px;text-decoration:none}</style>
      </head><body><div class="card">
        <div class="icon">${isError ? '⚠️' : '✅'}</div>
        <h1 class="title">${isError ? 'Something went wrong' : 'You\'ve been unsubscribed'}</h1>
        <p class="msg">${msg}</p>
        <a href="${clientUrl}" class="btn">Return to Arena of Sevens</a>
      </div></body></html>`;

    try {
      const user = await User.findOne({ unsubscribeToken: token });
      if (!user) {
        return res.status(404).send(unsubscribedHtml('This unsubscribe link is invalid or has already been used.', true));
      }
      if (user.emailUnsubscribed) {
        return res.send(unsubscribedHtml(`You're already unsubscribed. You won't receive any more emails from us.`));
      }
      user.emailUnsubscribed = true;
      user.emailUnsubscribedAt = new Date();
      await user.save();
      console.log(`[Email] ${user.username} (${user.email}) unsubscribed`);
      res.send(unsubscribedHtml(`<strong>${user.username}</strong>, you've been removed from our email list. You won't receive any more emails from Arena of Sevens.`));
    } catch (err) {
      console.error('[Unsubscribe]', err);
      res.status(500).send(unsubscribedHtml('An error occurred. Please try again later.', true));
    }
  });

  // ── Socket.IO ────────────────────────────────────────────────────────────────
  const io = new Server(httpServer, {
    cors: { origin: corsOrigin, methods: ['GET', 'POST'], credentials: true },
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  // Admin routes need io for kick/end operations — register after io is created
  app.use('/api/admin', createAdminRouter(io));

  initSocketIO(io);
  startTournamentScheduler(io);
  startReengagementScheduler();

  // ── Startup: refund games orphaned by previous crash/deployment ─────────────
  // Uses atomic claim (status: 'playing' → 'finished') to prevent double-refund
  // when two server instances start simultaneously during a rolling deployment.
  try {
    let orphanCount = 0;
    while (true) {
      // Atomically claim ONE orphaned room — only succeeds if it's still 'playing'
      const claimed = await Room.findOneAndUpdate(
        { status: 'playing' },
        { $set: { status: 'finished', matchState: 'abandoned' } },
        { new: false }, // return old doc so we have paidPlayerIds before clearing
      );
      if (!claimed) break; // no more orphaned rooms
      orphanCount++;
      const entryFee = (claimed.config as any)?.entryFee ?? 0;
      const paidIds: string[] = (claimed as any).paidPlayerIds ?? [];
      if (entryFee > 0 && paidIds.length > 0) {
        await refundAbandonedGame(claimed as any);
        console.log(`[Startup] Refunded ₹${entryFee} × ${paidIds.length} player(s) for orphaned room ${claimed.code}`);
      }
    }
    if (orphanCount > 0) console.log(`[Startup] Processed ${orphanCount} orphaned room(s)`);
  } catch (err) {
    console.error('[Startup] Orphan-room cleanup failed:', err);
  }

  // ── Start ────────────────────────────────────────────────────────────────────
  const server = httpServer.listen(PORT, () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
    console.log(`[Server] Mode: ${process.env.NODE_ENV ?? 'development'}`);
  });

  // ── Graceful shutdown: refund active games before deployment kill ─────────────
  async function gracefulShutdown(signal: string) {
    console.log(`[Server] ${signal} received — refunding active games before shutdown`);
    try {
      const activeInfos = getAllActiveRoomInfos();
      for (const info of activeInfos) {
        // Atomic claim — if another instance already claimed it, skip
        const claimed = await Room.findOneAndUpdate(
          { code: info.roomCode, status: 'playing' },
          { $set: { status: 'finished', matchState: 'abandoned' } },
          { new: false },
        );
        if (!claimed) continue;
        const entryFee = (claimed.config as any)?.entryFee ?? 0;
        const paidIds: string[] = (claimed as any).paidPlayerIds ?? [];
        if (entryFee > 0 && paidIds.length > 0) {
          await refundAbandonedGame(claimed as any);
          console.log(`[Shutdown] Refunded ₹${entryFee} × ${paidIds.length} player(s) for room ${info.roomCode}`);
        }
      }
    } catch (err) {
      console.error('[Shutdown] Refund error:', err);
    }
    server.close(() => process.exit(0));
    // Force exit after 10 s if connections hang
    setTimeout(() => process.exit(0), 10_000).unref();
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('[Server] Failed to start:', err?.message ?? err);
  if (err?.message?.includes('MONGODB') || err?.message?.includes('mongo') || err?.message?.includes('connect')) {
    console.error('[Server] → Check your MONGODB_URI environment variable in Render');
  }
  process.exit(1);
});
