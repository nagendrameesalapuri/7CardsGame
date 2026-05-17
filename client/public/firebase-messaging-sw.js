// Firebase Cloud Messaging Service Worker
// Handles push notifications when the app is closed / backgrounded.

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

const CACHE_NAME = 'fcm-config-v1';
const CACHE_KEY  = '/__fcm_config';

let messagingReady = false;

// ── Read config from Cache API (written by main thread) ───────────────────────
async function getFirebaseConfig() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const resp  = await cache.match(CACHE_KEY);
    if (resp) return resp.json();
  } catch { /* ignore */ }
  return null;
}

// ── Init Firebase once config is available ────────────────────────────────────
async function initFirebase(cfg) {
  if (messagingReady || !cfg?.apiKey) return;
  try {
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    const msg = firebase.messaging();
    msg.onBackgroundMessage((payload) => {
      showPush(payload.notification ?? {}, payload.data ?? {});
    });
    messagingReady = true;
  } catch (err) {
    console.warn('[FCM SW] Firebase init failed:', err);
  }
}

// ── Show native OS notification ────────────────────────────────────────────────
function showPush(n, d) {
  const title     = n.title ?? d.title ?? 'Arena of Sevens';
  const body      = n.body  ?? d.body  ?? '';
  const actionUrl = d.actionUrl ?? '/';
  return self.registration.showNotification(title, {
    body,
    icon:     '/pwa-icon.svg',
    badge:    '/pwa-icon.svg',
    tag:      d.category ?? 'arena',
    renotify: true,
    data:     { actionUrl },
  });
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ── Receive config posted from main thread (fcm.ts) ───────────────────────────
// Called when the app is open and Firebase initialises successfully.
// The config is also stored in Cache API so future background pushes work.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'FCM_CONFIG') {
    const cfg = event.data.config;
    // Persist to cache so SW can read it when app is closed
    caches.open(CACHE_NAME).then((cache) => {
      cache.put(CACHE_KEY, new Response(JSON.stringify(cfg), {
        headers: { 'Content-Type': 'application/json' },
      }));
    });
    initFirebase(cfg);
  }
});

// ── Raw push fallback (works even before Firebase SDK initialises) ─────────────
// FCM delivers push data here; Firebase SDK may also intercept via
// onBackgroundMessage — whichever fires first wins (tag deduplicates them).
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); } catch { return; }
  event.waitUntil(showPush(payload.notification ?? {}, payload.data ?? {}));
});

// ── Notification click → open deep-link ───────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const actionUrl = event.notification.data?.actionUrl ?? '/';
  const targetUrl = new URL(actionUrl, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICK', actionUrl });
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});

// ── Try to init Firebase from cached config on SW startup ─────────────────────
// Handles the case where the app was previously open (config cached) but is
// now closed when a push arrives.
getFirebaseConfig().then(initFirebase);
