const CACHE = "musicly-cache-v10";

const FILES = [
  "/Musicly/",
  "/Musicly/index.html",
  "/Musicly/app.js",
  "/Musicly/jszip.min.js",
  "/Musicly/manifest.webmanifest",
  "/Musicly/icon-180.png",
  "/Musicly/icon-192.png",
  "/Musicly/icon-512.png"
];

// Install
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(FILES))
  );
  self.skipWaiting();
});

// Activate
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(cached => {

      const fetchPromise = fetch(event.request)
        .then(networkResponse => {
          return caches.open(CACHE).then(cache => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => caches.match("/Musicly/index.html"));

      return cached || fetchPromise;
    })
  );
});
