// Piezas de interfaz: iconos, avisos, dialogos, menus, confeti y utilidades.

const P = {
  plus: "M12 5v14M5 12h14",
  qr: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2M14 18h2v2M18 18h2v2h-2",
  library: "M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v4H4zM14 15h6v4h-6z",
  scan: "M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16",
  layers: "M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  text: "M5 6h14M5 12h14M5 18h9",
  wifi: "M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M12 19h.01",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
  chat: "M21 11.5a8.4 8.4 0 0 1-12.3 7.5L3 21l2-5.4A8.5 8.5 0 1 1 21 11.5z",
  phone: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z",
  sms: "M4 4h16v12H8l-4 4zM8 9h8M8 12h5",
  pin: "M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  calendar: "M4 5h16v16H4zM4 10h16M9 3v4M15 3v4",
  download: "M12 4v12M6 11l6 6 6-6M4 20h16",
  save: "M5 3h11l4 4v14H5zM8 3v6h8M8 21v-7h8v7",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  share: "M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4",
  dice: "M4 4h16v16H4zM8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01",
  undo: "M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
  redo: "M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3",
  image: "M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15.5 9.5h.01",
  upload: "M12 20V8M6 13l6-6 6 6M4 4h16",
  trash: "M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3",
  edit: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
  star: "M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z",
  dots: "M5 12h.01M12 12h.01M19 12h.01",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  check: "M5 12.5l4.5 4.5L19 7",
  x: "M6 6l12 12M18 6L6 18",
  chev: "M6 9l6 6 6-6",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
  camera: "M3 8h4l2-3h6l2 3h4v12H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  flip: "M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7z",
  folder: "M3 6h6l2 2h10v11H3z",
  pause: "M8 5h3v14H8zM13 5h3v14h-3z",
  play: "M7 4l13 8-13 8z",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  eyeoff: "M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.3 4.2M6.6 6.6C3.6 8.5 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2",
  logout: "M9 21H5V3h4M16 17l5-5-5-5M21 12H9",
  lock: "M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4",
  key: "M15 7a4 4 0 1 1-3.9 5H9v2H7v2H4v-3l6.1-6.1A4 4 0 0 1 15 7zM16 8h.01",
  users: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 3.1a4 4 0 0 1 0 7.8M18 14a7 7 0 0 1 4 7",
  globe: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20",
  box: "M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8",
  install: "M12 3v12M7 10l5 5 5-5M5 21h14",
  github: "M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  heart: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.6 1-1.1a5.5 5.5 0 0 0 0-7.7z",
  cart: "M3 3h2l2.4 12h11.2L21 7H6M9 20h.01M18 20h.01",
  music: "M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
  gift: "M3 8h18v4H3zM5 12h14v9H5zM12 8v13M12 8S10 3 7.5 4.5 9 8 12 8zM12 8s2-5 4.5-3.5S15 8 12 8z",
  coffee: "M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 9h1.5a2.5 2.5 0 0 1 0 5H17M7 2v3M11 2v3",
  info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01",
  alert: "M12 3l10 18H2zM12 10v4M12 17.5h.01",
  ok: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM8 12.5l3 3 5-6",
  zip: "M6 2h9l5 5v15H6zM10 4h2M10 7h2M10 10h2M10 13h2v3h-2z",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z",
};

export function icon(name, cls = "") {
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${P[name] || P.qr}"/></svg>`;
}
export const ICON_PATHS = P;

/** Logos rapidos (iconos propios en blanco sobre circulo de color) como data URL SVG. */
export function quickLogo(name, bg) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="${bg}"/><g transform="translate(10 10) scale(1.17)" fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="${P[name]}"/></g></svg>`;
  return "data:image/svg+xml;base64," + btoa(svg);
}

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export function h(html) { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; }

export function toast(msg, kind = "") {
  let box = $(".toasts");
  if (!box) { box = h('<div class="toasts" role="status" aria-live="polite"></div>'); document.body.appendChild(box); }
  const t = h(`<div class="toast ${kind}">${icon(kind === "bad" ? "alert" : "ok")}<span>${esc(msg)}</span></div>`);
  box.appendChild(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 320); }, kind === "bad" ? 4200 : 2600);
}

/** Dialogo propio (sin alert ni confirm). Devuelve el valor del boton pulsado. */
export function dialog({ title, body = "", buttons = [["Cancelar", null], ["Aceptar", true, "primary"]], wide = false, onOpen }) {
  return new Promise((resolve) => {
    const wrap = h(`<div class="dlg-wrap"><div class="dlg card ${wide ? "wide" : ""}" role="dialog" aria-modal="true">
      ${title ? `<div class="row between"><h3>${esc(title)}</h3><button class="btn ghost icon" data-x aria-label="Cerrar">${icon("x")}</button></div>` : ""}
      <div class="dlg-body">${body}</div>
      ${buttons.length ? `<div class="btns">${buttons.map(([t, , c], i) => `<button class="btn ${c || ""}" data-b="${i}">${esc(t)}</button>`).join("")}</div>` : ""}
    </div></div>`);
    const close = (v) => { wrap.remove(); document.removeEventListener("keydown", key); resolve(v); };
    const key = (e) => { if (e.key === "Escape") close(null); };
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap || e.target.closest("[data-x]")) return close(null);
      const b = e.target.closest("[data-b]");
      if (b) {
        const v = buttons[+b.dataset.b][1];
        close(typeof v === "function" ? v(wrap) : v);
      }
    });
    document.addEventListener("keydown", key);
    document.body.appendChild(wrap);
    const f = wrap.querySelector("input,select,textarea,.btn.primary");
    if (f) setTimeout(() => f.focus(), 50);
    onOpen?.(wrap, close);
  });
}
export const confirmDlg = (title, text, ok = "Eliminar", cls = "danger") =>
  dialog({ title, body: `<p class="muted" style="margin:0">${esc(text)}</p>`, buttons: [["Cancelar", false], [ok, true, cls === "danger" ? "primary danger-p" : "primary"]] });
export async function promptDlg(title, label, value = "", ph = "") {
  return dialog({
    title, body: `<label class="field"><span>${esc(label)}</span><input id="dlg-in" value="${esc(value)}" placeholder="${esc(ph)}" maxlength="120"></label>`,
    buttons: [["Cancelar", null], ["Aceptar", (w) => w.querySelector("#dlg-in").value, "primary"]],
    onOpen: (w, close) => w.querySelector("#dlg-in").addEventListener("keydown", (e) => { if (e.key === "Enter") { const v = e.target.value; close(v); } }),
  });
}

let openMenu = null;
export function menu(anchor, items) {
  openMenu?.remove();
  const m = h(`<div class="menu" role="menu">${items.map((it, i) => it === "-" ? "<hr>" :
    `<button role="menuitem" data-i="${i}" class="${it.danger ? "danger" : ""}">${icon(it.icon)}${esc(it.label)}</button>`).join("")}</div>`);
  document.body.appendChild(m);
  const r = anchor.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(window.innerWidth - mw - 8, r.right - mw)) + "px";
  m.style.top = (r.bottom + mh + 8 > window.innerHeight ? Math.max(8, r.top - mh - 6) : r.bottom + 6) + "px";
  const off = (e) => { if (!m.contains(e.target)) { m.remove(); document.removeEventListener("pointerdown", off, true); } };
  setTimeout(() => document.addEventListener("pointerdown", off, true));
  m.addEventListener("click", (e) => {
    const b = e.target.closest("[data-i]");
    if (!b) return;
    m.remove(); document.removeEventListener("pointerdown", off, true);
    items[+b.dataset.i].run();
  });
  openMenu = m;
}

/** Confeti con fisica sencilla. Se lanza desde un punto de la pantalla. */
export function confetti(x = innerWidth / 2, y = innerHeight / 3, n = 90) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let cv = $("#confetti");
  if (!cv) { cv = h('<canvas id="confetti"></canvas>'); document.body.appendChild(cv); }
  const dpr = devicePixelRatio || 1;
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  const ctx = cv.getContext("2d"); ctx.scale(dpr, dpr);
  const cols = ["#7c3aed", "#2563eb", "#06b6d4", "#f59e0b", "#ec4899", "#22c55e"];
  const ps = Array.from({ length: n }, () => {
    const a = Math.random() * Math.PI * 2, s = 4 + Math.random() * 8;
    return { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 6, r: 3 + Math.random() * 5, c: cols[(Math.random() * cols.length) | 0], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, sq: Math.random() < 0.5, life: 1 };
  });
  let last = performance.now();
  (function tick(now) {
    const dt = Math.min(2, (now - last) / 16.7); last = now;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    let alive = 0;
    for (const p of ps) {
      if (p.life <= 0) continue;
      alive++;
      p.vy += 0.32 * dt; p.vx *= 0.99; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.life -= 0.011 * dt;
      ctx.save(); ctx.globalAlpha = Math.max(0, p.life); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c;
      if (p.sq) ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); else { ctx.beginPath(); ctx.arc(0, 0, p.r / 1.4, 0, 7); ctx.fill(); }
      ctx.restore();
    }
    if (alive) requestAnimationFrame(tick); else ctx.clearRect(0, 0, innerWidth, innerHeight);
  })(last);
}

export function fmtDate(ts) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString("es-ES", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
export function ago(ts) {
  if (!ts) return "nunca";
  const s = Date.now() / 1000 - ts;
  if (s < 60) return "ahora mismo";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  if (s < 86400 * 30) return `hace ${Math.floor(s / 86400)} d`;
  return fmtDate(ts);
}
export const fmtN = (n) => Number(n || 0).toLocaleString("es-ES");

/** Puente con la app de Android (solo existe dentro de la app). */
export const APP = typeof window !== "undefined" && window.QRPanelAndroid ? window.QRPanelAndroid : null;
export const appVersion = () => { try { return APP ? APP.version() : ""; } catch { return ""; } };
const b64 = (blob) => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = ko; r.readAsDataURL(blob); });

export async function download(blob, name) {
  if (APP) { APP.saveFile(await b64(blob), name, blob.type || "application/octet-stream"); return; }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
/** Comparte un archivo (imagen del QR) con WhatsApp, Telegram, correo... */
export async function shareFile(blob, name, text = "") {
  if (APP) { APP.shareFile(await b64(blob), name, blob.type || "image/png", text || ""); return true; }
  const file = new File([blob], name, { type: blob.type || "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name, text: text || undefined }); } catch (e) { if (e.name !== "AbortError") throw e; }
    return true;
  }
  return false;
}
/** Comparte un texto o enlace. */
export async function shareText(text, title = "") {
  if (APP) { APP.shareText(text); return true; }
  if (navigator.share) { try { await navigator.share({ title: title || undefined, text }); } catch { /* cancelado */ } return true; }
  return false;
}
export const canShareText = () => !!(APP || navigator.share);

export const slug = (s) => (String(s || "qr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 60) || "qr");

/** Lee un archivo de imagen y lo reduce (max px) a data URL PNG; los SVG se guardan tal cual. */
export function readImage(file, max = 512) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) return reject(new Error("No es una imagen"));
    const fr = new FileReader();
    fr.onerror = () => reject(fr.error);
    fr.onload = () => {
      const url = fr.result;
      if (file.type === "image/svg+xml") {
        if (url.length > 1_000_000) return reject(new Error("El SVG es demasiado grande"));
        return resolve(url.startsWith("data:image/svg+xml;base64,") ? url : "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(atob(url.split(",")[1] || "")))));
      }
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement("canvas");
        cv.width = Math.max(1, Math.round(img.width * k)); cv.height = Math.max(1, Math.round(img.height * k));
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        resolve(cv.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error("No se pudo abrir la imagen"));
      img.src = url;
    };
    fr.readAsDataURL(file);
  });
}

/** Carga una imagen (File/Blob) en un canvas para leer el QR. */
export function fileToCanvas(file, max = 1600) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      const ctx = cv.getContext("2d", { willReadFrequently: true });
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url); resolve(cv);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo abrir la imagen")); };
    img.src = url;
  });
}
