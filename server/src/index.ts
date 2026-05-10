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

const PORT = parseInt(process.env.PORT ?? '5000', 10);
const CLIENT_URL = process.env.CLIENT_URL ?? 'http://localhost:3000';

async function bootstrap() {
  await connectDatabase();

  const app = express();
  const httpServer = createServer(app);

  // ── Middleware ──────────────────────────────────────────────────────────────
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: CLIENT_URL, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  app.use(
    session({
      secret: process.env.SESSION_SECRET ?? 'dev-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());
  configurePassport();

  // Rate limiting
  app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
  app.use('/api/auth/', rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }));

  // ── Routes ──────────────────────────────────────────────────────────────────
  app.use('/api/auth', authRoutes);
  app.use('/api/rooms', roomRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/games', gameRoutes);

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date() }));

  // ── Socket.IO ────────────────────────────────────────────────────────────────
  const io = new Server(httpServer, {
    cors: { origin: CLIENT_URL, methods: ['GET', 'POST'], credentials: true },
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  initSocketIO(io);

  // ── Start ────────────────────────────────────────────────────────────────────
  httpServer.listen(PORT, () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
    console.log(`[Server] Mode: ${process.env.NODE_ENV ?? 'development'}`);
  });
}

bootstrap().catch((err) => {
  console.error('[Server] Failed to start:', err);
  process.exit(1);
});
