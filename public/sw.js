/* Service worker: app-shell caching + offline fallback.
 * Registered as /sw.js?v=<build id>; a new build means a new worker, which waits
 * until the page asks it to take over (the "Update available" toast). */

const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const PRECACHE_CACHE = `precache-${VERSION}`;
// Not versioned: hashed chunk names never collide, and cached pages from an older
// build still need their chunks to render offline.
const STATIC_CACHE = "next-static";
// Pages you've opened (served instantly, refreshed in the background) and pages only
// pre-cached for offline use. Both are cleared when a new version takes over.
const PAGES_CACHE = "pages";
const WARM_CACHE = "pages-warm";
// The signed-in app: static shells that render from on-device data.
const APP_PAGES = /^\/(home|activity|insights|groups|settings)(\/|$)/;
const ASSETS_CACHE = "assets";
const OFFLINE_URL = "/offline.html"; // self-contained, works with no other assets

const PRECACHE = [OFFLINE_URL, "/manifest.webmanifest", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PRECACHE_CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("precache-") && key !== PRECACHE_CACHE)
          .map((key) => caches.delete(key)),
      );
      // New version: drop page shells from the old build so the next load fetches fresh ones.
      await Promise.all([caches.delete(PAGES_CACHE), caches.delete(WARM_CACHE)]);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data?.type === "CLEAR_USER_CACHE") {
    event.waitUntil(Promise.all([caches.delete(PAGES_CACHE), caches.delete(WARM_CACHE)]));
  }
  // Pre-cache the app's tabs after sign-in so every tab opens offline, not just visited ones.
  if (event.data?.type === "WARM_PAGES") {
    event.waitUntil(warmPages(event.data.urls || []));
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase, Google, etc. go straight to network
  if (url.pathname.startsWith("/auth/") || url.pathname.startsWith("/api/")) return;

  // Hashed build assets never change: cache-first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // App screens: open instantly from the copy saved last time, refresh it in the background.
  // Other pages (login, landing…): network first, cached copy or offline page as fallback.
  if (request.mode === "navigate") {
    event.respondWith(APP_PAGES.test(url.pathname) ? cachedAppPage(event, request) : networkFirstPage(request));
    return;
  }

  // Icons, images and fonts: serve cached, refresh in the background.
  if (/\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, ASSETS_CACHE));
  }
});

// Push notifications from the scheduler: { title, body, url, tag }.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Expense", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: data.tag,
      data: { url: data.url || "/home" },
    }),
  );
});

// Tapping a notification focuses an open window (navigating it) or opens the app.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/home", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (existing) {
        await existing.focus();
        return existing.navigate(url).catch(() => undefined);
      }
      return self.clients.openWindow(url);
    })(),
  );
});

/** Page shells are the same for every query string (?add=1 etc.), so key them by path. */
const pageKey = (request) => new URL(request.url).origin + new URL(request.url).pathname;

async function cachedAppPage(event, request) {
  const cache = await caches.open(PAGES_CACHE);
  const network = fetch(request).then(async (response) => {
    // Redirects (e.g. to /login after signing out elsewhere) are never cached.
    if (response.ok && !response.redirected) await cache.put(pageKey(request), response.clone());
    return response;
  });
  const cached = await cache.match(pageKey(request));
  if (cached) {
    event.waitUntil(network.catch(() => undefined));
    return cached;
  }
  try {
    return await network;
  } catch {
    return (
      (await caches.match(pageKey(request))) ||
      (await caches.match(OFFLINE_URL)) ||
      new Response("You're offline", { status: 503, headers: { "Content-Type": "text/plain" } })
    );
  }
}

async function warmPages(urls) {
  const cache = await caches.open(WARM_CACHE);
  await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url, { credentials: "same-origin" });
        if (response.ok && !response.redirected) await cache.put(url, response);
      } catch {
        // Offline: try again next time.
      }
    }),
  );
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(cacheName)).put(request, response.clone());
  return response;
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGES_CACHE);
  try {
    const response = await fetch(request);
    // Only cache real pages, not redirects (e.g. to /login).
    if (response.ok && !response.redirected) cache.put(request, response.clone());
    return response;
  } catch {
    return (
      (await cache.match(request)) ||
      (await caches.match(pageKey(request))) ||
      (await caches.match(OFFLINE_URL)) ||
      new Response("You're offline", { status: 503, headers: { "Content-Type": "text/plain" } })
    );
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || network;
}
