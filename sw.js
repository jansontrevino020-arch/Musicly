const CACHE = "musicly-cache-v7";

const FILES = [
  "/Musicly/",
  "/Musicly/index.html",
  "/Musicly/app.js",
  "/Musicly/jszip.min.js",
  "/Musicly/manifest.webmanifest"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) return response;

      return fetch(event.request).catch(() => {
        if (event.request.mode === "navigate") {
          return caches.match("/Musicly/index.html");
        }
      });
    })
  );
});
