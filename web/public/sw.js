/* GreenHarmony service worker: makes the app installable and keeps it usable offline.
 * Pages: network first, falling back to the cached copy (then /offline/).
 * Build assets (/_next/static, hashed): cache first.
 * Plant photos (Wikimedia, iNaturalist): cache first, capped.
 * Weather (Open-Meteo) and anything else cross-origin: straight to the network.
 */
// Both are filled in by scripts/finalize-sw.mjs after `next build`.
const VERSION = "gh-dev";
const BUILD_ASSETS = [];
const PAGES = `${VERSION}-pages`;
const ASSETS = `${VERSION}-assets`;
const PHOTOS = "gh-photos"; // survives new builds
const PHOTO_LIMIT = 80;
const PRECACHE = ["/", "/garden/", "/plan/", "/plants/", "/insights/", "/offline/", "/manifest.webmanifest", "/icon-192.png"];
const PHOTO_HOSTS = ["upload.wikimedia.org", "thumb.wikimedia.org", "inaturalist-open-data.s3.amazonaws.com", "static.inaturalist.org"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(PAGES).then((c) => c.addAll(PRECACHE)),
      // Every script, style and font of this build, so any page (the garden included) runs offline.
      caches.open(ASSETS).then((c) => c.addAll(BUILD_ASSETS)),
    ]).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION) && k !== PHOTOS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// The page sends the scripts and styles it already loaded, so the first visit works offline too.
self.addEventListener("message", (event) => {
  const urls = event.data && event.data.type === "cache-urls" ? event.data.urls : null;
  if (!Array.isArray(urls)) return;
  event.waitUntil(
    caches.open(ASSETS).then((c) =>
      Promise.all(
        urls
          .filter((u) => new URL(u).origin === self.location.origin && new URL(u).pathname.startsWith("/_next/static/"))
          .map((u) => c.match(u).then((hit) => hit || c.add(u).catch(() => undefined))),
      ),
    ),
  );
});

async function trim(cacheName, max) {
  const c = await caches.open(cacheName);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

async function cacheFirst(request, cacheName, limit) {
  const c = await caches.open(cacheName);
  const hit = await c.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok || res.type === "opaque") {
    await c.put(request, res.clone());
    if (limit) trim(cacheName, limit);
  }
  return res;
}

async function networkFirst(request, isNavigation) {
  const c = await caches.open(PAGES);
  try {
    const res = await fetch(request);
    if (res.ok) c.put(request, res.clone());
    return res;
  } catch {
    const hit = (await c.match(request)) || (await c.match(request, { ignoreSearch: true }));
    if (hit) return hit;
    if (isNavigation) return (await c.match("/offline/")) || Response.error();
    return Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith("/_next/static/")) event.respondWith(cacheFirst(request, ASSETS));
    else event.respondWith(networkFirst(request, request.mode === "navigate"));
    return;
  }
  if (PHOTO_HOSTS.includes(url.hostname) && request.destination === "image") {
    event.respondWith(cacheFirst(request, PHOTOS, PHOTO_LIMIT).catch(() => Response.error()));
  }
});
