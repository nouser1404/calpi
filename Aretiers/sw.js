// sw.js
const CACHE_NAME = "corroyage-pwa-v1";

// Mets ici tous les fichiers essentiels à l'app
const ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/main.js",
  "./js/ui.js",
  "./js/render.js",
  "./js/geometry.js",
  "./js/flatten.js",
  "./js/templates.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// Install: précache
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: nettoyage d'anciens caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - navigation: network-first (pratique pour récupérer les MAJ)
// - assets: cache-first
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Navigation (page)
  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req));
    return;
  }

  // Fichiers statiques
  event.respondWith(cacheFirst(req));
});

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const fresh = await fetch(req);
  const cache = await caches.open(CACHE_NAME);
  cache.put(req, fresh.clone());
  return fresh;
}

async function networkFirst(req) {
  try {
    const fresh = await fetch(req);
    const cache = await caches.open(CACHE_NAME);
    cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const cached = await caches.match(req);
    return cached || caches.match("./index.html");
  }
}
