/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();

// Workbox injects the precache manifest here at build time
precacheAndRoute((self as any).__WB_MANIFEST || []);
cleanupOutdatedCaches();

// ── Firebase state ─────────────────────────────────────────────────────────────
const CACHE_NAME = 'fcm-config-v1';
const CACHE_KEY  = '/__fcm_config';
let messagingReady = false;

function showPush(n: Record<string, string>, d: Record<string, string>) {
  const title     = n.title  ?? 'Arena of Sevens';
  const body      = n.body   ?? '';
  const actionUrl = d.actionUrl ?? '/';
  return self.registration.showNotification(title, {
    body,
    icon:     '/pwa-icon.svg',
    badge:    '/pwa-icon.svg',
    tag:      d.category ?? 'arena',
    data:     { actionUrl },
  } as NotificationOptions);
}

async function initFirebase(cfg: Record<string, string>) {
  if (messagingReady || !cfg?.apiKey) return;
  try {
    const app = getApps().length ? getApps()[0] : initializeApp(cfg);
    const msg = getMessaging(app);
    onBackgroundMessage(msg, (payload) => {
      const n = (payload.notification ?? {}) as Record<string, string>;
      const d = (payload.data        ?? {}) as Record<string, string>;
      showPush(n, d);
    });
    messagingReady = true;
  } catch (err) {
    console.warn('[SW] Firebase init failed:', err);
  }
}

// ── Config handoff from main thread ───────────────────────────────────────────
// fcm.ts posts FCM_CONFIG right after Firebase initialises in the browser.
// We persist it to Cache API so it survives SW restarts when the app is closed.
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'FCM_CONFIG') return;
  const cfg = event.data.config as Record<string, string>;
  caches.open(CACHE_NAME).then((cache) =>
    cache.put(CACHE_KEY, new Response(JSON.stringify(cfg), {
      headers: { 'Content-Type': 'application/json' },
    }))
  );
  initFirebase(cfg);
});

// ── Raw push fallback ─────────────────────────────────────────────────────────
// Used before Firebase SDK initialises (e.g. very first push, cold SW start
// before cached config is loaded). onBackgroundMessage takes over once ready.
self.addEventListener('push', (event) => {
  if (!event.data || messagingReady) return;
  let payload: { notification?: Record<string, string>; data?: Record<string, string> };
  try { payload = event.data.json(); } catch { return; }
  event.waitUntil(showPush(payload.notification ?? {}, payload.data ?? {}));
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const actionUrl = (event.notification.data?.actionUrl as string) ?? '/';
  const target    = new URL(actionUrl, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          (client as WindowClient).postMessage({ type: 'NOTIFICATION_CLICK', actionUrl });
          return (client as WindowClient).focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});

// ── Load cached config on cold SW start ───────────────────────────────────────
// When a push arrives while the app is closed, the SW restarts from scratch.
// Reading the cached config lets Firebase initialise before the push is handled.
caches.open(CACHE_NAME)
  .then((c) => c.match(CACHE_KEY))
  .then((r) => r?.json() as Promise<Record<string, string>> | undefined)
  .then((cfg) => { if (cfg) initFirebase(cfg); })
  .catch(() => {});
