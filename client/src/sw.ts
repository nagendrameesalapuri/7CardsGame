/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();

// Workbox injects the precache manifest here at build time
precacheAndRoute((self as any).__WB_MANIFEST || []);
cleanupOutdatedCaches();

// ── Push notification handler ─────────────────────────────────────────────────
// Firebase's getToken() in the main thread creates the push subscription.
// The SW just needs to receive the push event and show the notification.
// No Firebase SDK needed here — raw push handling is simpler and more reliable.
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload: {
    notification?: { title?: string; body?: string };
    data?: Record<string, string>;
  };

  try {
    payload = event.data.json();
  } catch {
    // Fallback: treat raw text as the body
    payload = { notification: { title: 'Arena of Sevens', body: event.data.text() } };
  }

  const n          = payload.notification ?? {};
  const d          = payload.data         ?? {};
  const title      = n.title    ?? d.title    ?? 'Arena of Sevens';
  const body       = n.body     ?? d.body     ?? '';
  const tag        = d.category ?? 'arena';
  const actionUrl  = d.actionUrl ?? '/';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:  '/pwa-icon.svg',
      badge: '/pwa-icon.svg',
      tag,
      data:  { actionUrl },
    } as NotificationOptions)
  );
});

// ── Notification click → open deep link ──────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const actionUrl = (event.notification.data?.actionUrl as string | undefined) ?? '/';
  const targetUrl = new URL(actionUrl, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        // Focus an existing window if possible
        for (const client of clients) {
          if ('focus' in client) {
            (client as WindowClient).postMessage({ type: 'NOTIFICATION_CLICK', actionUrl });
            return (client as WindowClient).focus();
          }
        }
        return self.clients.openWindow(targetUrl);
      })
  );
});
