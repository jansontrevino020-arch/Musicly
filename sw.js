const CACHE = "musicly-cache-v9";

const FILES = [
  "/Musicly",
  "/Musicly/",
  "/Musicly/index.html",
  "/Musicly/app.js",
  "/Musicly/jszip.min.js",
  "/Musicly/manifest.webmanifest",
  "/Musicly/icon-180.png",
  "/Musicly/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(response => {
      if (response) return response;

      return fetch(event.request).catch(() => {
        return caches.match("/Musicly/index.html");
      });
    })
  );
});
