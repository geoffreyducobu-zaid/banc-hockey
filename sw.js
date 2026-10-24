// Service worker : garde une copie de l'app sur le téléphone pour qu'elle
// s'ouvre sans réseau. Change VERSION à chaque mise en ligne pour que les
// téléphones récupèrent la nouvelle version (et le ?v= des scripts dans index.html).
const VERSION = "banc-v33";
const FILES = [
  "./", "index.html", "app.js", "rotation.js", "cloud.js", "live.js", "config.js", "manifest.webmanifest",
  "vendor/jspdf.umd.min.js", "vendor/supabase.js", "vendor/qrcode.js", "fonts/fonts.css",
  "fonts/inter-tight-latin-400-normal.woff2", "fonts/inter-tight-latin-500-normal.woff2",
  "fonts/inter-tight-latin-600-normal.woff2", "fonts/inter-tight-latin-700-normal.woff2",
  "fonts/inter-tight-latin-800-normal.woff2", "fonts/inter-tight-latin-800-italic.woff2",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Réseau d'abord (pour avoir la dernière version), copie locale si pas de réseau.
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    // no-cache : toujours vérifier auprès du serveur, sans réutiliser le cache du navigateur
    fetch(req, {cache: "no-cache"}).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, {ignoreSearch: true}).then(r => r || caches.match("index.html")))
  );
});
