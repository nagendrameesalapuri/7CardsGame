/**
 * Firebase Cloud Messaging — client-side token management.
 *
 * Gracefully degrades when VITE_FIREBASE_* env vars are not set or when the
 * user denies notification permission. The rest of the app is unaffected.
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getMessaging,
  getToken,
  onMessage,
  type Messaging,
} from 'firebase/messaging';
import api from './api';

const FIREBASE_CONFIG = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

let firebaseApp: FirebaseApp | null = null;
let messaging: Messaging | null = null;
let currentToken: string | null = null;

function isConfigured(): boolean {
  return !!(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);
}

function initFirebase(): FirebaseApp | null {
  if (!isConfigured()) return null;
  if (firebaseApp) return firebaseApp;

  try {
    firebaseApp = getApps().length
      ? getApps()[0]
      : initializeApp(FIREBASE_CONFIG);
    return firebaseApp;
  } catch (err) {
    console.warn('[FCM] Firebase init failed:', err);
    return null;
  }
}

// Returns the active Workbox SW registration (registered by vite-plugin-pwa).
// The SW handles push events via a raw listener — no Firebase SDK needed there.
async function getActiveSW(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.ready;
  } catch (err) {
    console.warn('[FCM] Could not reach active SW:', err);
    return null;
  }
}

// ── Main: request permission + get token ──────────────────────────────────────

export async function initFCM(
  onForegroundMessage: (payload: { title: string; message: string; category: string; actionUrl?: string }) => void
): Promise<string | null> {
  if (!isConfigured()) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const app = initFirebase();
    if (!app) return null;

    messaging = getMessaging(app);

    const swReg = await getActiveSW();

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg ?? undefined,
    });

    if (!token) return null;
    currentToken = token;

    // Register token with server
    await api.post('/notifications/token', {
      fcmToken: token,
      deviceType: detectDeviceType(),
    });

    // Foreground message handler — app is open and focused
    onMessage(messaging, (payload) => {
      const n = payload.notification ?? {};
      const d = (payload.data ?? {}) as Record<string, string>;
      onForegroundMessage({
        title:     n.title ?? 'Arena of Sevens',
        message:   n.body  ?? '',
        category:  d.category ?? 'system',
        actionUrl: d.actionUrl,
      });
    });

    return token;
  } catch (err) {
    console.warn('[FCM] initFCM error:', err);
    return null;
  }
}

// ── Token cleanup on logout ────────────────────────────────────────────────────

export async function removeFCMToken(): Promise<void> {
  try {
    if (currentToken) {
      await api.delete('/notifications/token', { data: { fcmToken: currentToken } });
      currentToken = null;
    }
  } catch { /* silent */ }
}

// ── Ping last-active (call on login / app resume) ─────────────────────────────

export async function pingFCMToken(): Promise<void> {
  try {
    if (currentToken) {
      await api.patch('/notifications/token/ping', { fcmToken: currentToken });
    }
  } catch { /* silent */ }
}

// ── Notification permission state ─────────────────────────────────────────────

export function getPermissionState(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function requestPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.requestPermission();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function detectDeviceType(): 'web' | 'android' | 'ios' {
  const ua = navigator.userAgent.toLowerCase();
  if (/android/.test(ua)) return 'android';
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  return 'web';
}

export { isConfigured };
