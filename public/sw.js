/* simple service worker */
const CACHE = "noujiru-gorilla-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k === CACHE) ? null : caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Network-first for API, cache-first for static
  if (req.url.includes("/api/")) {
    event.respondWith(fetch(req).catch(() => new Response(JSON.stringify({
      error: "offline",
      message: "オフライン：APIに到達できません。"
    }), { headers: { "Content-Type": "application/json" }, status: 503 })));
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    if (cached) return cached;
    const res = await fetch(req);
    // cache the new resource
    if (res.ok && req.method === "GET") cache.put(req, res.clone());
    return res;
  })());
});
