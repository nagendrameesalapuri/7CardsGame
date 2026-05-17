// Firebase push notification handler.
// This file is NOT a standalone service worker — it is imported via
// importScripts() into the Workbox-generated SW (configured in vite.config.ts).
// Running inside the Workbox SW context gives it access to self, caches, etc.

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

const FCM_CACHE_NAME = 'fcm-config-v1';
const FCM_CACHE_KEY  = '/__fcm_config';

let fcmMessaging = null;
let fcmReady     = false;

function showArenaNotification(n, d) {
  const actionUrl = (d && d.actionUrl) ? d.actionUrl : '/';
  return self.registration.showNotification(
    (n && n.title) ? n.title : 'Arena of Sevens',
    {
      body:     (n && n.body)       ? n.body       : '',
      icon:     '/pwa-icon.svg',
      badge:    '/pwa-icon.svg',
      tag:      (d && d.category)   ? d.category   : 'arena',
      renotify: true,
      data:     { actionUrl },
    }
  );
}

function initFCMInSW(cfg) {
  if (fcmReady || !cfg || !cfg.apiKey) return;
  try {
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    fcmMessaging = firebase.messaging();
    fcmMessaging.onBackgroundMessage(function(payload) {
      showArenaNotification(payload.notification || {}, payload.data || {});
    });
    fcmReady = true;
  } catch (err) {
    console.warn('[SW FCM] init failed:', err);
  }
}

// ── Receive Firebase config from the main thread (fcm.ts) ─────────────────────
// fcm.ts calls sw.postMessage({ type: 'FCM_CONFIG', config: {...} }) after
// Firebase initialises in the browser. We persist it to Cache API so it
// survives across SW restarts (i.e. works when the app is closed).
self.addEventListener('message', function(event) {
  if (!event.data || event.data.type !== 'FCM_CONFIG') return;
  var cfg = event.data.config;
  caches.open(FCM_CACHE_NAME).then(function(cache) {
    cache.put(FCM_CACHE_KEY, new Response(JSON.stringify(cfg), {
      headers: { 'Content-Type': 'application/json' },
    }));
  });
  initFCMInSW(cfg);
});

// ── Raw push fallback ─────────────────────────────────────────────────────────
// Handles pushes that arrive before Firebase has initialised (e.g. very first
// push before the user has opened the app). Once fcmReady=true the Firebase
// SDK's onBackgroundMessage takes over.
self.addEventListener('push', function(event) {
  if (!event.data || fcmReady) return;
  var payload;
  try { payload = event.data.json(); } catch(e) { return; }
  event.waitUntil(
    showArenaNotification(payload.notification || {}, payload.data || {})
  );
});

// ── Notification click → navigate to deep link ────────────────────────────────
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var actionUrl = (event.notification.data && event.notification.data.actionUrl)
    ? event.notification.data.actionUrl : '/';
  var targetUrl = new URL(actionUrl, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clients) {
      for (var i = 0; i < clients.length; i++) {
        var c = clients[i];
        if ('focus' in c) {
          c.postMessage({ type: 'NOTIFICATION_CLICK', actionUrl: actionUrl });
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});

// ── Init from cached config on SW startup ─────────────────────────────────────
// When the app is closed and a push arrives, the SW restarts from scratch.
// We read the previously cached config so Firebase can initialise immediately.
(function() {
  caches.open(FCM_CACHE_NAME).then(function(cache) {
    return cache.match(FCM_CACHE_KEY);
  }).then(function(resp) {
    if (!resp) return null;
    return resp.json();
  }).then(function(cfg) {
    if (cfg) initFCMInSW(cfg);
  }).catch(function() {});
})();
