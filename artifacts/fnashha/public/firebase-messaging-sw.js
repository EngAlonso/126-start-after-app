/**
 * Fnashha Service Worker (PWA cache + Firebase Web Push)
 * ========================================================
 * This single service worker does two jobs:
 *   1. The existing offline/asset caching behaviour (unchanged, copied from
 *      the old public/sw.js).
 *   2. Firebase Cloud Messaging background push handling, so browser/PWA
 *      users get notifications the same way native app users already do.
 *
 * Why one file instead of two service workers:
 *   Registering a second service worker at the same scope ("/") would take
 *   over as the active controller and silently break the existing caching
 *   behaviour. Merging both responsibilities into one file avoids that.
 *
 * Config loading:
 *   This is a static file (not processed by Vite), so it cannot read
 *   import.meta.env. It pulls the public Firebase Web config from the
 *   backend at /api/firebase-web-config.js via importScripts(), which is
 *   synchronous and safe to use at the top level of a classic service
 *   worker script.
 */

const CACHE_NAME = "fnashha-v8";

const STATIC_ASSETS = [
  "/",
  "/manifest.json?v=3",
  "/favicon.ico?v=3",
  "/assets/icon-192.png?v=3",
  "/assets/icon-512.png?v=3",
  "/assets/customer-hero.png",
  "/stats-bg.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Allows the app (via System Maintenance → Force PWA Update, or the
// automatic update-available flow) to tell a waiting service worker to
// activate immediately instead of waiting for all tabs to close.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Never intercept Vite dev-server module requests — these paths are only
  // present in development and must always go to the network so that code
  // changes are reflected immediately without a stale-cache hit.
  if (url.pathname.startsWith("/src/") || url.pathname.startsWith("/@")) {
    return;
  }

  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request)
        .then((response) => {
          if (
            !response ||
            response.status !== 200 ||
            response.type === "opaque"
          ) {
            return response;
          }

          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });

          return response;
        })
        .catch(() => {
          if (event.request.destination === "document") {
            return caches.match("/");
          }
        });
    })
  );
});

// ─── Firebase Cloud Messaging (Web Push) ─────────────────────────────────────

let fcmReady = false;

try {
  importScripts("/api/firebase-web-config.js");
  const config = self.__FNASHHA_FIREBASE_CONFIG__;

  if (config && config.supported) {
    importScripts(
      "https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js"
    );
    importScripts(
      "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js"
    );

    firebase.initializeApp(config);
    const messaging = firebase.messaging();

    // Only fires when the app is NOT in the foreground (tab hidden/closed).
    // Foreground delivery is handled by onMessage() in the main thread
    // (web-push.ts), which reuses the existing push-foreground toast UI —
    // this avoids showing the notification twice.
    messaging.onBackgroundMessage((payload) => {
      const data = payload.data || {};
      const title = (payload.notification && payload.notification.title) || data.title || "فنشها";
      const body = (payload.notification && payload.notification.body) || data.body || "";

      const showPromise = self.registration.showNotification(title, {
        body,
        icon: "/assets/icon-192.png?v=3",
        badge: "/assets/icon-96.png?v=3",
        dir: "rtl",
        lang: "ar",
        tag: data.requestId ? `fnashha-${data.type || "push"}-${data.requestId}` : undefined,
        data,
      });

      // Return the promise so the Firebase SDK passes it to event.waitUntil().
      // Without this return the browser can terminate the SW before
      // showNotification() resolves and the notification never appears.
      return showPromise;
    });

    fcmReady = true;
  } else {
    console.info("[SW] Firebase web config not set — web push disabled, caching still active.");
  }
} catch (err) {
  console.warn("[SW] Firebase messaging init failed — caching still active:", err);
}

// ─── Notification click routing ──────────────────────────────────────────────
// No routing logic is duplicated here. We either:
//   (a) focus an already-open app window and postMessage() it the payload —
//       the running app then calls the SAME navigateFromPush()/resolveDeepLink()
//       used by the native push flow, or
//   (b) open a brand-new window with the payload encoded in the URL, which
//       the app reads on boot and again feeds into navigateFromPush().
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if ("focus" in client) {
          client.postMessage({ type: "fnashha:notification-click", data });
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        const encoded = encodeURIComponent(JSON.stringify(data));
        return self.clients.openWindow(`${self.location.origin}/?pushData=${encoded}`);
      }
    })
  );
});
