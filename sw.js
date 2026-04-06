const CACHE = "musicly-cache-v1";
const FILES = [
  "/Musicly/",
  "/Musicly/index.html",
  "/Musicly/manifest.webmanifest"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
});

self.addEventListener("fetch", e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});