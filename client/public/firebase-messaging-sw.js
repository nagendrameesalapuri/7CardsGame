// Firebase Cloud Messaging Service Worker
// Handles push notifications when the app is closed / backgrounded.
// This file must be at the root (/) so it has the correct scope.

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// Firebase config is injected at runtime via a dedicated endpoint to avoid
// baking secrets into the SW file. The config is fetched once and cached.
let messagingInstance = null;

async function getFirebaseConfig() {
  try {
    const cached = await caches.open('fcm-config-v1');
    const cachedResp = await cached.match('/__fcm_config');
    if (cachedResp) return cachedResp.json();

    // Try to fetch from backend (only works if SW is active and server is up)
    const resp = await fetch('/api/notifications/config');
    if (resp.ok) {
      const clone = resp.clone();
      await cached.put('/__fcm_config', clone);
      return resp.json();
    }
  } catch { /* offline or not configured */ }
  return null;
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Background push handler (FCM compat SDK handles this automatically once
// firebase.initializeApp() is called, but we also handle raw push events
// for fallback.)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try { payload = event.data.json(); } catch { return; }

  const notification = payload.notification ?? {};
  const data         = payload.data ?? {};

  const title   = notification.title ?? data.title ?? 'Arena of Sevens';
  const body    = notification.body  ?? data.body  ?? '';
  const icon    = '/pwa-icon.svg';
  const badge   = '/pwa-icon.svg';
  const tag     = data.category ?? 'arena';
  const actionUrl = data.actionUrl ?? '/';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag,
      renotify: true,
      data: { actionUrl },
    })
  );
});

// Notification click → open the deep-link URL
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const actionUrl = event.notification.data?.actionUrl ?? '/';
  const targetUrl = new URL(actionUrl, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});

// Initialise Firebase Messaging (compat SDK) once config is available
(async () => {
  const cfg = await getFirebaseConfig();
  if (!cfg?.apiKey) return; // Firebase not configured — push disabled

  try {
    firebase.initializeApp(cfg);
    messagingInstance = firebase.messaging();

    // Background message handler
    messagingInstance.onBackgroundMessage((payload) => {
      const n = payload.notification ?? {};
      const d = payload.data ?? {};

      self.registration.showNotification(n.title ?? 'Arena of Sevens', {
        body:      n.body ?? '',
        icon:      '/pwa-icon.svg',
        badge:     '/pwa-icon.svg',
        tag:       d.category ?? 'arena',
        renotify:  true,
        data:      { actionUrl: d.actionUrl ?? '/' },
      });
    });
  } catch (err) {
    console.warn('[FCM SW] Firebase init failed:', err);
  }
})();
