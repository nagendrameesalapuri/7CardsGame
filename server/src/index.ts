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
import { configurePassport } from './config/passport';
import { initSocketIO } from './socket';

import authRoutes from './routes/auth';
import roomRoutes from './routes/rooms';
import userRoutes from './routes/users';
import gameRoutes from './routes/games';
import walletRoutes from './routes/wallet';
import tournamentRoutes from './routes/tournaments';
import supportRoutes from './routes/support';
import createAdminRouter from './routes/admin';

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
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: corsOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

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
  app.use('/api/tournaments', tournamentRoutes);
  app.use('/api/support', supportRoutes);

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date() }));

  // ── Socket.IO ────────────────────────────────────────────────────────────────
  const io = new Server(httpServer, {
    cors: { origin: corsOrigin, methods: ['GET', 'POST'], credentials: true },
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  // Admin routes need io for kick/end operations — register after io is created
  app.use('/api/admin', createAdminRouter(io));

  initSocketIO(io);

  // ── Start ────────────────────────────────────────────────────────────────────
  httpServer.listen(PORT, () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
    console.log(`[Server] Mode: ${process.env.NODE_ENV ?? 'development'}`);
  });
}

bootstrap().catch((err) => {
  console.error('[Server] Failed to start:', err?.message ?? err);
  if (err?.message?.includes('MONGODB') || err?.message?.includes('mongo') || err?.message?.includes('connect')) {
    console.error('[Server] → Check your MONGODB_URI environment variable in Render');
  }
  process.exit(1);
});
