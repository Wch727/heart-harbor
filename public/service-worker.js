const CACHE_PREFIX = "companion-hub-";
const CACHE_NAME = `${CACHE_PREFIX}v23`;
const ASSETS = new Set([
  "/",
  "/index.html",
  "/chat",
  "/chat.html",
  "/support",
  "/support.html",
  "/checkin",
  "/checkin.html",
  "/mood-weather",
  "/mood-weather.html",
  "/user-api",
  "/user-api.html",
  "/cards",
  "/cards.html",
  "/privacy",
  "/privacy.html",
  "/styles.css",
  "/shared.js",
  "/site.js",
  "/support.js",
  "/checkin.js",
  "/mood-weather.js",
  "/user-api.js",
  "/ai-presets.js",
  "/cards.js",
  "/privacy.js",
  "/chat.js",
  "/manifest.json"
]);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll([...ASSETS])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || !ASSETS.has(url.pathname)) return;

  // The page scripts read query parameters from the browser URL.
  event.respondWith(caches.open(CACHE_NAME).then(async (cache) => {
    return (await cache.match(url.pathname)) || fetch(event.request);
  }));
});
