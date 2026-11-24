// Service worker de QRPanel: la app abre sin conexion (crear y escanear).
// La API y las redirecciones /r/ van siempre a la red.
const CACHE = "qrpanel-v1";
const SHELL = ["/", "/static/app.css?v=1", "/static/js/app.js?v=1", "/static/js/qr.js", "/static/js/content.js",
  "/static/js/store.js", "/static/js/presets.js", "/static/js/zip.js", "/static/js/ui.js", "/static/vendor/qrcode.js",
  "/static/vendor/jsQR.min.js", "/static/icons/icon.svg", "/static/icons/icon-192.png", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api/") || u.pathname.startsWith("/r/")) return;
  // red primero (siempre la version nueva) y, sin conexion, lo guardado
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request).then((r) => r || caches.match("/"))));
});
