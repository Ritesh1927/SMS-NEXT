/* global self, caches */
// EduNivo service worker -- SOURCE TEMPLATE.
//
// Not served directly: `npm run build` (prebuild -> scripts/build-sw.mjs)
// stamps a unique build version into __SW_VERSION__ and writes the result to
// public/sw.js. A byte-different sw.js per deploy is what lets browsers
// detect a new version and show the "Update Now" banner.
//
// Caching policy (see docs/pwa.md):
//   /api/*            never touched -- authenticated, per-user, must be live
//   non-GET / cross-origin  never touched
//   page navigations  network-first, cached app shell / offline page fallback
//   /_next/static/*   cache-first (content-hashed, immutable)
//   images/icons/fonts/manifest  stale-while-revalidate
//   everything else (RSC payloads, /_next/image, ...)  plain network

const VERSION = "__SW_VERSION__";
const CACHE_PREFIX = "edunivo-";
const PRECACHE = `${CACHE_PREFIX}precache-${VERSION}`;
const STATIC_CACHE = `${CACHE_PREFIX}static-${VERSION}`;
const ASSET_CACHE = `${CACHE_PREFIX}assets-${VERSION}`;
const PAGE_CACHE = `${CACHE_PREFIX}pages-${VERSION}`;
const CURRENT_CACHES = [PRECACHE, STATIC_CACHE, ASSET_CACHE, PAGE_CACHE];

const OFFLINE_URL = "/offline.html";
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/favicon.ico",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

// Page shells are small but every visited route gets an entry; keep the
// most recent ones so storage can't grow without bound.
const MAX_CACHED_PAGES = 40;

const STATIC_ASSET_PATTERN = /\.(?:png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf)$/i;

// App-shell pages whose HTML (and every JS/CSS chunk they reference) is
// downloaded while a new version installs, so "Update Now" -- and the first
// launch after it -- is served from cache instead of the network.
const SHELL_PAGES = ["/login", "/dashboard"];
const NEXT_STATIC_URL_PATTERN = /\/_next\/static\/[^"'\s)\\]+/g;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      // Essential: a failure here aborts the install and the old version stays.
      const precache = await caches.open(PRECACHE);
      await precache.addAll(PRECACHE_URLS);
      // Best effort: never block an update on warming the cache.
      await warmAppShell().catch(() => {});
    })(),
  );
  // No skipWaiting() here: an updated worker waits until the user taps
  // "Update Now" (message below), so open tabs never switch versions mid-task.
});

// Fetches the shell pages of THIS deploy and caches their HTML plus the
// hashed /_next/static assets they reference. All shell pages are client
// components, so this HTML carries no user data (auth is a bearer token).
async function warmAppShell() {
  const [pageCache, staticCache] = await Promise.all([caches.open(PAGE_CACHE), caches.open(STATIC_CACHE)]);
  const assetUrls = new Set();

  await Promise.allSettled(
    SHELL_PAGES.map(async (path) => {
      const response = await fetch(path, { cache: "no-cache", credentials: "same-origin" });
      if (!response.ok || response.redirected) return;
      const html = await response.clone().text();
      for (const match of html.matchAll(NEXT_STATIC_URL_PATTERN)) assetUrls.add(match[0]);
      await pageCache.put(path, response);
    }),
  );

  await Promise.allSettled(
    [...assetUrls].map(async (url) => {
      if (!(await staticCache.match(url))) await staticCache.add(url);
    }),
  );
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && !CURRENT_CACHES.includes(name))
          .map((name) => caches.delete(name)),
      );
      // Lets the browser start the navigation request while the worker
      // boots, so network-first pages aren't slowed down by the worker.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

// Push notifications: the receiving side. A server-sent payload is JSON
// { title, body?, url?, tag? }; tapping the notification focuses an open
// EduNivo window (or opens one) at `url`. Sending pushes needs VAPID keys
// and a subscription store on the server -- see docs/pwa.md.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "EduNivo", {
      body: data.body || "",
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-96x96.png",
      tag: data.tag,
      data: { url: data.url || "/dashboard" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/dashboard", self.location.origin);
  // Only ever navigate within this app's own origin.
  if (target.origin !== self.location.origin) return;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (existing) {
        await existing.focus();
        if ("navigate" in existing) await existing.navigate(target.href).catch(() => {});
        return;
      }
      await self.clients.openWindow(target.href);
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Cloudinary, Razorpay, etc. manage their own caching.
  if (url.origin !== self.location.origin) return;
  // Authenticated API data is never cached: it's per-user, and serving a
  // stale or other user's response would be a correctness/privacy bug.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(event));
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }
  if (STATIC_ASSET_PATTERN.test(url.pathname) || url.pathname === "/manifest.webmanifest") {
    event.respondWith(staleWhileRevalidate(event, ASSET_CACHE));
  }
});

// Pages: always try the network so users get fresh HTML; fall back to the
// last cached copy of that route, then to the offline page. Every page in
// this app is a client component that loads user data from /api with a
// bearer token, so cached HTML is a data-free app shell.
async function networkFirstPage(event) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const response = (await event.preloadResponse) || (await fetch(event.request));
    // Redirected responses can't be replayed for a navigation request.
    if (response.ok && response.type === "basic" && !response.redirected) {
      event.waitUntil(cache.put(event.request, response.clone()).then(() => trimCache(cache, MAX_CACHED_PAGES)));
    }
    return response;
  } catch {
    const cached = await cache.match(event.request, { ignoreSearch: true, ignoreVary: true });
    return cached || (await caches.match(OFFLINE_URL)) || Response.error();
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(event, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(event.request);
  const network = fetch(event.request)
    .then((response) => {
      if (response.ok) cache.put(event.request, response.clone());
      return response;
    })
    .catch(() => undefined);
  // Keep the worker alive until the background refresh finishes.
  event.waitUntil(network);
  return cached || (await network) || Response.error();
}

async function trimCache(cache, maxEntries) {
  const keys = await cache.keys();
  // Cache keys come back in insertion order, so the oldest go first.
  await Promise.all(keys.slice(0, Math.max(0, keys.length - maxEntries)).map((key) => cache.delete(key)));
}
