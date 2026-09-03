/*
 * QTB DEV TOOLS — service worker (PWA offline shell)
 *
 * Strategy (conservative, dev-friendly):
 *  - Navigations:          network-first, fallback → cached "/" shell (SPA).
 *  - /_next/static/*:      cache-first (immutable/hashed assets).
 *  - /icons, manifest, og: stale-while-revalidate.
 *  - /api/*:               NEVER cached (always network).
 *  - HMR / cross-origin / range requests: bypassed untouched.
 */
const VERSION = "qtb-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;

const PRECACHE = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(VERSION))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/og-image.png" ||
    url.pathname === "/icon.svg" ||
    url.pathname.endsWith(".woff2")
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.includes("webpack-hmr") || url.search.includes("ts=")) return;
  if (req.headers.has("range")) return;

  // SPA navigations → network first, cached shell offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put("/", copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches
            .match("/", { cacheName: SHELL_CACHE })
            .then((shell) => shell ?? new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } }))
        )
    );
    return;
  }

  // Immutable build assets → cache first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.endsWith(".woff2")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ??
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(ASSET_CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
            }
            return res;
          })
      )
    );
    return;
  }

  // Brand assets → stale-while-revalidate.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(req).then((hit) => {
        const network = fetch(req)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(ASSET_CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => hit);
        return hit ?? network;
      })
    );
  }
});
