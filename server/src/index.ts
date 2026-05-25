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
import progressionRoutes from './routes/progression';
import notificationRoutes from './routes/notifications';

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

  // ── Socket.IO ────────────────────────────────────────────────────────────────
  const io = new Server(httpServer, {
    cors: { origin: corsOrigin, methods: ['GET', 'POST'], credentials: true },
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  // Admin routes need io for kick/end operations — register after io is created
  app.use('/api/admin', createAdminRouter(io));

  initSocketIO(io);

  // ── Startup: refund any games orphaned by previous crash/deployment ──────────
  try {
    const orphanedRooms = await Room.find({ status: 'playing' }).lean();
    if (orphanedRooms.length > 0) {
      console.log(`[Startup] Found ${orphanedRooms.length} orphaned room(s) from previous crash — refunding entry fees`);
      for (const room of orphanedRooms) {
        const entryFee = (room.config as any)?.entryFee ?? 0;
        const paidIds: string[] = (room as any).paidPlayerIds ?? [];
        if (entryFee > 0 && paidIds.length > 0) {
          await refundAbandonedGame(room as any);
          console.log(`[Startup] Refunded ₹${entryFee} to ${paidIds.length} player(s) for orphaned room ${room.code}`);
        }
        await Room.findByIdAndUpdate((room as any)._id, { status: 'finished' });
      }
    }
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
        const room = await Room.findOne({ code: info.roomCode }).lean();
        if (!room) continue;
        const entryFee = (room.config as any)?.entryFee ?? 0;
        const paidIds: string[] = (room as any).paidPlayerIds ?? [];
        if (entryFee > 0 && paidIds.length > 0) {
          await refundAbandonedGame(room as any);
          console.log(`[Shutdown] Refunded ₹${entryFee} × ${paidIds.length} player(s) for room ${info.roomCode}`);
        }
        await Room.findOneAndUpdate({ code: info.roomCode }, { status: 'finished' });
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
