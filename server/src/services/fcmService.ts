/**
 * FCM Service — Firebase Cloud Messaging via firebase-admin.
 *
 * Gracefully degrades when FIREBASE_* env vars are not set (dev / staging
 * without a Firebase project) so the server starts without crashing.
 */

import { NotificationToken }      from '../models/NotificationToken';
import { Notification }            from '../models/Notification';
import { NotificationPreference }  from '../models/NotificationPreference';
import { NotificationBroadcast }   from '../models/NotificationBroadcast';
import { User }                    from '../models/User';
import type { NotificationCategory } from '../models/Notification';

// ── Cooldown map: minimum gap between notifications per user per category ──────
const COOLDOWN_HOURS: Record<NotificationCategory | 'default', number> = {
  tournament:      1,
  boss_arena:      1,
  rewards:         0,   // reward confirmations are always sent immediately
  daily_missions:  20,  // once per day-ish
  survival_streak: 3,
  multiplayer:     0.5,
  events:          6,
  system:          0,
  default:         2,
};

// ── Lazy-init Firebase Admin ───────────────────────────────────────────────────
let messagingInstance: import('firebase-admin/messaging').Messaging | null = null;

function getMessaging() {
  if (messagingInstance) return messagingInstance;

  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.warn('[FCM] Firebase env vars missing — push notifications disabled.');
    return null;
  }

  try {
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      });
    }
    messagingInstance = admin.messaging();
    console.log('[FCM] Firebase Admin initialised ✓');
    return messagingInstance;
  } catch (err) {
    console.error('[FCM] Failed to init Firebase Admin:', err);
    return null;
  }
}

// ── Throttle check ─────────────────────────────────────────────────────────────
async function isThrottled(userId: string, category: NotificationCategory): Promise<boolean> {
  try {
    const prefs = await NotificationPreference.findOne({ userId });
    if (!prefs) return false;

    // Check category preference enabled
    if (prefs[category] === false) return true;

    const lastSentMap = prefs.lastSent as unknown as Record<string, string>;
    const lastSentStr = lastSentMap?.[category];
    if (!lastSentStr) return false;

    const cooldownHours = COOLDOWN_HOURS[category] ?? COOLDOWN_HOURS.default;
    if (cooldownHours === 0) return false;

    const lastSent = new Date(lastSentStr);
    const diffHours = (Date.now() - lastSent.getTime()) / (1000 * 60 * 60);
    return diffHours < cooldownHours;
  } catch {
    return false;
  }
}

async function updateLastSent(userId: string, category: NotificationCategory) {
  try {
    await NotificationPreference.findOneAndUpdate(
      { userId },
      { $set: { [`lastSent.${category}`]: new Date().toISOString() } },
      { upsert: true }
    );
  } catch { /* non-critical */ }
}

// ── Core send function ─────────────────────────────────────────────────────────
export interface SendNotificationOpts {
  userId: string;
  title: string;
  message: string;
  category: NotificationCategory;
  type?: 'info' | 'warning' | 'success';
  actionUrl?: string;
  /** Skip throttle check (e.g. for reward confirmations) */
  skipThrottle?: boolean;
  /** Data payload passed through to the SW / app */
  data?: Record<string, string>;
  /** Links this notification to a broadcast record for delivery tracking */
  broadcastId?: string;
}

export async function sendNotification(opts: SendNotificationOpts): Promise<void> {
  const { userId, title, message, category, type = 'info', actionUrl, skipThrottle, data, broadcastId } = opts;

  try {
    // Throttle
    if (!skipThrottle && await isThrottled(userId, category)) return;

    // Persist to DB (in-app notification center)
    const stored = await Notification.create({
      userId, title, message, category, type, actionUrl,
      read: false, sentViaFCM: false,
      ...(broadcastId ? { broadcastId } : {}),
    });

    await updateLastSent(userId, category);

    // FCM push (best-effort — failure never prevents in-app notification)
    const messaging = getMessaging();
    if (!messaging) {
      console.warn('[FCM] Skipping push for user', userId, '— Firebase Admin not initialised');
      return;
    }

    const tokens = await NotificationToken.find({ userId }).select('fcmToken').lean();
    if (!tokens.length) {
      console.log(`[FCM] No FCM tokens for user ${userId} — push skipped (in-app only)`);
      return;
    }

    const fcmTokens = tokens.map(t => t.fcmToken);

    // All data values MUST be strings for FCM V1 API
    const dataPayload: Record<string, string> = {
      notificationId: stored._id.toString(),
      category,
      actionUrl:      actionUrl ?? '/',
      type,
      ...(data ?? {}),
    };

    const payload = {
      notification: { title, body: message },
      data: dataPayload,
      webpush: {
        notification: {
          title,
          body:     message,
          icon:     '/pwa-icon.svg',
          badge:    '/pwa-icon.svg',
          tag:      category,
          renotify: true,
        },
        data: dataPayload, // accessible in SW via payload.data
        fcmOptions: { link: actionUrl ?? '/' },
      },
    };

    // Send to each token; collect invalid ones for cleanup
    const invalidTokens: string[] = [];
    let fcmSent = false;
    await Promise.allSettled(
      fcmTokens.map(async (token) => {
        try {
          await (messaging as any).send({ ...payload, token });
          fcmSent = true;
        } catch (err: any) {
          const code = err?.errorInfo?.code ?? err?.code ?? '';
          if (
            code === 'messaging/invalid-registration-token' ||
            code === 'messaging/registration-token-not-registered'
          ) {
            invalidTokens.push(token);
          } else {
            console.error('[FCM] Send error for user', userId, ':', code || err?.message || err);
          }
        }
      })
    );

    if (fcmSent) {
      await Notification.findByIdAndUpdate(stored._id, { sentViaFCM: true });
      if (broadcastId) {
        await NotificationBroadcast.findByIdAndUpdate(broadcastId, { $inc: { deliveredCount: 1 } });
      }
    }

    // Prune stale tokens
    if (invalidTokens.length) {
      console.log('[FCM] Pruning', invalidTokens.length, 'stale token(s) for user', userId);
      await NotificationToken.deleteMany({ fcmToken: { $in: invalidTokens } });
    }
  } catch (err) {
    console.error('[FCM] sendNotification error:', err);
  }
}

// ── Broadcast to multiple users ────────────────────────────────────────────────
export async function sendBulkNotification(
  userIds: string[],
  opts: Omit<SendNotificationOpts, 'userId'>
): Promise<{ intendedCount: number }> {
  await Promise.allSettled(userIds.map(uid => sendNotification({ ...opts, userId: uid })));
  return { intendedCount: userIds.length };
}

// ── Send to all users (global broadcast) ──────────────────────────────────────
// Targets every user in the database so in-app notifications always appear,
// even for users who have not yet registered an FCM token.
export async function sendGlobalNotification(
  opts: Omit<SendNotificationOpts, 'userId'>
): Promise<{ intendedCount: number }> {
  try {
    const users = await User.find({}, '_id').lean();
    const userIds = users.map((u: any) => String(u._id));
    console.log('[FCM] sendGlobalNotification → targeting', userIds.length, 'users');
    await sendBulkNotification(userIds, opts);
    return { intendedCount: userIds.length };
  } catch (err) {
    console.error('[FCM] sendGlobalNotification error:', err);
    return { intendedCount: 0 };
  }
}

// ── Send to inactive users ─────────────────────────────────────────────────────
export async function sendInactivityNotifications(inactiveHours = 24): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - inactiveHours * 60 * 60 * 1000);
    const staleTokens = await NotificationToken.find({
      lastActiveAt: { $lt: cutoff },
    }).select('userId').lean();

    const uniqueUserIds = [...new Set(staleTokens.map(t => t.userId))];

    const messages = [
      { title: '🔥 Your survival streak is waiting', message: 'Return to the Arena and continue your climb.' },
      { title: '⚔ The Arena calls', message: 'Your opponents are ready. Come back and Master the SHOW.' },
      { title: '🧠 Unfinished business', message: 'The AI challengers are waiting for a rematch.' },
    ];

    for (const userId of uniqueUserIds) {
      const pick = messages[Math.floor(Math.random() * messages.length)];
      await sendNotification({
        userId,
        title: pick.title,
        message: pick.message,
        category: 'survival_streak',
        type: 'warning',
        actionUrl: '/lobby',
      });
    }
  } catch (err) {
    console.error('[FCM] sendInactivityNotifications error:', err);
  }
}
