import { Router, Request, Response } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

function generateToken(userId: string): string {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  } as jwt.SignOptions);
}

// ── Google OAuth ───────────────────────────────────────────────────────────────

const googleConfigured = !!(
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_ID !== 'your-google-client-id' &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.GOOGLE_CLIENT_SECRET !== 'your-google-client-secret'
);

router.get('/google', (req: Request, res: Response, next) => {
  if (!googleConfigured) {
    const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:3000';
    return res.redirect(`${clientUrl}/?error=google_not_configured`);
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

router.get(
  '/google/callback',
  (req: Request, res: Response, next) => {
    if (!googleConfigured) return res.redirect('/');
    passport.authenticate('google', {
      session: false,
      failureRedirect: `${process.env.CLIENT_URL}/login?error=auth_failed`,
    })(req, res, next);
  },
  (req: Request, res: Response) => {
    const user = req.user as any;
    const token = generateToken(user.id);
    res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}`);
  }
);

// ── Guest Login ────────────────────────────────────────────────────────────────

router.post('/guest', async (req: Request, res: Response) => {
  try {
    const { username } = req.body as { username?: string };
    if (!username || username.trim().length < 2) {
      return res.status(400).json({ error: 'Username must be at least 2 characters' });
    }

    const guestToken = uuidv4();
    const user = await User.create({
      username: username.trim().slice(0, 20),
      avatar: `avatar_${Math.floor(Math.random() * 8) + 1}`,
      isGuest: true,
      guestToken,
    });

    const token = generateToken(user.id);
    res.json({
      token,
      guestToken,
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        isGuest: true,
      },
    });
  } catch (err) {
    console.error('[Guest Login Error]', err);
    res.status(500).json({ error: 'Failed to create guest account' });
  }
});

// ── Get current user ──────────────────────────────────────────────────────────

router.get('/me', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    const user = await User.findById(decoded.userId).select('-guestToken');
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ user: { id: user.id, ...user.toJSON() } });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// ── Logout ────────────────────────────────────────────────────────────────────

router.post('/logout', (_req: Request, res: Response) => {
  res.json({ message: 'Logged out' });
});

// ── Test Login (development only) ─────────────────────────────────────────────
// Used by Playwright tests to bypass Google OAuth.
// NEVER active in production.

if (process.env.NODE_ENV === 'development') {
  router.post('/test-login', async (req: Request, res: Response) => {
    try {
      const username = (req.body as any).username ?? 'PlaywrightUser';
      const email    = (req.body as any).email    ?? 'playwright@test.local';

      let user = await User.findOne({ email });
      if (!user) {
        user = await User.create({
          username: username.slice(0, 20),
          email,
          avatar: 'avatar_1',
          isGuest: false,
        });
      }

      const token = generateToken(user.id);
      res.json({
        token,
        user: {
          id:       user.id,
          username: user.username,
          avatar:   user.avatar,
          email:    user.email,
          isGuest:  false,
        },
      });
    } catch (err) {
      console.error('[Test Login Error]', err);
      res.status(500).json({ error: 'Test login failed' });
    }
  });
}

export default router;
