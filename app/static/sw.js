// Service worker de QRPanel: la app abre sin conexion (crear y escanear).
// La API y las redirecciones /r/ van siempre a la red.
const CACHE = "qrpanel-v22";
const SHELL = ["/", "/static/app.css?v=11", "/static/js/app.js?v=17", "/static/js/i18n.js", "/static/js/i18n-en.json?v=6", "/static/js/qr.js", "/static/js/content.js",
  "/static/js/store.js", "/static/js/presets.js", "/static/js/zip.js", "/static/js/pdf.js", "/static/js/model3d.js", "/static/js/viewer3d.js", "/static/js/animals.js", "/static/js/poster.js", "/static/js/stand3d.js", "/static/menu.css?v=3", "/static/js/place.js?v=3", "/static/js/share.js", "/static/js/ui.js", "/static/vendor/qrcode.js",
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
  // (no-cache: pregunta siempre al servidor, para que una actualizacion se vea al recargar)
  const req = e.request.mode === "navigate" ? new Request(e.request.url, { credentials: "same-origin" }) : e.request;
  e.respondWith(fetch(req, { cache: "no-cache" }).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request).then((r) => r || caches.match("/"))));
});
