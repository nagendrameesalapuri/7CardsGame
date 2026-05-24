import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { NotificationToken }      from '../models/NotificationToken';
import { Notification }            from '../models/Notification';
import { NotificationPreference }  from '../models/NotificationPreference';
import { NotificationBroadcast }   from '../models/NotificationBroadcast';
import {
  sendNotification,
  sendBulkNotification,
  sendGlobalNotification,
  sendInactivityNotifications,
} from '../services/fcmService';
import type { NotificationCategory } from '../models/Notification';

const router = Router();

// ── Public Firebase config (VAPID + client-side keys only) ────────────────────
// The SW fetches this at startup so we never bake keys into the SW file.
router.get('/config', (_req: Request, res: Response) => {
  const cfg = {
    apiKey:            process.env.VITE_FIREBASE_API_KEY            ?? null,
    authDomain:        process.env.VITE_FIREBASE_AUTH_DOMAIN        ?? null,
    projectId:         process.env.VITE_FIREBASE_PROJECT_ID         ?? null,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? null,
    appId:             process.env.VITE_FIREBASE_APP_ID             ?? null,
  };
  // Only return config if Firebase is actually configured
  if (!cfg.apiKey) return res.json({});
  res.json(cfg);
});

// ── Token Registration ─────────────────────────────────────────────────────────

// POST /api/notifications/token  — register or refresh FCM token
router.post('/token', requireAuth, async (req: Request, res: Response) => {
  try {
    const { fcmToken, deviceType = 'web' } = req.body as { fcmToken: string; deviceType?: string };
    if (!fcmToken) return res.status(400).json({ error: 'fcmToken required' });

    await NotificationToken.findOneAndUpdate(
      { fcmToken },
      {
        userId: req.user!.id,
        fcmToken,
        deviceType,
        userAgent: req.headers['user-agent'],
        lastActiveAt: new Date(),
      },
      { upsert: true, new: true }
    );

    // Ensure preference doc exists for this user
    await NotificationPreference.findOneAndUpdate(
      { userId: req.user!.id },
      { $setOnInsert: { userId: req.user!.id } },
      { upsert: true }
    );

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to register token' });
  }
});

// DELETE /api/notifications/token  — remove token on logout
router.delete('/token', requireAuth, async (req: Request, res: Response) => {
  try {
    const { fcmToken } = req.body as { fcmToken?: string };
    if (fcmToken) {
      await NotificationToken.deleteOne({ fcmToken, userId: req.user!.id });
    } else {
      // Remove all tokens for this user (full logout)
      await NotificationToken.deleteMany({ userId: req.user!.id });
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to remove token' });
  }
});

// Update last-active timestamp (called on login / app resume)
router.patch('/token/ping', requireAuth, async (req: Request, res: Response) => {
  try {
    const { fcmToken } = req.body as { fcmToken?: string };
    if (fcmToken) {
      await NotificationToken.updateOne({ fcmToken }, { lastActiveAt: new Date() });
    } else {
      await NotificationToken.updateMany({ userId: req.user!.id }, { lastActiveAt: new Date() });
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to ping token' });
  }
});

// ── Notification History ───────────────────────────────────────────────────────

// GET /api/notifications  — paginated history for current user
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const page  = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
    const limit = Math.min(50, parseInt(String(req.query.limit ?? '20'), 10));

    const [notifications, total, unread] = await Promise.all([
      Notification.find({ userId: req.user!.id })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Notification.countDocuments({ userId: req.user!.id }),
      Notification.countDocuments({ userId: req.user!.id, read: false }),
    ]);

    res.json({ notifications, total, unread, page, pages: Math.ceil(total / limit) });
  } catch {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// PATCH /api/notifications/read  — mark all as read
router.patch('/read', requireAuth, async (req: Request, res: Response) => {
  try {
    // Collect unread notifications with broadcastIds before marking read
    const unreadWithBroadcast = await Notification.find(
      { userId: req.user!.id, read: false, broadcastId: { $exists: true } },
      'broadcastId'
    ).lean();

    // Increment readCount per broadcast
    const broadcastCounts: Record<string, number> = {};
    for (const n of unreadWithBroadcast) {
      if (n.broadcastId) broadcastCounts[n.broadcastId] = (broadcastCounts[n.broadcastId] || 0) + 1;
    }
    await Promise.allSettled(
      Object.entries(broadcastCounts).map(([id, count]) =>
        NotificationBroadcast.findByIdAndUpdate(id, { $inc: { readCount: count } })
      )
    );

    await Notification.updateMany({ userId: req.user!.id, read: false }, { read: true });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to mark read' });
  }
});

// PATCH /api/notifications/:id/read  — mark single as read
router.patch('/:id/read', requireAuth, async (req: Request, res: Response) => {
  try {
    // Find unread first so we can update readCount before marking read
    const notif = await Notification.findOne(
      { _id: req.params.id, userId: req.user!.id, read: false }
    ).lean();

    await Notification.updateOne({ _id: req.params.id, userId: req.user!.id }, { read: true });

    if (notif?.broadcastId) {
      await NotificationBroadcast.findByIdAndUpdate(notif.broadcastId, { $inc: { readCount: 1 } });
    }

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to mark read' });
  }
});

// DELETE /api/notifications  — clear all for current user
router.delete('/', requireAuth, async (req: Request, res: Response) => {
  try {
    await Notification.deleteMany({ userId: req.user!.id });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
});

// ── Preferences ───────────────────────────────────────────────────────────────

// GET /api/notifications/preferences
router.get('/preferences', requireAuth, async (req: Request, res: Response) => {
  try {
    let prefs = await NotificationPreference.findOne({ userId: req.user!.id });
    if (!prefs) {
      prefs = await NotificationPreference.create({ userId: req.user!.id });
    }
    res.json({ preferences: prefs });
  } catch {
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

// PATCH /api/notifications/preferences
router.patch('/preferences', requireAuth, async (req: Request, res: Response) => {
  try {
    const allowed: (keyof typeof req.body)[] = [
      'tournament', 'boss_arena', 'rewards', 'daily_missions',
      'survival_streak', 'multiplayer', 'events', 'system',
    ];
    const updates: Record<string, boolean> = {};
    for (const key of allowed) {
      const val = req.body[key as string];
      if (typeof val === 'boolean') updates[key as string] = val;
    }

    const prefs = await NotificationPreference.findOneAndUpdate(
      { userId: req.user!.id },
      { $set: updates },
      { upsert: true, new: true }
    );
    res.json({ preferences: prefs });
  } catch {
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// ── Admin: Send targeted notifications ────────────────────────────────────────
// These endpoints require the x-admin-key header (same as admin route auth)

function adminOnly(req: Request, res: Response, next: () => void) {
  const secret = process.env.ADMIN_SECRET;
  const key    = req.headers['x-admin-key'];
  if (!secret || key !== secret) return res.status(403).json({ error: 'Forbidden' });
  next();
}

// POST /api/notifications/admin/send  — send to one or more users
router.post('/admin/send', adminOnly as any, async (req: Request, res: Response) => {
  try {
    const {
      userIds,
      title, message, category = 'system', type = 'info', actionUrl,
      global: isGlobal,
      inactiveHours,
    } = req.body as {
      userIds?: string[];
      title: string;
      message: string;
      category?: NotificationCategory;
      type?: 'info' | 'warning' | 'success';
      actionUrl?: string;
      global?: boolean;
      inactiveHours?: number;
    };

    if (!title || !message) return res.status(400).json({ error: 'title and message required' });

    if (isGlobal) {
      await sendGlobalNotification({ title, message, category, type, actionUrl, skipThrottle: true });
    } else if (inactiveHours) {
      await sendInactivityNotifications(inactiveHours);
    } else if (userIds?.length) {
      await sendBulkNotification(userIds, { title, message, category, type, actionUrl, skipThrottle: true });
    } else {
      return res.status(400).json({ error: 'Provide userIds, global:true, or inactiveHours' });
    }

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to send notifications' });
  }
});

// GET /api/notifications/admin/users — list users with FCM tokens (for targeting)
router.get('/admin/users', adminOnly as any, async (req: Request, res: Response) => {
  try {
    const tokens = await NotificationToken.find().select('userId deviceType lastActiveAt').lean();
    const userMap: Record<string, { deviceCount: number; lastActiveAt: Date; devices: string[] }> = {};
    for (const t of tokens) {
      if (!userMap[t.userId]) userMap[t.userId] = { deviceCount: 0, lastActiveAt: t.lastActiveAt, devices: [] };
      userMap[t.userId].deviceCount++;
      userMap[t.userId].devices.push(t.deviceType);
      if (t.lastActiveAt > userMap[t.userId].lastActiveAt) userMap[t.userId].lastActiveAt = t.lastActiveAt;
    }
    res.json({ users: userMap, total: Object.keys(userMap).length });
  } catch {
    res.status(500).json({ error: 'Failed to list token users' });
  }
});

export default router;
