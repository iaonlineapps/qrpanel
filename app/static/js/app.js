import { render, shapeSample, svgToCanvas, readability, decodeCanvas, mergeDesign, DEFAULT_DESIGN, DOT_SHAPES, FRAME_SHAPES, BALL_SHAPES, FRAMES } from "./qr.js";
import { TYPES, encode, missing, parse } from "./content.js";
import { detect, LocalStore } from "./store.js";
import { PRESETS, surprise } from "./presets.js";
import { makeZip } from "./zip.js";
import { makePdf } from "./pdf.js";
import { build as build3d, toSTL, to3MF, toSTLParts, DEFAULT_3D } from "./model3d.js";
import { viewer } from "./viewer3d.js";
import { icon, quickLogo, $, $$, esc, debounce, h, toast, dialog, confirmDlg, promptDlg, menu, confetti, fmtDate, ago, fmtN, download, slug, readImage, fileToCanvas, APP, appVersion, shareFile, shareText, canShareText } from "./ui.js";

const S = { store: LocalStore, info: null, me: null, qrs: [], logos: [], templates: [], loaded: false };
const app = $("#app");

// --- tema ------------------------------------------------------------------------
function applyTheme() {
  const t = localStorage.getItem("qp-theme") || "system";
  const dark = t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  $('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0a0c13" : "#f5f6fb");
}
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
applyTheme();

// --- arranque --------------------------------------------------------------------
async function boot() {
  const d = await detect();
  S.store = d.store; S.info = d.info; S.brand = d.info?.brand; applyBrand();
  if (S.store.mode === "server") {
    try { S.me = await S.store.me(); } catch { return showAuth(); }
  } else {
    S.me = await S.store.me();
  }
  await loadData();
  shell();
  route();
}
async function loadData() {
  const [q, l, t] = await Promise.all([S.store.list(), S.store.logos(), S.store.templates()]);
  S.qrs = q; S.logos = l; S.templates = t; S.loaded = true;
}

// --- acceso ----------------------------------------------------------------------
function brandHtml(b = S.brand) {
  const name = b?.name || "QRPanel", logo = b?.logo || "/static/icons/icon.svg";
  const nm = name === "QRPanel" ? `QR<b>Panel</b>` : esc(name);
  return `<img src="${esc(logo)}" alt=""><span>${nm}</span>`;
}
function applyBrand() {
  document.title = S.brand?.name || "QRPanel";
  const fav = document.querySelector('link[rel="icon"][type="image/svg+xml"]');
  if (fav && S.brand?.logo) fav.href = S.brand.logo;
}

function showAuth() {
  const first = S.info && !S.info.has_users;
  app.innerHTML = `<div class="auth"><canvas id="bgfx"></canvas>
    <form class="auth-card card" autocomplete="on">
      <div class="brand">${brandHtml()}</div>
      <h2 id="a-title">${first ? "Crea la cuenta de administrador" : "Entra en tu generador de QR"}</h2>
      <label class="field"><span>Usuario</span><input name="u" autocomplete="username" required minlength="3" maxlength="32"></label>
      <label class="field"><span>Contraseña</span><input name="p" type="password" autocomplete="current-password" required minlength="6"></label>
      <div class="auth-msg" id="a-msg"></div>
      <button class="btn primary" id="a-go">${first ? "Crear y entrar" : "Entrar"}</button>
      ${S.info?.allow_register && !first ? `<button type="button" class="btn ghost" id="a-sw">¿No tienes cuenta? Regístrate</button>` : ""}
    </form></div>`;
  bgFx($("#bgfx"));
  let reg = first;
  $("#a-sw")?.addEventListener("click", () => {
    reg = !reg;
    $("#a-title").textContent = reg ? "Pide una cuenta" : "Entra en tu generador de QR";
    $("#a-go").textContent = reg ? "Crear cuenta" : "Entrar";
    $("#a-sw").textContent = reg ? "Ya tengo cuenta" : "¿No tienes cuenta? Regístrate";
    $("#a-msg").textContent = "";
  });
  $("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const u = e.target.u.value.trim(), p = e.target.p.value, msg = $("#a-msg");
    msg.className = "auth-msg"; msg.textContent = "";
    try {
      if (reg) {
        const r = await S.store.register(u, p);
        if (!r.first) { msg.className = "auth-msg ok"; msg.textContent = r.msg; return; }
      }
      await S.store.login(u, p);
      S.me = await S.store.me(); S.brand = S.me.brand;
      await loadData(); shell(); route();
      if (reg) { confetti(); toast("¡Bienvenido! Crea tu primer QR"); }
    } catch (err) { msg.textContent = err.message; }
  });
}

/** Fondo animado de la pantalla de entrada: modulos de QR flotando. */
function bgFx(cv) {
  if (!cv || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const ctx = cv.getContext("2d"), dpr = devicePixelRatio || 1;
  const resize = () => { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  resize(); addEventListener("resize", resize);
  const cols = ["#7c3aed", "#2563eb", "#06b6d4", "#a78bfa"];
  const ps = Array.from({ length: 60 }, () => ({ x: Math.random() * innerWidth, y: Math.random() * innerHeight, s: 6 + Math.random() * 18, v: 0.15 + Math.random() * 0.5, r: Math.random() * 6, c: cols[(Math.random() * 4) | 0], round: Math.random() < 0.5 }));
  (function tick() {
    if (!cv.isConnected) return;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of ps) {
      p.y -= p.v; p.r += 0.003; if (p.y < -30) { p.y = innerHeight + 30; p.x = Math.random() * innerWidth; }
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.globalAlpha = 0.18; ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.roundRect(-p.s / 2, -p.s / 2, p.s, p.s, p.round ? p.s / 2 : p.s / 6); ctx.fill(); ctx.restore();
    }
    requestAnimationFrame(tick);
  })();
}

// --- versiones (web y app de Android), para ver de un vistazo si van acordes
const webVersion = () => S.info?.version || S.me?.version || "";
const versionsText = () => `Web ${webVersion()}` + (APP ? ` · App ${appVersion()}` : "");
const versionsHtml = () => `QRPanel · <b>Web ${esc(webVersion())}</b>` + (APP ? ` · <b>App ${esc(appVersion())}</b>` : ` · <a href="https://github.com/pctecnikk/qrpanel/releases?q=android&expanded=true" target="_blank" rel="noopener">App Android</a>`);

// --- esqueleto y rutas -----------------------------------------------------------------
const NAV = [["crear", "Crear", "plus"], ["biblioteca", "Biblioteca", "library"], ["escanear", "Escanear", "scan"], ["lotes", "Por lotes", "layers"], ["estadisticas", "Estadísticas", "chart"], ["ajustes", "Ajustes", "gear"]];
function shell() {
  const initial = (S.me.username || "?")[0].toUpperCase();
  app.innerHTML = `
  <header class="top">
    <a class="brand" href="#/crear">${brandHtml()}</a>
    <nav class="nav">${NAV.map(([k, t, i]) => `<a href="#/${k}" data-r="${k}">${icon(i, "sm")}${t}${k === "ajustes" && S.me.pending ? '<span class="badge-dot"></span>' : ""}</a>`).join("")}</nav>
    <div class="top-right">
      ${S.store.mode === "local" ? `<span class="local-pill" title="Los QR se guardan solo en este navegador">Modo local</span>` : ""}
      <button class="btn ghost icon" id="theme" aria-label="Cambiar tema">${icon(document.documentElement.dataset.theme === "dark" ? "sun" : "moon")}</button>
      ${S.store.mode === "server" ? `<button class="avatar" id="me" title="${esc(S.me.username)}">${esc(initial)}</button>` : ""}
    </div>
  </header>
  <main id="view"></main>
  <footer class="ver-foot">${versionsHtml()}</footer>
  <nav class="tabbar">${NAV.filter(([k]) => k !== "lotes").map(([k, t, i]) => `<a href="#/${k}" data-r="${k}">${icon(i)}${t}</a>`).join("")}</nav>`;
  $("#theme").onclick = () => {
    const now = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem("qp-theme", now); applyTheme();
    $("#theme").innerHTML = icon(now === "dark" ? "sun" : "moon");
    if (location.hash.startsWith("#/estadisticas")) route();
  };
  $("#me")?.addEventListener("click", (e) => menu(e.currentTarget, [
    { icon: "user", label: S.me.username + (S.me.is_admin ? " · admin" : ""), run: () => (location.hash = "#/ajustes") },
    { icon: "key", label: "Cambiar contraseña", run: changePassword },
    "-",
    { icon: "info", label: versionsText(), run: () => (location.hash = "#/ajustes") },
    "-",
    { icon: "logout", label: "Salir", danger: true, run: async () => { await S.store.logout(); location.reload(); } },
  ]));
}

let cleanup = null;
function route() {
  cleanup?.(); cleanup = null;
  for (const x of $$(".dlg-wrap,.menu,.tip")) x.remove();
  const [, r = "crear", arg] = location.hash.split("/");
  $$("[data-r]").forEach((a) => a.classList.toggle("on", a.dataset.r === (r === "editar" ? "crear" : r)));
  const v = $("#view");
  v.className = "view"; void v.offsetWidth; v.className = "view";
  window.scrollTo({ top: 0 });
  ({ crear: viewCreate, editar: viewCreate, biblioteca: viewLibrary, escanear: viewScan, lotes: viewBatch, estadisticas: viewStats, ajustes: viewSettings }[r] || viewCreate)(v, arg);
}
addEventListener("hashchange", route);

// --- utilidades de QR -------------------------------------------------------------
function logoSrc(design) {
  const l = design?.logo;
  if (!l) return null;
  if (l.id != null) return S.logos.find((x) => x.id === l.id)?.data || l.src || null;
  return l.src || null;
}
function renderQR(q, extra = {}) {
  try { return render(q.content || " ", q.design, { logoSrc: logoSrc(q.design), ...extra }).svg; }
  catch { return `<svg viewBox="0 0 10 10"><text x="5" y="5" font-size="2" text-anchor="middle">Error</text></svg>`; }
}
async function exportQR(q, fmt = "png", size = 1024) {
  const svg = render(q.content || " ", q.design, { logoSrc: logoSrc(q.design) }).svg;
  if (fmt === "svg") return new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${svg}`], { type: "image/svg+xml" });
  if (fmt === "pdf") {
    const cv = await svgToCanvas(svg, Math.max(size, 2048), "#ffffff");
    const jpg = await new Promise((res) => cv.toBlob(res, "image/jpeg", 0.95));
    return makePdf(jpg, cv.width, cv.height, q.name || "QR");
  }
  const solidBg = fmt === "jpg" ? "#ffffff" : null;
  const cv = await svgToCanvas(svg, size, solidBg);
  const mime = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" }[fmt] || "image/png";
  return new Promise((res) => cv.toBlob(res, mime, 0.95));
}
const EXT = { png: "png", jpg: "jpg", webp: "webp", svg: "svg", pdf: "pdf" };

// =============================================================================
// CREAR / EDITAR
// =============================================================================
const SAMPLE = "QRPanel";
function newEditor() {
  const draft = JSON.parse(localStorage.getItem("qp-draft") || "null");
  return draft || { id: null, name: "", kind: "url", fields: { url: { url: "" } }, design: structuredClone(DEFAULT_DESIGN), dynamic: false, code: "", active: true, expires: null, max_scans: null, folder: "", favorite: false };
}
function randCode() { const a = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"; return Array.from({ length: 6 }, () => a[(Math.random() * a.length) | 0]).join(""); }

let E = null;          // estado del editor
let pendingLoad = null; // contenido que llega desde el escaner

function viewCreate(v, arg) {
  if (arg) {
    const q = S.qrs.find((x) => String(x.id) === arg);
    if (!q) { toast("Ese QR ya no existe", "bad"); location.hash = "#/biblioteca"; return; }
    E = { id: q.id, name: q.name, kind: q.kind, fields: { [q.kind]: structuredClone(q.fields || {}) }, design: mergeDesign(q.design), dynamic: q.dynamic, code: q.code || "", active: q.active, expires: q.expires, max_scans: q.max_scans, has_pin: !!q.has_pin, folder: q.folder || "", favorite: q.favorite, short_url: q.short_url, content: q.content };
  } else if (!E || E.id) {
    E = newEditor();
  }
  if (pendingLoad) { E = { ...newEditor(), id: null, kind: pendingLoad.kind, fields: { [pendingLoad.kind]: pendingLoad.fields }, name: pendingLoad.title }; pendingLoad = null; }
  E.design = mergeDesign(E.design);
  const hist = { past: [], future: [], last: JSON.stringify(E.design) };
  const canDyn = S.store.mode === "server";

  v.innerHTML = `
  <div class="page-head"><div><h1>${E.id ? "Editar QR" : "Crea tu QR"}</h1><p>${E.id ? esc(E.name) : "Elige qué guarda, dale tu estilo y descárgalo. Todo se ve al momento."}</p></div>
    <div class="row">
      <button class="btn ghost icon" id="undo" title="Deshacer (Ctrl+Z)">${icon("undo")}</button>
      <button class="btn ghost icon" id="redo" title="Rehacer (Ctrl+Y)">${icon("redo")}</button>
      ${E.id ? `<button class="btn" id="new">${icon("plus")}Nuevo</button>` : `<button class="btn ghost" id="reset">Empezar de cero</button>`}
    </div></div>
  <div class="editor">
    <div class="steps">
      ${step(1, "content", "Contenido", true, `
        <div class="types">${Object.entries(TYPES).map(([k, t]) => `<button class="type" data-kind="${k}">${icon(t.icon, "lg")}${t.name}</button>`).join("")}</div>
        <div class="form" id="form"></div>
        ${canDyn ? `<div class="dyn-box" id="dynbox">
          <label class="switch"><input type="checkbox" id="dyn"><i></i><span>QR dinámico</span><span class="tag">GRATIS</span></label>
          <div class="small muted" id="dyn-help">Podrás cambiar el destino cuando quieras sin reimprimir el QR, y verás cuántas veces lo escanean.</div>
          <div id="dyn-opts" class="form hidden">
            <label class="field half"><span>Código corto</span><input id="code" maxlength="40" placeholder="abc123"></label>
            <label class="field half"><span>Estado</span><select id="active"><option value="1">Activo</option><option value="0">En pausa</option></select></label>
            <div class="field"><span>Caducidad</span><div class="seg" id="expseg"><button type="button" data-v="no">No caduca</button><button type="button" data-v="date">En una fecha</button><button type="button" data-v="scans">Tras X lecturas</button></div></div>
            <div class="field exp-date hidden" id="exp-date"><div class="row" style="flex-wrap:wrap"><input id="expires" type="date" style="flex:1;min-width:140px"><input id="exptime" type="time" style="width:110px">
              <button type="button" class="btn sm ghost" data-plus="1">+1 día</button><button type="button" class="btn sm ghost" data-plus="7">+1 semana</button><button type="button" class="btn sm ghost" data-plus="30">+1 mes</button></div></div>
            <label class="field hidden" id="exp-scans"><span>Deja de funcionar después de</span><div class="row"><input id="maxs" type="number" min="1" placeholder="100" style="flex:1"><span class="small muted">lecturas</span></div></label>
            <div class="field small muted hidden" id="exp-info"></div>
            <label class="switch field"><input type="checkbox" id="pinon"><i></i><span>${icon("lock", "sm")} Pedir un PIN para abrirlo</span></label>
            <label class="field hidden" id="pinbox"><span>PIN (4 a 32 letras o números)</span><input id="pin" maxlength="32" autocomplete="new-password" inputmode="text" placeholder="1234"></label>
            <div class="field small muted hidden" id="pin-info">Quien escanee el QR verá una página pidiendo el PIN antes de llegar al destino. Tras 5 fallos tendrá que esperar 15 minutos.</div>
            <div class="field small muted" id="dyn-url"></div>
          </div></div>` : `<div class="small muted">${icon("info", "sm")} Los QR dinámicos (con estadísticas) necesitan el servidor de QRPanel.</div>`}
      `)}
      ${step(2, "style", "Estilo rápido", true, `
        <div class="row between"><span class="label">Plantillas</span>
          <div class="row"><button class="btn sm dice" id="dice">${icon("dice", "sm")}Sorpréndeme</button><button class="btn sm" id="savetpl">${icon("save", "sm")}Guardar la mía</button></div></div>
        <div class="tpls" id="tpls"></div>
      `)}
      ${step(3, "dots", "Módulos y ojos", false, `
        <span class="label">Forma de los módulos</span><div class="opts" id="o-dots"></div>
        <div class="range"><span class="small muted">Tamaño</span><input type="range" min="0.6" max="1.05" step="0.05" id="dscale"><output id="dscale-o"></output></div>
        <span class="label">Marco de los ojos</span><div class="opts" id="o-frame"></div>
        <span class="label">Centro de los ojos</span><div class="opts" id="o-ball"></div>
      `)}
      ${step(4, "colors", "Colores", false, `
        <div class="colors">
          ${colorSet("fg", "Color del QR", ["solid", "linear", "radial"])}
          ${colorSet("bg", "Fondo", ["solid", "linear", "radial", "none"])}
        </div>
        <label class="switch"><input type="checkbox" id="eyecustom"><i></i><span>Ojos de otro color</span></label>
        <div class="row hidden" id="eyecols">${cpick("eyes.frameColor", "Marco")}${cpick("eyes.ballColor", "Centro")}</div>
        <div class="range"><span class="small muted">Esquinas del fondo</span><input type="range" min="0" max="0.3" step="0.01" id="bgrad"><output id="bgrad-o"></output></div>
      `)}
      ${step(5, "logo", "Logo o imagen", false, `
        <div class="drop" id="drop" tabindex="0"><div class="thumb" id="lthumb">${icon("image", "lg")}</div>
          <div><b>Sube tu logo</b><div class="small muted">Arrastra una imagen, pégala (Ctrl+V) o pulsa aquí. PNG, JPG, WebP o SVG.</div></div>
          <input type="file" id="lfile" accept="image/*" hidden></div>
        <span class="label">Iconos rápidos</span><div class="logos" id="quick"></div>
        <div id="mylogos-w"><span class="label">Mis logos</span><div class="logos" id="mylogos"></div></div>
        <div id="logo-opts" class="steps" style="gap:10px">
          <div class="range"><span class="small muted">Tamaño</span><input type="range" min="0.12" max="0.32" step="0.01" id="lsize"><output id="lsize-o"></output></div>
          <div class="range"><span class="small muted">Espacio libre</span><input type="range" min="0" max="3" step="0.5" id="lpad"><output id="lpad-o"></output></div>
          <div class="row"><label class="switch"><input type="checkbox" id="lplate"><i></i><span>Fondo detrás del logo</span></label>${cpick("logo.plateColor", "")}</div>
          <div class="range"><span class="small muted">Redondeo</span><input type="range" min="0" max="1" step="0.05" id="lround"><output id="lround-o"></output></div>
          <label class="switch"><input type="checkbox" id="lexc"><i></i><span>Quitar los módulos de debajo</span></label>
          <button class="btn sm danger" id="lremove" style="align-self:flex-start">${icon("trash", "sm")}Quitar logo</button>
        </div>
      `)}
      ${step(6, "frame", "Marco y texto", false, `
        <div class="opts" id="o-fstyle"></div>
        <div class="form" id="fopts">
          <label class="field"><span>Texto</span><input id="ftext" maxlength="40" placeholder="ESCANÉAME"></label>
          <label class="field half"><span>Letra</span><select id="ffont"><option value="sans">Moderna</option><option value="rounded">Redondeada</option><option value="serif">Clásica</option><option value="mono">Máquina</option></select></label>
          <div class="field half"><span>Colores</span><div class="row">${cpick("frame.color", "")}${cpick("frame.textColor", "")}</div></div>
        </div>
      `)}
      ${step(7, "adv", "Avanzado", false, `
        <span class="label">Corrección de errores</span>
        <div class="seg" id="ecc">${[["L", "Baja 7%"], ["M", "Media 15%"], ["Q", "Alta 25%"], ["H", "Máx. 30%"]].map(([k, t]) => `<button data-v="${k}">${t}</button>`).join("")}</div>
        <div class="small muted">Más corrección = se lee aunque esté dañado o tenga logo, pero salen más módulos. Con logo se usa «Alta» o «Máx.» automáticamente.</div>
        <div class="range"><span class="small muted">Margen</span><input type="range" min="0" max="8" step="1" id="margin"><output id="margin-o"></output></div>
      `)}
    </div>

    <aside class="preview">
      <div class="stage" id="stage"><div class="tilt" id="tilt"><div class="qrbox" id="qrbox"></div><div class="shine"></div><div class="scanline"></div></div>
        <div class="stage-meta"><span id="m-info"></span><span id="m-chips"></span></div></div>
      <div class="card meter" id="meter"><div class="gauge"><svg viewBox="0 0 64 64"><circle class="bgc" cx="32" cy="32" r="27"/><circle class="fgc" cx="32" cy="32" r="27" stroke-dasharray="169.6" stroke-dashoffset="169.6"/></svg><b id="g-n">–</b></div>
        <div class="grow"><h4><span class="st" id="g-st">Comprobando…</span></h4><div class="small muted" id="g-sub">Leo el QR como lo haría un móvil.</div><ul id="g-tips"></ul></div></div>
      <div class="card dl">
        <label class="field half"><span>Formato</span><select id="fmt"><option value="png">PNG</option><option value="svg">SVG (vectorial)</option><option value="jpg">JPG</option><option value="webp">WebP</option><option value="pdf">PDF (para imprimir)</option></select></label>
        <label class="field half"><span>Tamaño</span><select id="size"><option value="512">512 px</option><option value="1024" selected>1024 px</option><option value="2048">2048 px</option><option value="4096">4096 px (imprenta)</option></select></label>
        <label class="field full"><span>Nombre</span><input id="name" maxlength="120" placeholder="Mi QR"></label>
        <div class="actions full">
          <button class="btn primary" id="save">${icon("save")}${E.id ? "Guardar cambios" : "Guardar"}</button>
          <button class="btn" id="dl">${icon("download")}Descargar</button>
        </div>
        <div class="actions full">
          <button class="btn sm ghost" id="copy">${icon("copy", "sm")}Copiar imagen</button>
          <button class="btn sm ghost" id="share">${icon("share", "sm")}Compartir</button>
          <button class="btn sm ghost" id="copytxt">${icon("text", "sm")}Copiar texto</button>
          ${E.id && S.store.mode === "server" ? `<button class="btn sm ghost" id="shlink">${icon("link", "sm")}Enlace</button>` : ""}
        </div>
        <button class="btn full p3d-btn" id="p3d">${icon("cube")}Imprimir en 3D <span class="small muted">STL · 3MF</span></button>
      </div>
    </aside>
  </div>`;

  // --- secciones plegables
  $$(".step-h", v).forEach((b) => b.addEventListener("click", () => b.parentElement.classList.toggle("open")));

  // --- contenido
  const formEl = $("#form", v);
  function drawForm() {
    $$(".type", v).forEach((b) => b.classList.toggle("on", b.dataset.kind === E.kind));
    const t = TYPES[E.kind], f = (E.fields[E.kind] ||= {});
    formEl.innerHTML = t.fields.map((fd) => {
      const val = esc(f[fd.k] ?? "");
      const cls = `field ${fd.half ? "half" : ""}`;
      if (fd.type === "textarea") return `<label class="${cls}"><span>${fd.label}</span><textarea data-f="${fd.k}" placeholder="${esc(fd.ph || "")}" maxlength="2000">${val}</textarea></label>`;
      if (fd.type === "select") return `<label class="${cls}"><span>${fd.label}</span><select data-f="${fd.k}">${fd.options.map(([k, l]) => `<option value="${k}" ${f[fd.k] === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>`;
      if (fd.type === "check") return `<label class="${cls} switch"><input type="checkbox" data-f="${fd.k}" ${f[fd.k] ? "checked" : ""}><i></i><span>${fd.label}</span></label>`;
      if (fd.type === "button") return `<div class="${cls}"><button class="btn sm" data-act="${fd.action}" style="align-self:flex-start">${icon("pin", "sm")}${fd.label}</button></div>`;
      if (fd.type === "password") return `<label class="${cls}"><span>${fd.label}</span><div class="pw"><input type="password" data-f="${fd.k}" value="${val}" placeholder="${esc(fd.ph || "")}" maxlength="200"><button type="button" data-eye>${icon("eye", "sm")}</button></div></label>`;
      return `<label class="${cls}"><span>${fd.label}${fd.req ? "" : ' <span class="faint">(opcional)</span>'}</span><input data-f="${fd.k}" type="${fd.type || "text"}" value="${val}" placeholder="${esc(fd.ph || "")}" maxlength="1000"></label>`;
    }).join("");
    updDyn();
  }
  formEl.addEventListener("input", (e) => {
    const k = e.target.dataset.f; if (!k) return;
    E.fields[E.kind][k] = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    refresh();
  });
  formEl.addEventListener("change", (e) => { if (e.target.dataset.f && e.target.tagName === "SELECT") { E.fields[E.kind][e.target.dataset.f] = e.target.value; refresh(); } });
  formEl.addEventListener("click", (e) => {
    const eye = e.target.closest("[data-eye]");
    if (eye) { const i = eye.previousElementSibling; i.type = i.type === "password" ? "text" : "password"; eye.innerHTML = icon(i.type === "password" ? "eye" : "eyeoff", "sm"); }
    if (e.target.closest('[data-act="geo"]')) {
      if (!navigator.geolocation) return toast("Este navegador no da la ubicación", "bad");
      navigator.geolocation.getCurrentPosition((p) => {
        E.fields.geo = { ...E.fields.geo, lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) };
        drawForm(); refresh();
      }, () => toast("No he podido saber dónde estás (permiso denegado o sin GPS)", "bad"));
    }
  });
  $$(".type", v).forEach((b) => b.addEventListener("click", () => { E.kind = b.dataset.kind; drawForm(); refresh(); }));

  // --- dinamico
  const until = (ts) => { const m = Math.round((ts * 1000 - Date.now()) / 60000); return m < 60 ? `dentro de ${Math.max(1, m)} min` : m < 1440 * 2 ? `dentro de ${Math.round(m / 60)} h` : `dentro de ${Math.round(m / 1440)} días`; };
  function updDyn() {
    const box = $("#dynbox", v); if (!box) return;
    const ok = !!TYPES[E.kind].dyn;
    box.classList.toggle("hidden", !ok);
    if (!ok && E.dynamic) E.dynamic = false;
    $("#dyn", v).checked = E.dynamic;
    $("#dyn-opts", v).classList.toggle("hidden", !E.dynamic);
    if (E.dynamic && !E.code) E.code = randCode();
    $("#code", v).value = E.code || "";
    $("#active", v).value = E.active ? "1" : "0";
    if (!E.expMode) E.expMode = E.expires ? "date" : E.max_scans ? "scans" : "no";
    $$("#expseg button", v).forEach((b) => b.classList.toggle("on", b.dataset.v === E.expMode));
    $("#exp-date", v).classList.toggle("hidden", E.expMode !== "date");
    $("#exp-scans", v).classList.toggle("hidden", E.expMode !== "scans");
    const ed = E.expires ? new Date(E.expires * 1000) : null, pad = (n) => String(n).padStart(2, "0");
    $("#expires", v).value = ed ? `${ed.getFullYear()}-${pad(ed.getMonth() + 1)}-${pad(ed.getDate())}` : "";
    $("#exptime", v).value = ed ? `${pad(ed.getHours())}:${pad(ed.getMinutes())}` : "23:59";
    $("#maxs", v).value = E.max_scans || "";
    const info = $("#exp-info", v);
    info.classList.toggle("hidden", E.expMode === "no");
    if (E.expMode === "date") info.innerHTML = E.expires ? (E.expires * 1000 < Date.now() ? `<span style="color:var(--bad)">Ya ha caducado.</span> Cambia la fecha para que vuelva a funcionar.` : `Funciona hasta el <b>${esc(ed.toLocaleString("es", { dateStyle: "long", timeStyle: "short" }))}</b> (${esc(until(E.expires))}). Luego mostrará «Este QR ha caducado».`) : "Elige el día en que deja de funcionar.";
    if (E.expMode === "scans") info.innerHTML = E.max_scans ? `Cuando lo escaneen <b>${fmtN(E.max_scans)}</b> veces dejará de funcionar${E.id ? ` (lleva ${fmtN(S.qrs.find((x) => x.id === E.id)?.scans || 0)})` : ""}.` : "Escribe cuántas lecturas se permiten.";
    const pinOn = E.pinOn ?? !!E.has_pin;
    $("#pinon", v).checked = pinOn;
    $("#pinbox", v).classList.toggle("hidden", !pinOn); $("#pin-info", v).classList.toggle("hidden", !pinOn);
    $("#pin", v).placeholder = E.has_pin ? "Déjalo vacío para mantener el PIN actual" : "1234";
    const base = S.me.public_url || location.origin;
    $("#dyn-url", v).innerHTML = E.dynamic ? `El QR llevará <b>${esc(base)}/r/${esc(E.code)}</b> y te redirigirá a tu destino.${/\/\/(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(base) ? `<br><span style="color:var(--warn)">${icon("alert", "sm")} Esa dirección solo funciona en tu red de casa. Pon tu dirección pública en Ajustes para que funcione desde cualquier móvil.</span>` : ""}` : "";
  }
  if (canDyn) {
    $("#dyn", v).addEventListener("change", (e) => { E.dynamic = e.target.checked; updDyn(); refresh(); if (E.dynamic) $("#stage").animate([{ transform: "scale(1)" }, { transform: "scale(1.03)" }, { transform: "scale(1)" }], { duration: 400 }); });
    $("#code", v).addEventListener("input", (e) => { E.code = e.target.value.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40); updDyn(); refresh(); });
    $("#active", v).addEventListener("change", (e) => { E.active = e.target.value === "1"; refresh(); });
    const setExp = () => { const d = $("#expires", v).value; E.expires = d ? new Date(`${d}T${$("#exptime", v).value || "23:59"}:59`).getTime() / 1000 : null; updDyn(); };
    $("#expseg", v).addEventListener("click", (e) => {
      const b = e.target.closest("[data-v]"); if (!b) return;
      E.expMode = b.dataset.v;
      if (E.expMode !== "date") E.expires = null;
      if (E.expMode !== "scans") E.max_scans = null;
      if (E.expMode === "date" && !E.expires) { const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(23, 59, 59, 0); E.expires = d.getTime() / 1000; }
      updDyn();
    });
    $("#exp-date", v).addEventListener("click", (e) => {
      const b = e.target.closest("[data-plus]"); if (!b) return;
      const base = E.expires && E.expires * 1000 > Date.now() ? new Date(E.expires * 1000) : new Date();
      base.setDate(base.getDate() + +b.dataset.plus); E.expires = base.getTime() / 1000; updDyn();
    });
    $("#expires", v).addEventListener("change", setExp);
    $("#exptime", v).addEventListener("change", setExp);
    $("#maxs", v).addEventListener("input", (e) => { E.max_scans = +e.target.value || null; const i = $("#exp-info", v); i.innerHTML = E.max_scans ? `Cuando lo escaneen <b>${fmtN(E.max_scans)}</b> veces dejará de funcionar.` : "Escribe cuántas lecturas se permiten."; });
    $("#pinon", v).addEventListener("change", (e) => { E.pinOn = e.target.checked; if (!E.pinOn) E.pin = ""; updDyn(); if (E.pinOn && !E.has_pin) $("#pin", v).focus(); });
    $("#pin", v).addEventListener("input", (e) => { E.pin = e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 32); if (e.target.value !== E.pin) e.target.value = E.pin; });
  }

  // --- opciones de diseño
  const sampleSvg = (design) => render(SAMPLE, { ...design, logo: { src: null }, frame: { style: "none" }, margin: 1 }).svg;
  function optGrid(el, list, get, set, preview) {
    el.innerHTML = list.map(([k, t]) => `<button class="opt" data-v="${k}" title="${t}">${preview(k)}<span class="cap">${t}</span></button>`).join("");
    el.addEventListener("click", (e) => { const b = e.target.closest(".opt"); if (b) { set(b.dataset.v); commit(); } });
    return () => $$(".opt", el).forEach((b) => b.classList.toggle("on", b.dataset.v === get()));
  }
  const mono = { fg: { type: "solid", c1: "currentColor" }, bg: { type: "none" }, eyes: { custom: false } };
  const eyeOnly = (frame, ball) => {
    const sv = render(SAMPLE, { ...mono, eyes: { frame, ball, custom: false }, dots: { shape: "square" }, margin: 0 }).svg;
    return sv.replace(/viewBox="[^"]+"/, 'viewBox="-0.5 -0.5 8 8"').replace(/currentColor/g, "currentColor");
  };
  const fix = (s) => s.replace(/fill="#000000"/g, 'fill="currentColor"');
  const refreshers = [
    optGrid($("#o-dots", v), DOT_SHAPES, () => E.design.dots.shape, (x) => (E.design.dots.shape = x),
      (k) => shapeSample(k)),
    optGrid($("#o-frame", v), FRAME_SHAPES, () => E.design.eyes.frame, (x) => (E.design.eyes.frame = x), (k) => fix(eyeOnly(k, "square").replace(/currentColor/g, "#000000"))),
    optGrid($("#o-ball", v), BALL_SHAPES, () => E.design.eyes.ball, (x) => (E.design.eyes.ball = x), (k) => fix(eyeOnly("square", k).replace(/currentColor/g, "#000000"))),
    optGrid($("#o-fstyle", v), FRAMES, () => E.design.frame.style, (x) => (E.design.frame.style = x),
      (k) => k === "none" ? icon("x", "lg") : render(SAMPLE, { dots: { shape: "square" }, eyes: { frame: "square", ball: "square" }, fg: { type: "solid", c1: "#64748b" }, frame: { style: k, text: "", color: "#64748b" }, margin: 1 }, { cut: "transparent" }).svg),
  ];
  function drawTemplates() {
    const all = [...PRESETS.map((p, i) => ({ ...p, key: "p" + i })), ...S.templates.map((t) => ({ ...t, key: "t" + t.id, mine: t.id }))];
    $("#tpls", v).innerHTML = all.map((p) => `<button class="tpl" data-k="${p.key}"><div class="mini">${sampleSvg(mergeDesign(p.design))}</div>${esc(p.name)}${p.mine ? `<span class="x" data-del="${p.mine}" title="Borrar">${icon("x", "sm")}</span>` : ""}</button>`).join("");
    $("#tpls", v).onclick = async (e) => {
      const del = e.target.closest("[data-del]");
      if (del) {
        e.stopPropagation();
        if (await confirmDlg("¿Borrar plantilla?", "Los QR que ya la usan no cambian.")) {
          await S.store.delTemplate(+del.dataset.del); S.templates = S.templates.filter((t) => t.id !== +del.dataset.del); drawTemplates();
        }
        return;
      }
      const b = e.target.closest(".tpl"); if (!b) return;
      const p = all.find((x) => x.key === b.dataset.k);
      const keep = { logo: E.design.logo, frame: { ...E.design.frame, ...(p.design.frame || {}) }, ecc: E.design.ecc, margin: E.design.margin };
      E.design = mergeDesign({ ...structuredClone(p.design), ...keep });
      $$(".tpl", v).forEach((x) => x.classList.toggle("on", x === b));
      commit();
    };
  }
  drawTemplates();
  $("#dice", v).addEventListener("click", (e) => {
    const b = e.currentTarget; b.classList.remove("roll"); void b.offsetWidth; b.classList.add("roll");
    E.design = mergeDesign({ ...surprise(), logo: E.design.logo, frame: E.design.frame, ecc: E.design.ecc, margin: E.design.margin });
    commit();
  });
  $("#savetpl", v).addEventListener("click", async () => {
    const name = await promptDlg("Guardar plantilla", "Nombre de la plantilla", "", "Mi estilo");
    if (name == null) return;
    const d = structuredClone(E.design); d.logo = { ...d.logo }; // el logo se guarda tambien
    try { const t = await S.store.addTemplate(name || "Mi plantilla", d); S.templates.unshift(t); drawTemplates(); toast("Plantilla guardada"); }
    catch (err) { toast(err.message, "bad"); }
  });

  // colores
  function colorSet(key, title, types) {
    const names = { solid: "Sólido", linear: "Degradado", radial: "Radial", none: "Sin fondo" };
    return `<div class="colorset" data-cs="${key}"><div class="row between"><b>${title}</b></div>
      <div class="seg" data-type="${key}">${types.map((t) => `<button data-v="${t}">${names[t]}</button>`).join("")}</div>
      <div class="row">${cpick(key + ".c1", "")}<span data-c2="${key}">${cpick(key + ".c2", "")}</span></div>
      <div class="range" data-ang="${key}"><span class="small muted">Ángulo</span><input type="range" min="0" max="360" step="15" data-angle="${key}"><output></output></div>
      <div class="swatches" data-sw="${key}">${(key === "fg" ? ["#000000", "#0f172a", "#4c1d95", "#1e3a8a", "#065f46", "#7f1d1d", "#9a3412", "#831843"] : ["#ffffff", "#f8fafc", "#fef3c7", "#ecfeff", "#f0fdf4", "#fdf2f8", "#f5f3ff", "#fff7ed"]).map((c) => `<button class="sw" style="background:${c}" data-c="${c}" title="${c}"></button>`).join("")}</div></div>`;
  }
  function cpick(path, label) {
    return `<div class="cpick" data-cp="${path}">${label ? `<span class="small muted">${label}</span>` : ""}<input type="color"><input type="text" maxlength="7" spellcheck="false"></div>`;
  }
  const getP = (p) => p.split(".").reduce((o, k) => o[k], E.design);
  const setP = (p, val) => { const ks = p.split("."), last = ks.pop(); ks.reduce((o, k) => o[k], E.design)[last] = val; };
  v.addEventListener("input", (e) => {
    const cp = e.target.closest("[data-cp]");
    if (cp) {
      let val = e.target.value.trim();
      if (e.target.type === "text") { if (!/^#?[0-9a-fA-F]{6}$/.test(val)) return; if (val[0] !== "#") val = "#" + val; }
      setP(cp.dataset.cp, val.toLowerCase()); syncDesign(false); refresh(); return;
    }
    if (e.target.dataset.angle) { E.design[e.target.dataset.angle].angle = +e.target.value; syncDesign(false); refresh(); }
  });
  v.addEventListener("click", (e) => {
    const sw = e.target.closest("[data-c]");
    if (sw) { const k = sw.parentElement.dataset.sw; E.design[k].c1 = sw.dataset.c; if (E.design[k].type === "none") E.design[k].type = "solid"; commit(); return; }
    const sg = e.target.closest(".seg[data-type] button");
    if (sg) { E.design[sg.parentElement.dataset.type].type = sg.dataset.v; commit(); return; }
    const ec = e.target.closest("#ecc button");
    if (ec) { E.design.ecc = ec.dataset.v; commit(); }
  });
  const ranges = [["dscale", "dots.scale", (x) => Math.round(x * 100) + "%"], ["bgrad", "bg.radius", (x) => Math.round(x * 100) + "%"], ["lsize", "logo.size", (x) => Math.round(x * 100) + "%"], ["lpad", "logo.pad", (x) => x], ["lround", "logo.round", (x) => Math.round(x * 100) + "%"], ["margin", "margin", (x) => x]];
  for (const [id, path, fmt] of ranges) {
    $("#" + id, v).addEventListener("input", (e) => { setP(path, +e.target.value); $("#" + id + "-o", v).textContent = fmt(+e.target.value); refresh(); });
    $("#" + id, v).addEventListener("change", () => pushHist());
  }
  const toggles = [["eyecustom", "eyes.custom"], ["lplate", "logo.plate"], ["lexc", "logo.excavate"]];
  for (const [id, path] of toggles) $("#" + id, v).addEventListener("change", (e) => { setP(path, e.target.checked); commit(); });
  $("#ftext", v).addEventListener("input", (e) => { E.design.frame.text = e.target.value; refresh(); });
  $("#ffont", v).addEventListener("change", (e) => { E.design.frame.font = e.target.value; commit(); });

  // logo
  const QUICK = [["link", "#2563eb"], ["wifi", "#0891b2"], ["mail", "#7c3aed"], ["phone", "#16a34a"], ["chat", "#22c55e"], ["pin", "#dc2626"], ["calendar", "#ea580c"], ["user", "#0f172a"], ["heart", "#e11d48"], ["star", "#f59e0b"], ["cart", "#4f46e5"], ["camera", "#db2777"], ["music", "#9333ea"], ["gift", "#be123c"], ["coffee", "#92400e"], ["globe", "#0369a1"]];
  $("#quick", v).innerHTML = QUICK.map(([n, c]) => `<button class="logo-it" data-q="${n}" data-c="${c}" title="${n}"><img src="${quickLogo(n, c)}" alt=""></button>`).join("");
  $("#quick", v).addEventListener("click", (e) => {
    const b = e.target.closest("[data-q]"); if (!b) return;
    e.stopPropagation();
    E.design.logo = { ...E.design.logo, src: quickLogo(b.dataset.q, b.dataset.c), id: null, plate: true, plateColor: "#ffffff", round: 1 };
    if (E.design.ecc === "L" || E.design.ecc === "M") E.design.ecc = "Q";
    commit();
  });
  function drawLogos() {
    $("#mylogos-w", v).classList.toggle("hidden", !S.logos.length);
    $("#mylogos", v).innerHTML = S.logos.map((l) => `<button class="logo-it ${E.design.logo.id === l.id ? "on" : ""}" data-l="${l.id}" title="${esc(l.name)}"><img src="${esc(l.data)}" alt=""><span class="x" data-dl="${l.id}">${icon("x", "sm")}</span></button>`).join("");
    const src = logoSrc(E.design);
    $("#lthumb", v).innerHTML = src ? `<img src="${esc(src)}" alt="">` : icon("image", "lg");
    $("#logo-opts", v).classList.toggle("hidden", !src);
  }
  $("#mylogos", v).addEventListener("click", async (e) => {
    const d = e.target.closest("[data-dl]");
    if (d) {
      e.stopPropagation();
      if (!(await confirmDlg("¿Borrar este logo?", "Los QR que lo usan se quedarán sin logo."))) return;
      await S.store.delLogo(+d.dataset.dl); S.logos = S.logos.filter((l) => l.id !== +d.dataset.dl);
      if (E.design.logo.id === +d.dataset.dl) E.design.logo.id = null;
      commit(); return;
    }
    const b = e.target.closest("[data-l]"); if (!b) return;
    E.design.logo = { ...E.design.logo, id: +b.dataset.l, src: null };
    if (E.design.ecc === "L" || E.design.ecc === "M") E.design.ecc = "Q";
    commit();
  });
  async function addLogoFile(file) {
    try {
      const data = await readImage(file, 512);
      const l = await S.store.addLogo((file.name || "Logo").replace(/\.[^.]+$/, "").slice(0, 60), data);
      S.logos.unshift(l);
      E.design.logo = { ...E.design.logo, id: l.id, src: null };
      if (E.design.ecc === "L" || E.design.ecc === "M") E.design.ecc = "H";
      $("#s-logo", v)?.classList.add("open");
      commit(); toast("Logo añadido");
    } catch (err) { toast(err.message, "bad"); }
  }
  const drop = $("#drop", v), lfile = $("#lfile", v);
  drop.addEventListener("click", () => lfile.click());
  drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); lfile.click(); } });
  lfile.addEventListener("change", () => { if (lfile.files[0]) addLogoFile(lfile.files[0]); lfile.value = ""; });
  ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => { const f = e.dataTransfer.files[0]; if (f) addLogoFile(f); });
  const onPaste = (e) => {
    const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith("image/"));
    if (f && !e.target.closest("input,textarea")) { e.preventDefault(); addLogoFile(f); }
  };
  document.addEventListener("paste", onPaste);
  $("#lremove", v).addEventListener("click", () => { E.design.logo = { ...E.design.logo, id: null, src: null }; commit(); });

  // --- sincronizar controles con el diseño
  function syncDesign(all = true) {
    const D = E.design;
    refreshers.forEach((f) => f());
    for (const [id, path, fmt] of ranges) { const val = getP(path); $("#" + id, v).value = val; $("#" + id + "-o", v).textContent = fmt(+val); }
    for (const [id, path] of toggles) $("#" + id, v).checked = !!getP(path);
    $("#eyecols", v).classList.toggle("hidden", !D.eyes.custom);
    for (const k of ["fg", "bg"]) {
      $$(`.seg[data-type="${k}"] button`, v).forEach((b) => b.classList.toggle("on", b.dataset.v === D[k].type));
      $(`[data-c2="${k}"]`, v).classList.toggle("hidden", D[k].type === "solid" || D[k].type === "none");
      $(`[data-ang="${k}"]`, v).classList.toggle("hidden", D[k].type !== "linear");
      const a = $(`[data-angle="${k}"]`, v); a.value = D[k].angle || 0; a.nextElementSibling.textContent = (D[k].angle || 0) + "°";
      $(`[data-cs="${k}"] .cpick:first-of-type`, v);
    }
    $$("[data-cp]", v).forEach((cp) => {
      const val = getP(cp.dataset.cp) || "#000000";
      const [c, t] = cp.querySelectorAll("input");
      if (document.activeElement !== t) t.value = val;
      c.value = /^#[0-9a-f]{6}$/i.test(val) ? val : "#000000";
    });
    $$("#ecc button", v).forEach((b) => b.classList.toggle("on", b.dataset.v === D.ecc));
    if (all) { $("#ftext", v).value = D.frame.text || ""; $("#ffont", v).value = D.frame.font || "sans"; }
    $("#fopts", v).classList.toggle("hidden", D.frame.style === "none");
    drawLogos();
  }

  // --- historial (deshacer / rehacer)
  function pushHist() {
    const now = JSON.stringify(E.design);
    if (now === hist.last) return;
    hist.past.push(hist.last); if (hist.past.length > 80) hist.past.shift();
    hist.future = []; hist.last = now; updHistBtns();
  }
  function updHistBtns() { $("#undo", v).disabled = !hist.past.length; $("#redo", v).disabled = !hist.future.length; }
  function undo() { if (!hist.past.length) return; hist.future.push(hist.last); hist.last = hist.past.pop(); E.design = JSON.parse(hist.last); syncDesign(); draw(); updHistBtns(); }
  function redo() { if (!hist.future.length) return; hist.past.push(hist.last); hist.last = hist.future.pop(); E.design = JSON.parse(hist.last); syncDesign(); draw(); updHistBtns(); }
  $("#undo", v).onclick = undo; $("#redo", v).onclick = redo;
  const debHist = debounce(pushHist, 500);

  function commit() { syncDesign(false); pushHist(); draw(true); saveDraft(); }

  // --- vista previa
  const qrbox = $("#qrbox", v);
  function content() {
    if (E.dynamic) return `${E.id && E.content && E.short_url && E.content.endsWith("/r/" + E.code) ? E.content.replace(/\/r\/.*$/, "") : (S.me.public_url || location.origin)}/r/${E.code}`;
    return encode(E.kind, E.fields[E.kind] || {});
  }
  let lastContent = "";
  function draw(pop = false) {
    const c = content() || " ";
    const empty = !encode(E.kind, E.fields[E.kind] || {}).replace(/^https?:\/\//, "").trim() && E.kind !== "wifi";
    let r;
    try { r = render(empty ? "https://github.com/pctecnikk/qrpanel" : c, E.design, { logoSrc: logoSrc(E.design) }); }
    catch { qrbox.innerHTML = `<div class="muted pad">Hay demasiado texto para un QR. Acórtalo o usa un QR dinámico.</div>`; return; }
    qrbox.innerHTML = r.svg;
    qrbox.style.opacity = empty ? ".35" : "1";
    if (pop || c !== lastContent) { qrbox.classList.remove("pop"); void qrbox.offsetWidth; qrbox.classList.add("pop"); }
    lastContent = c;
    $("#m-info", v).textContent = empty ? "Escribe el contenido para ver tu QR" : `Versión ${r.version} · ${r.n}×${r.n} módulos · corrección ${r.ecc}`;
    $("#m-chips", v).innerHTML = (E.dynamic ? `<span class="chip dyn">${icon("bolt", "sm")}Dinámico</span>` : "") + (E.dynamic && !E.active ? ` <span class="chip off">En pausa</span>` : "") + (E.dynamic && (E.pinOn ?? E.has_pin) ? ` <span class="chip">${icon("lock", "sm")}PIN</span>` : "") + (E.dynamic && E.expires ? ` <span class="chip ${E.expires * 1000 < Date.now() ? "off" : ""}">${E.expires * 1000 < Date.now() ? "Caducado" : "Caduca " + esc(fmtDate(E.expires))}</span>` : "");
    const sub = $(".step[data-s='content'] .sub", v);
    if (sub) sub.textContent = empty ? "" : `${TYPES[E.kind].name}: ${(E.dynamic ? encode(E.kind, E.fields[E.kind]) : c).slice(0, 60)}`;
    checkRead(empty ? null : c);
  }
  const refresh = debounce(() => { draw(); debHist(); saveDraft(); }, 40);
  let readToken = 0;
  const checkRead = debounce(async (c) => {
    const tok = ++readToken, meter = $("#meter", v), stage = $("#stage", v);
    if (!meter) return;
    if (!c) { meter.className = "card meter"; $("#g-n", v).textContent = "–"; $("#g-st", v).textContent = "Esperando contenido"; $("#g-sub", v).textContent = "Escribe qué quieres guardar en el QR."; $("#g-tips", v).innerHTML = ""; return; }
    stage.classList.add("scanning");
    const r = await readability(c, E.design, logoSrc(E.design));
    stage.classList.remove("scanning");
    if (tok !== readToken || !meter.isConnected) return;
    const st = r.score >= 80 ? "" : r.score >= 55 ? "warn" : "bad";
    meter.className = "card meter " + st;
    $(".fgc", meter).style.strokeDashoffset = String(169.6 * (1 - r.score / 100));
    countUp($("#g-n", v), r.score);
    $("#g-st", v).innerHTML = (st ? icon("alert", "sm") : icon("ok", "sm")) + (r.score >= 90 ? "Se lee perfecto" : r.score >= 80 ? "Se lee bien" : r.score >= 55 ? "Se puede mejorar" : "Difícil de leer");
    $("#g-sub", v).textContent = r.readBig ? (r.readSmall ? "Lo he leído grande y pequeño, como un móvil." : "Lo he leído en grande.") : "Ojo: no he conseguido leerlo.";
    $("#g-tips", v).innerHTML = r.tips.slice(0, 3).map((t) => `<li>${esc(t)}</li>`).join("");
  }, 420);

  // inclinacion 3D al mover el raton (como una carta de coleccion)
  const tilt = $("#tilt", v), stage = $("#stage", v);
  stage.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    const r = stage.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    tilt.style.transform = `rotateY(${x * 14}deg) rotateX(${-y * 14}deg) translateZ(10px)`;
  });
  stage.addEventListener("pointerleave", () => { tilt.style.transform = ""; });

  function saveDraft() { if (!E.id) localStorage.setItem("qp-draft", JSON.stringify(E)); }

  // --- guardar y descargar
  function current() {
    return { name: E.name || autoName(), kind: E.kind, fields: E.fields[E.kind] || {}, content: content(), design: E.design, folder: E.folder, favorite: E.favorite, dynamic: E.dynamic, code: E.dynamic ? E.code : null, target: E.dynamic ? encode(E.kind, E.fields[E.kind] || {}) : null, active: E.active, expires: E.expires, max_scans: E.max_scans, pin: pinToSend() };
  }
  function pinToSend() {
    const on = E.pinOn ?? !!E.has_pin;
    if (!E.dynamic) return null;
    if (!on) return E.has_pin ? "" : null;   // "" = quitar el PIN
    return E.pin ? E.pin : null;            // null = dejar el que hay
  }
  function autoName() {
    const f = E.fields[E.kind] || {};
    const base = f.url || f.ssid || [f.first, f.last].filter(Boolean).join(" ") || f.to || f.phone || f.title || f.label || f.text || TYPES[E.kind].name;
    return String(base).replace(/^https?:\/\/(www\.)?/, "").slice(0, 60);
  }
  $("#name", v).value = E.name || "";
  $("#name", v).addEventListener("input", (e) => { E.name = e.target.value; saveDraft(); });
  async function save() {
    const miss = missing(E.kind, E.fields[E.kind]);
    if (miss.length) { toast(`Falta: ${miss.join(", ")}`, "bad"); $("[data-s='content']", v).classList.add("open"); return; }
    if (E.dynamic && (E.pinOn ?? !!E.has_pin) && !E.has_pin && (E.pin || "").length < 4) { toast("Escribe un PIN de al menos 4 letras o números", "bad"); $("#pin", v)?.focus(); return; }
    if (E.dynamic && E.expMode === "scans" && !E.max_scans) { toast("Escribe cuántas lecturas se permiten, o elige «No caduca»", "bad"); return; }
    const btn = $("#save", v); btn.disabled = true;
    try {
      const data = current();
      const saved = E.id ? await S.store.update(E.id, data) : await S.store.create(data);
      const i = S.qrs.findIndex((x) => x.id === saved.id);
      if (i >= 0) S.qrs[i] = saved; else S.qrs.unshift(saved);
      const wasNew = !E.id;
      if (saved.share_url) uploadShareImage(saved);
      E.has_pin = !!saved.has_pin; E.pin = ""; E.pinOn = undefined; if ($("#pin", v)) $("#pin", v).value = "";
      E.id = saved.id; E.code = saved.code || E.code; E.short_url = saved.short_url; E.content = saved.content; E.name = saved.name;
      $("#name", v).value = E.name;
      localStorage.removeItem("qp-draft");
      const r = btn.getBoundingClientRect(); confetti(r.left + r.width / 2, r.top);
      toast(wasNew ? "¡QR guardado en tu biblioteca!" : "Cambios guardados");
      if (wasNew) { location.hash = `#/editar/${saved.id}`; return; }
      draw();
    } catch (err) { toast(err.message, "bad"); }
    if (btn.isConnected) btn.disabled = false;
  }
  $("#save", v).onclick = save;
  $("#dl", v).onclick = async (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const fmt = $("#fmt", v).value, size = +$("#size", v).value;
    const blob = await exportQR({ content: content(), design: E.design }, fmt, size);
    download(blob, `${slug(E.name || autoName())}.${EXT[fmt]}`);
    confetti(r.left + r.width / 2, r.top, 40);
  };
  $("#p3d", v).onclick = () => {
    if (missing(E.kind, E.fields[E.kind]).length) return toast("Escribe primero el contenido del QR", "bad");
    print3dDlg({ name: E.name || autoName(), content: content(), design: E.design });
  };
  $("#copy", v).onclick = async () => {
    try {
      const blob = await exportQR({ content: content(), design: E.design }, "png", 1024);
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast("Imagen copiada. Pégala donde quieras");
    } catch { toast("Tu navegador no deja copiar imágenes. Usa Descargar", "bad"); }
  };
  $("#copytxt", v).onclick = async () => { try { await navigator.clipboard.writeText(content()); toast("Texto del QR copiado"); } catch { toast("No se pudo copiar", "bad"); } };
  $("#share", v).onclick = async () => {
    try {
      const blob = await exportQR({ content: content(), design: E.design }, "png", 1024);
      const name = `${slug(E.name || autoName())}.png`;
      if (!(await shareFile(blob, name, E.name || ""))) { download(blob, name); toast("Este navegador no comparte archivos: lo he descargado"); }
    } catch (err) { if (err.name !== "AbortError") toast("No se pudo compartir", "bad"); }
  };
  $("#shlink", v)?.addEventListener("click", () => { const q = S.qrs.find((x) => x.id === E.id); if (q) shareDlg(q); });
  $("#new", v)?.addEventListener("click", () => { E = null; localStorage.removeItem("qp-draft"); location.hash = "#/crear"; });
  $("#reset", v)?.addEventListener("click", () => { localStorage.removeItem("qp-draft"); E = null; route(); });

  const keys = (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === "s") { e.preventDefault(); save(); }
    else if (k === "z" && !e.shiftKey && !e.target.closest("input,textarea")) { e.preventDefault(); undo(); }
    else if ((k === "y" || (k === "z" && e.shiftKey)) && !e.target.closest("input,textarea")) { e.preventDefault(); redo(); }
  };
  document.addEventListener("keydown", keys);
  cleanup = () => { document.removeEventListener("keydown", keys); document.removeEventListener("paste", onPaste); };

  drawForm(); syncDesign(); draw(); updHistBtns();
}

function step(n, key, title, open, body) {
  return `<section class="card step ${open ? "open" : ""}" data-s="${key}" id="s-${key}"><button class="step-h"><span class="num">${n}</span>${title}<span class="sub"></span>${icon("chev", "chev")}</button><div class="step-b"><div><div class="step-in">${body}</div></div></div></section>`;
}
function countUp(el, to) {
  const from = parseInt(el.textContent) || 0, t0 = performance.now();
  (function f(t) { const k = Math.min(1, (t - t0) / 700), e = 1 - (1 - k) ** 3; el.textContent = Math.round(from + (to - from) * e); if (k < 1) requestAnimationFrame(f); })(t0);
}

// =============================================================================
// BIBLIOTECA
// =============================================================================
const LIB = { q: "", filter: "all", folder: "", sel: new Set() };
function viewLibrary(v) {
  LIB.sel.clear();
  const folders = [...new Set(S.qrs.map((q) => q.folder).filter(Boolean))].sort();
  v.innerHTML = `
  <div class="page-head"><div><h1>Biblioteca</h1><p>${fmtN(S.qrs.length)} QR guardados${S.store.mode === "local" ? " en este navegador" : ""}.</p></div>
    <a class="btn primary" href="#/crear">${icon("plus")}Nuevo QR</a></div>
  <div class="toolbar">
    <label class="search">${icon("search", "sm")}<input id="q" placeholder="Buscar por nombre o contenido" value="${esc(LIB.q)}"></label>
    <div class="filters" id="filters">
      ${[["all", "Todos"], ["fav", "Favoritos"], ...(S.store.mode === "server" ? [["dyn", "Dinámicos"]] : [])].map(([k, t]) => `<button data-f="${k}" class="${LIB.filter === k ? "on" : ""}">${t}</button>`).join("")}
      ${folders.length ? `<select class="input" id="folder" style="width:auto;padding:7px 10px;border-radius:999px"><option value="">Todas las carpetas</option>${folders.map((f) => `<option ${LIB.folder === f ? "selected" : ""}>${esc(f)}</option>`).join("")}</select>` : ""}
    </div>
  </div>
  <div class="grid" id="grid"></div>`;
  const grid = $("#grid", v);
  const io = new IntersectionObserver((ents) => ents.forEach((en) => {
    if (!en.isIntersecting) return;
    const el = en.target, q = S.qrs.find((x) => String(x.id) === el.dataset.id);
    if (q) el.innerHTML = renderQR(q);
    io.unobserve(el);
  }), { rootMargin: "200px" });
  function list() {
    const s = LIB.q.toLowerCase();
    return S.qrs.filter((q) => (!s || (q.name + " " + q.content + " " + (q.target || "")).toLowerCase().includes(s)) &&
      (LIB.filter !== "fav" || q.favorite) && (LIB.filter !== "dyn" || q.dynamic) && (!LIB.folder || q.folder === LIB.folder));
  }
  function draw() {
    const items = list();
    if (!items.length) {
      grid.innerHTML = `<div class="empty card" style="grid-column:1/-1"><svg class="art" viewBox="0 0 120 120">${render("QRPanel", { dots: { shape: "liquid" }, fg: { type: "linear", c1: "#7c3aed", c2: "#06b6d4" }, bg: { type: "none" }, margin: 0 }).svg.replace(/^<svg[^>]*>|<\/svg>$/g, "").replace(/<defs>/, "<defs>")}</svg>
        <h3 style="margin:0">${S.qrs.length ? "No hay nada con ese filtro" : "Aún no tienes QR guardados"}</h3>
        <p class="muted" style="margin:0">${S.qrs.length ? "Prueba con otra búsqueda." : "Crea el primero: tarda menos de un minuto."}</p>
        ${S.qrs.length ? "" : `<a class="btn primary" href="#/crear">${icon("plus")}Crear mi primer QR</a>`}</div>`;
      // el svg de la ilustracion necesita su viewBox
      const art = $(".art", grid); if (art) { const r = render("QRPanel", { margin: 0 }); art.setAttribute("viewBox", `0 0 ${r.n} ${r.n}`); }
      return;
    }
    grid.innerHTML = items.map((q, i) => `<article class="card qcard ${LIB.sel.has(q.id) ? "selected" : ""}" data-id="${q.id}" style="animation-delay:${Math.min(i, 12) * 30}ms">
      <div class="pv" data-open data-id="${q.id}"></div>
      <button class="sel" data-sel title="Seleccionar">${icon("check", "sm")}</button>
      <button class="fav ${q.favorite ? "on" : ""}" data-fav title="Favorito">${icon("star", "sm")}</button>
      <div class="info"><div class="name" title="${esc(q.name)}">${esc(q.name)}</div>
        <div class="meta"><span class="chip">${esc(TYPES[q.kind]?.name || q.kind)}</span>
          ${q.dynamic ? `<span class="chip ${q.active ? "dyn" : "off"}">${q.active ? icon("bolt", "sm") + fmtN(q.scans) + " lecturas" : "En pausa"}</span>` : ""}
          ${q.dynamic && q.has_pin ? `<span class="chip" title="Pide PIN">${icon("lock", "sm")}</span>` : ""}
          ${q.dynamic && q.expires && q.expires * 1000 < Date.now() ? `<span class="chip off">Caducado</span>` : q.dynamic && q.max_scans && q.scans >= q.max_scans ? `<span class="chip off">Agotado</span>` : ""}
          ${q.folder ? `<span class="chip">${icon("folder", "sm")}${esc(q.folder)}</span>` : ""}
          ${q.share_url ? `<span class="chip" title="Compartido con enlace">${icon("share", "sm")}</span>` : ""}
          <button class="btn ghost icon more" data-more title="Más">${icon("dots")}</button></div></div></article>`).join("");
    $$(".pv", grid).forEach((el) => io.observe(el));
    selbar();
  }
  grid.addEventListener("click", async (e) => {
    const card = e.target.closest(".qcard"); if (!card) return;
    const q = S.qrs.find((x) => String(x.id) === card.dataset.id);
    if (e.target.closest("[data-sel]") || (LIB.sel.size && e.target.closest("[data-open]"))) {
      LIB.sel.has(q.id) ? LIB.sel.delete(q.id) : LIB.sel.add(q.id);
      card.classList.toggle("selected", LIB.sel.has(q.id)); grid.classList.toggle("selecting", LIB.sel.size > 0); selbar(); return;
    }
    if (e.target.closest("[data-fav]")) {
      const nq = await S.store.patch(q.id, { favorite: !q.favorite }); Object.assign(q, nq);
      e.target.closest("[data-fav]").classList.toggle("on", q.favorite);
      if (q.favorite) e.target.closest("[data-fav]").animate([{ transform: "scale(1.5) rotate(-20deg)" }, { transform: "none" }], { duration: 400, easing: "cubic-bezier(.3,1.6,.5,1)" });
      return;
    }
    if (e.target.closest("[data-more]")) return qrMenu(e.target.closest("[data-more]"), q, draw);
    if (e.target.closest("[data-open]")) location.hash = `#/editar/${q.id}`;
  });
  function selbar() {
    $(".selbar")?.remove();
    if (!LIB.sel.size) return;
    const bar = h(`<div class="selbar"><b>${LIB.sel.size} seleccionados</b>
      <button class="btn sm" data-a="zip">${icon("zip", "sm")}Descargar ZIP</button>
      <button class="btn sm" data-a="del">${icon("trash", "sm")}Eliminar</button>
      <button class="btn sm icon" data-a="x" title="Quitar selección">${icon("x", "sm")}</button></div>`);
    document.body.appendChild(bar);
    bar.addEventListener("click", async (e) => {
      const a = e.target.closest("[data-a]")?.dataset.a; if (!a) return;
      const items = S.qrs.filter((q) => LIB.sel.has(q.id));
      if (a === "x") { LIB.sel.clear(); grid.classList.remove("selecting"); draw(); }
      if (a === "zip") { await zipQRs(items, "png", 1024); }
      if (a === "del" && await confirmDlg(`¿Eliminar ${items.length} QR?`, "Los QR dinámicos dejarán de funcionar. No se puede deshacer.")) {
        for (const q of items) await S.store.remove(q.id);
        S.qrs = S.qrs.filter((q) => !LIB.sel.has(q.id)); LIB.sel.clear(); grid.classList.remove("selecting"); draw(); toast("Eliminados");
      }
    });
  }
  $("#q", v).addEventListener("input", debounce((e) => { LIB.q = e.target.value; draw(); }, 120));
  $("#filters", v).addEventListener("click", (e) => { const b = e.target.closest("[data-f]"); if (!b) return; LIB.filter = b.dataset.f; $$("#filters [data-f]", v).forEach((x) => x.classList.toggle("on", x === b)); draw(); });
  $("#folder", v)?.addEventListener("change", (e) => { LIB.folder = e.target.value; draw(); });
  cleanup = () => { $(".selbar")?.remove(); io.disconnect(); };
  draw();
}

function qrMenu(anchor, q, redraw) {
  const items = [
    { icon: "edit", label: "Editar", run: () => (location.hash = `#/editar/${q.id}`) },
    { icon: "download", label: "Descargar PNG", run: async () => download(await exportQR(q, "png", 1024), `${slug(q.name)}.png`) },
    { icon: "download", label: "Descargar SVG", run: async () => download(await exportQR(q, "svg"), `${slug(q.name)}.svg`) },
    { icon: "download", label: "Descargar JPG", run: async () => download(await exportQR(q, "jpg", 1024), `${slug(q.name)}.jpg`) },
    { icon: "download", label: "Descargar PDF", run: async () => download(await exportQR(q, "pdf", 2048), `${slug(q.name)}.pdf`) },
    { icon: "cube", label: "Imprimir en 3D (STL / 3MF)", run: () => print3dDlg(q) },
    { icon: "share", label: "Compartir imagen (WhatsApp, Telegram…)", run: async () => {
      const blob = await exportQR(q, "png", 1024), name = `${slug(q.name)}.png`;
      try { if (!(await shareFile(blob, name, q.name))) { download(blob, name); toast("Este navegador no comparte archivos: lo he descargado"); } } catch { toast("No se pudo compartir", "bad"); }
    } },
    ...(S.store.mode === "server" ? [{ icon: "share", label: q.share_url ? "Enlace para compartir" : "Compartir con un enlace", run: () => shareDlg(q, redraw) }] : []),
    { icon: "copy", label: "Duplicar", run: async () => {
      const c = structuredClone(q); delete c.id; delete c.share; delete c.share_url; c.name = q.name + " (copia)"; c.code = null; c.dynamic = q.dynamic;
      const n = await S.store.create(c); S.qrs.unshift(n); redraw(); toast("Duplicado");
    } },
    { icon: "edit", label: "Renombrar", run: async () => {
      const name = await promptDlg("Renombrar", "Nombre", q.name); if (!name) return;
      Object.assign(q, await S.store.patch(q.id, { name })); redraw();
    } },
    { icon: "folder", label: "Mover a carpeta", run: async () => {
      const folder = await promptDlg("Carpeta", "Nombre de la carpeta (vacío = ninguna)", q.folder || "", "Clientes, Restaurante…"); if (folder == null) return;
      Object.assign(q, await S.store.patch(q.id, { folder })); route();
    } },
  ];
  if (q.dynamic) items.push("-",
    { icon: "chart", label: "Estadísticas", run: () => qrStatsDlg(q) },
    { icon: "link", label: "Copiar enlace corto", run: async () => { await navigator.clipboard.writeText(q.short_url); toast("Enlace copiado"); } },
    { icon: q.active ? "pause" : "play", label: q.active ? "Poner en pausa" : "Activar", run: async () => { Object.assign(q, await S.store.patch(q.id, { active: !q.active })); redraw(); toast(q.active ? "Activo otra vez" : "En pausa: quien lo escanee verá un aviso"); } });
  items.push("-", { icon: "trash", label: "Eliminar", danger: true, run: async () => {
    if (!(await confirmDlg(`¿Eliminar «${q.name}»?`, q.dynamic ? "Es dinámico: los QR impresos dejarán de funcionar." : "No se puede deshacer."))) return;
    await S.store.remove(q.id); S.qrs = S.qrs.filter((x) => x.id !== q.id); redraw(); toast("Eliminado");
  } });
  menu(anchor, items);
}

// --- imprimir en 3D ------------------------------------------------------------------
async function print3dDlg(q) {
  let o = { ...DEFAULT_3D };
  try { Object.assign(o, JSON.parse(localStorage.getItem("qp-3d") || "{}")); } catch { /* sin preferencias */ }
  const ecc = mergeDesign(q.design).ecc || "M";
  const num = (k, label, min, max, step, unit) => `<label class="r3"><span>${label}</span><input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${o[k]}"><input type="number" class="input" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${o[k]}"><em>${unit}</em></label>`;
  let model = null, view = null;
  await dialog({
    title: "Imprimir en 3D · " + q.name, wide: true,
    body: `<div class="p3d">
      <div class="p3d-view"><canvas id="c3d" aria-label="Vista previa 3D. Arrastra para girar, rueda o pellizco para acercar"></canvas>
        <div class="p3d-tools"><button class="btn sm" data-v="spin">${icon("flip", "sm")}Girar</button><button class="btn sm" data-v="top">${icon("scan", "sm")}Desde arriba</button><button class="btn sm" data-v="reset">${icon("eye", "sm")}Centrar</button></div>
        <div class="small faint p3d-hint">Arrastra para girar · rueda o pellizco para acercar · doble clic para centrar. Desde arriba puedes escanearlo con el móvil.</div></div>
      <div class="p3d-form">
        ${num("size", "Tamaño (lado)", 20, 150, 1, "mm")}
        ${num("base", "Grosor de la base", 0.6, 6, 0.2, "mm")}
        ${num("height", "Altura de los módulos", 0.4, 4, 0.2, "mm")}
        ${num("margin", "Borde blanco", 0, 6, 1, "mód.")}
        ${num("radius", "Esquinas redondeadas", 0, 15, 0.5, "mm")}
        <label class="switch"><input type="checkbox" data-k="keychain" ${o.keychain ? "checked" : ""}><i></i><span>Anilla para llavero</span></label>
        <div class="${o.keychain ? "" : "hidden"}" id="holebox">${num("hole", "Agujero", 3, 8, 0.5, "mm")}</div>
        <div class="row"><label class="field half"><span>Color base</span><input type="color" data-k="baseColor" value="${esc(o.baseColor)}"></label><label class="field half"><span>Color módulos</span><input type="color" data-k="modColor" value="${esc(o.modColor)}"></label></div>
        <label class="field"><span>Archivo</span><select data-k="format">
          <option value="3mf" ${o.format === "3mf" ? "selected" : ""}>3MF · dos colores (Bambu, Prusa, Orca, Cura)</option>
          <option value="stl" ${o.format === "stl" ? "selected" : ""}>STL · una sola pieza</option>
          <option value="zip" ${o.format === "zip" ? "selected" : ""}>2 STL (base y módulos) en un ZIP</option></select></label>
        <div class="p3d-info" id="i3d"></div>
        <div class="row"><button class="btn ghost sm" id="r3d">Valores por defecto</button></div>
      </div></div>`,
    buttons: [["Cerrar", null], [`Descargar`, async () => {
      const name = slug(q.name).replace(/-?3d$/, "") + "-3d";
      if (o.format === "stl") download(toSTL(model), name + ".stl");
      else if (o.format === "zip") download(await toSTLParts(model, name), name + "-stl.zip");
      else download(await to3MF(model, q.name), name + ".3mf");
      toast("Modelo 3D descargado. Ábrelo en tu programa de impresión (laminador)");
      return true;
    }, "primary"]],
    onOpen: (w) => {
      const cv = w.querySelector("#c3d");
      view = viewer(cv);
      if (!view) cv.replaceWith(h(`<div class="empty small muted">Tu navegador no puede mostrar la vista 3D, pero el archivo se descarga igual.</div>`));
      const fmt = (v) => String(+(+v).toFixed(2)).replace(".", ",");
      const redraw = () => {
        model = build3d(q.content || " ", ecc, o);
        view?.setModel(model);
        const i = model.info, small = i.module < 1.2;
        w.querySelector("#i3d").innerHTML = `
          <div><b>${fmt(i.width)} × ${fmt(i.depth)} × ${fmt(i.height)} mm</b> · QR de ${i.n}×${i.n} módulos</div>
          <div>Cada módulo mide <b>${fmt(i.module)} mm</b> · ${fmtN(i.tris)} triángulos</div>
          ${small ? `<div class="warn">${icon("alert", "sm")} Módulos muy pequeños para una boquilla de 0,4 mm. Sube el tamaño a ${Math.ceil(o.size * 1.2 / i.module)} mm o más, o acorta el contenido (un QR dinámico tiene menos módulos).</div>` : `<div class="ok">${icon("check", "sm")} Buen tamaño para imprimir con boquilla de 0,4 mm.</div>`}
          <div class="faint">Con un solo color: imprime en ${esc(o.baseColor === "#ffffff" ? "blanco" : "el color de la base")} y pon un <b>cambio de filamento a ${fmt(i.colorChange)} mm</b> de altura para los módulos.</div>
          <div class="faint">En 3D los módulos van cuadrados y sin logo, para que se lea siempre.</div>`;
      };
      const set = (k, val, src) => {
        o[k] = val;
        w.querySelectorAll(`[data-k="${k}"]`).forEach((x) => { if (x !== src && x.type !== "checkbox") x.value = val; });
        if (k === "keychain") w.querySelector("#holebox").classList.toggle("hidden", !val);
        localStorage.setItem("qp-3d", JSON.stringify(o));
        if (k !== "format") redrawSoon();
      };
      let t = 0; const redrawSoon = () => { clearTimeout(t); t = setTimeout(redraw, 30); };
      w.querySelector(".p3d-form").addEventListener("input", (e) => {
        const k = e.target.dataset.k; if (!k) return;
        if (e.target.type === "checkbox") return set(k, e.target.checked, e.target);
        if (e.target.type === "range" || e.target.type === "number") {
          const n = parseFloat(e.target.value); if (!Number.isFinite(n)) return;
          const v = Math.min(+e.target.max, Math.max(+e.target.min, n)); return set(k, v, e.target);
        }
        set(k, e.target.value, e.target);
      });
      w.querySelector("#r3d").onclick = () => {
        o = { ...DEFAULT_3D, format: o.format };
        w.querySelectorAll("[data-k]").forEach((x) => { if (x.type === "checkbox") x.checked = !!o[x.dataset.k]; else x.value = o[x.dataset.k]; });
        w.querySelector("#holebox").classList.toggle("hidden", !o.keychain);
        localStorage.setItem("qp-3d", JSON.stringify(o)); redraw();
      };
      w.querySelector(".p3d-tools").addEventListener("click", (e) => {
        const b = e.target.closest("[data-v]"); if (!b || !view) return;
        if (b.dataset.v === "spin") view.spin(); else if (b.dataset.v === "top") view.top(); else view.reset();
      });
      redraw();
    },
  });
  view?.destroy();
}

/** Sube la imagen del QR para que el enlace compartido salga con su foto en WhatsApp/Telegram. */
async function uploadShareImage(q) {
  try { const png = await exportQR(q, "png", 800); await S.store.shareImage?.(q.id, png); return png; } catch { return null; }
}
const canShareFiles = () => !!(APP || navigator.canShare?.({ files: [new File([new Blob(["x"], { type: "image/png" })], "q.png", { type: "image/png" })] }));

async function shareDlg(q, redraw) {
  try { if (!q.share_url) { Object.assign(q, await S.store.share(q.id)); redraw?.(); } }
  catch (e) { return toast(e.message, "bad"); }
  const imgP = uploadShareImage(q);
  const r = await dialog({
    title: "Compartir «" + q.name + "»",
    body: `<div class="steps" style="gap:12px"><div class="small muted">Cualquiera con este enlace podrá ver el QR y descargarlo en PNG, SVG o PDF, sin necesitar cuenta.</div>
      <div class="row"><input class="input grow" id="shurl" value="${esc(q.share_url)}" readonly><button class="btn" id="shcopy">${icon("copy", "sm")}Copiar</button></div>
      <div class="row"><a class="btn sm ghost" href="${esc(q.share_url)}" target="_blank" rel="noopener">${icon("eye", "sm")}Ver la página</a>
      ${canShareText() ? `<button class="btn sm ghost" id="shnat">${icon("share", "sm")}Enviar…</button>` : ""}</div>
      <div class="row"><a class="btn sm" id="shwa" href="https://wa.me/?text=${encodeURIComponent(q.name + " " + q.share_url)}" target="_blank" rel="noopener">WhatsApp</a>
      <a class="btn sm" id="shtg" href="https://t.me/share/url?url=${encodeURIComponent(q.share_url)}&text=${encodeURIComponent(q.name)}" target="_blank" rel="noopener">Telegram</a>
      <a class="btn sm ghost" href="mailto:?subject=${encodeURIComponent(q.name)}&body=${encodeURIComponent(q.share_url)}">Correo</a></div></div>`,
    buttons: [["Dejar de compartir", "off"], ["Listo", null, "primary"]],
    onOpen: (w) => {
      w.querySelector("#shcopy").onclick = async () => { await navigator.clipboard.writeText(q.share_url); toast("Enlace copiado"); };
      w.querySelector("#shurl").onclick = (e) => e.target.select();
      w.querySelector("#shnat")?.addEventListener("click", () => shareText(q.name + " " + q.share_url, q.name));
      // En el móvil (y en la app) se manda la imagen del QR con el enlace; en el PC, el enlace
      // con su vista previa (la imagen del QR sale gracias a og:image).
      if (canShareFiles()) for (const id of ["#shwa", "#shtg"]) w.querySelector(id).addEventListener("click", async (e) => {
        e.preventDefault();
        const png = (await imgP) || (await exportQR(q, "png", 800));
        try { await shareFile(png, `${slug(q.name)}.png`, `${q.name}\n${q.share_url}`); } catch { toast("No se pudo compartir", "bad"); }
      });
    },
  });
  if (r === "off") { Object.assign(q, await S.store.unshare(q.id)); redraw?.(); toast("Ya no se comparte. El enlace ha dejado de funcionar"); }
}

async function zipQRs(items, fmt, size, onProgress) {
  const files = [];
  for (let i = 0; i < items.length; i++) {
    files.push({ name: `${slug(items[i].name)}.${EXT[fmt]}`, data: await exportQR(items[i], fmt, size) });
    onProgress?.((i + 1) / items.length);
  }
  download(await makeZip(files), `qrpanel-${new Date().toISOString().slice(0, 10)}.zip`);
  toast(`${items.length} QR descargados en un ZIP`);
}

// =============================================================================
// ESTADISTICAS
// =============================================================================
const tipEl = () => $(".tip") || document.body.appendChild(h('<div class="tip hidden"></div>'));
function barChart(data, { height = 180, width = 640, label = (d) => d.k, value = (d) => d.n, tip = (d) => `${label(d)}: ${fmtN(value(d))}`, every = 5 } = {}) {
  const w = width, padL = 30, padB = 22, max = Math.max(1, ...data.map(value));
  const nice = Math.pow(10, Math.floor(Math.log10(max))), top = Math.max(2, Math.ceil(max / nice) * nice + (Math.ceil(max / nice) * nice) % 2);
  const bw = (w - padL) / data.length, gap = Math.min(4, bw * 0.25);
  const ticks = [0, top / 2, top];
  const id = "c" + Math.random().toString(36).slice(2, 7);
  const svg = `<svg viewBox="0 0 ${w} ${height}" id="${id}" role="img" aria-label="Gráfico de barras">
    <g class="grid">${ticks.map((t) => { const y = height - padB - (t / top) * (height - padB - 8); return `<line x1="${padL}" x2="${w}" y1="${y}" y2="${y}"/><text x="${padL - 6}" y="${y + 4}" text-anchor="end">${fmtN(t)}</text>`; }).join("")}</g>
    ${data.map((d, i) => {
      const hgt = (value(d) / top) * (height - padB - 8), x = padL + i * bw + gap / 2, y = height - padB - hgt;
      const r = Math.min(4, (bw - gap) / 2, hgt);
      const path = hgt > 0 ? `M${x} ${height - padB}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + bw - gap - r}Q${x + bw - gap} ${y} ${x + bw - gap} ${y + r}V${height - padB}Z` : "";
      return `<path class="bar" d="${path}"/><rect x="${padL + i * bw}" y="0" width="${bw}" height="${height - padB}" fill="transparent" data-i="${i}"/>` +
        (i % every === 0 || i === data.length - 1 ? `<text x="${x + (bw - gap) / 2}" y="${height - 6}" text-anchor="middle">${esc(label(d))}</text>` : "");
    }).join("")}</svg>`;
  setTimeout(() => {
    const el = document.getElementById(id); if (!el) return;
    const t = tipEl();
    el.addEventListener("pointermove", (e) => {
      const r = e.target.closest("[data-i]");
      $$(".bar", el).forEach((b) => b.classList.remove("hl"));
      if (!r) { t.classList.add("hidden"); return; }
      const i = +r.dataset.i; $$(".bar", el)[i].classList.add("hl");
      t.textContent = tip(data[i]); t.classList.remove("hidden");
      const bb = r.getBoundingClientRect(); t.style.left = bb.left + bb.width / 2 + "px"; t.style.top = Math.max(e.clientY - 10, bb.top + 20) + "px";
    });
    el.addEventListener("pointerleave", () => { t.classList.add("hidden"); $$(".bar", el).forEach((b) => b.classList.remove("hl")); });
  });
  return svg;
}
const dayLabel = (d) => new Date(d.day + "T12:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" });
const tableOf = (rows, cols) => `<details class="table"><summary>Ver como tabla</summary><table><tr>${cols.map((c) => `<th>${c[0]}</th>`).join("")}</tr>${rows.map((r) => `<tr>${cols.map((c) => `<td>${esc(c[1](r))}</td>`).join("")}</tr>`).join("")}</table></details>`;
function hbars(list) {
  const max = Math.max(1, ...list.map((x) => x.n));
  return `<div class="hbars">${list.map((x) => `<div class="hbar"><span>${esc(x.k)}</span><div class="tr"><i style="width:${(x.n / max) * 100}%"></i></div><b>${fmtN(x.n)}</b></div>`).join("") || `<div class="muted small">Aún no hay lecturas.</div>`}</div>`;
}

async function viewStats(v) {
  if (S.store.mode === "local") {
    v.innerHTML = `<div class="page-head"><div><h1>Estadísticas</h1></div></div><div class="card empty">${icon("chart", "lg")}<h3 style="margin:0">Las estadísticas necesitan el servidor</h3><p class="muted" style="margin:0;max-width:460px">Para saber cuántas veces escanean tus QR, instala QRPanel en tu servidor (Docker) y crea QR dinámicos. Mira las instrucciones en GitHub.</p><a class="btn" href="https://github.com/pctecnikk/qrpanel" target="_blank" rel="noopener">${icon("github")}Ver en GitHub</a></div>`;
    return;
  }
  v.innerHTML = `<div class="page-head"><div><h1>Estadísticas</h1><p>Lecturas de tus QR dinámicos en los últimos 30 días.</p></div></div><div class="kpis" id="kpis"></div><div class="charts" id="charts"></div>`;
  const s = await S.store.stats();
  $("#kpis", v).innerHTML = [["QR creados", s.qrs, "qr"], ["Dinámicos", s.dynamic, "bolt"], ["Lecturas totales", s.scans, "scan"], ["Últimos 7 días", s.week, "chart"]]
    .map(([t, n, i]) => `<div class="card kpi">${icon(i)}<span>${t}</span><b data-n="${n}">0</b></div>`).join("");
  $$(".kpi b", v).forEach((b) => countUp(b, +b.dataset.n));
  $("#charts", v).innerHTML = `
    <div class="card chart"><h3>Lecturas por día</h3><div class="small muted">Todos tus QR dinámicos</div>${barChart(s.days, { label: dayLabel, tip: (d) => `${dayLabel(d)}: ${fmtN(d.n)} lecturas`, every: 5 })}${tableOf(s.days, [["Día", dayLabel], ["Lecturas", (d) => d.n]])}</div>
    <div class="steps">
      <div class="card chart"><h3>Los más escaneados</h3><div class="toplist">${s.top.length ? s.top.map((q, i) => `<button data-q="${q.id}"><span class="rank">${i + 1}</span><span>${esc(q.name)}</span><span class="n">${fmtN(q.scans)}</span></button>`).join("") : `<div class="muted small">Crea un QR dinámico para ver aquí sus lecturas.</div>`}</div></div>
      <div class="card chart"><h3>Dispositivos</h3>${hbars(s.devices)}</div>
    </div>`;
  $(".toplist", v).addEventListener("click", (e) => { const b = e.target.closest("[data-q]"); if (b) { const q = S.qrs.find((x) => x.id === +b.dataset.q); if (q) qrStatsDlg(q); } });
}

async function qrStatsDlg(q) {
  const st = await S.store.qrStats(q.id, 30);
  const hours = st.hours.map((n, i) => ({ k: `${i}h`, n }));
  dialog({
    title: q.name, wide: true, buttons: [],
    body: `<div class="row" style="margin-bottom:12px"><span class="chip ${q.active ? "dyn" : "off"}">${q.active ? "Activo" : "En pausa"}</span><a class="small" href="${esc(q.short_url)}" target="_blank" rel="noopener">${esc(q.short_url)}</a><span class="small muted">→ ${esc(q.target || "")}</span></div>
      <div class="kpis" style="grid-template-columns:repeat(3,1fr)"><div class="card kpi"><span>Lecturas</span><b>${fmtN(st.total)}</b></div><div class="card kpi"><span>Visitantes únicos (por día)</span><b>${fmtN(st.unique)}</b></div><div class="card kpi"><span>Última lectura</span><b style="font-size:18px">${ago(st.last_scan)}</b></div></div>
      <div class="card chart"><h3>Últimos 30 días</h3>${barChart(st.days, { label: dayLabel, tip: (d) => `${dayLabel(d)}: ${fmtN(d.n)} lecturas`, height: 160 })}</div>
      <div class="charts" style="grid-template-columns:1fr 1fr;margin-top:14px">
        <div class="card chart"><h3>Por hora del día</h3>${barChart(hours, { height: 150, width: 320, every: 6, tip: (d) => `${d.k}: ${fmtN(d.n)} lecturas` })}</div>
        <div class="card chart"><h3>Sistema</h3>${hbars(st.os)}</div>
        <div class="card chart"><h3>Dispositivo</h3>${hbars(st.devices)}</div>
        <div class="card chart"><h3>Navegador</h3>${hbars(st.browsers)}</div>
      </div>
      <div class="card chart" style="margin-top:14px"><h3>Últimas lecturas</h3>${st.recent.length ? `<table style="width:100%;font-size:13px;border-collapse:collapse">${st.recent.map((r) => `<tr><td style="padding:5px 0">${fmtDate(r.at)}</td><td>${esc(r.device)}</td><td>${esc(r.os)}</td><td>${esc(r.browser)}</td></tr>`).join("")}</table>` : `<div class="muted small">Todavía nadie lo ha escaneado.</div>`}</div>`,
  });
}

// =============================================================================
// ESCANEAR
// =============================================================================
function viewScan(v) {
  const histKey = "qp-scans";
  v.innerHTML = `<div class="page-head"><div><h1>Escanear</h1><p>Lee un QR con la cámara o desde una foto o captura de pantalla.</p></div></div>
  <div class="scan">
    <div class="steps">
      <div class="cam" id="cam"><div class="cam-off" id="camoff">${icon("camera", "lg")}<b>Usa la cámara</b><span class="small" style="opacity:.75">Apunta a un QR y lo leo al momento.</span><button class="btn primary" id="start">${icon("camera")}Encender cámara</button><button class="btn sm ghost" id="snap">${icon("image", "sm")}O haz una foto</button><input type="file" id="snapf" accept="image/*" capture="environment" hidden></div>
        <video id="video" playsinline muted class="hidden"></video><div class="corners hidden"><i></i><i></i><i></i><i></i></div><div class="scanline"></div>
        <div class="cam-ui hidden" id="camui"><button class="btn sm" id="flip">${icon("flip", "sm")}Cambiar</button><button class="btn sm hidden" id="torch">${icon("bolt", "sm")}Linterna</button><button class="btn sm" id="stop">${icon("x", "sm")}Apagar</button></div></div>
      <div class="drop" id="sdrop" tabindex="0"><div class="thumb">${icon("image", "lg")}</div><div><b>Leer desde una imagen</b><div class="small muted">Arrastra una foto, pégala (Ctrl+V) o pulsa para elegirla.</div></div><input type="file" id="sfile" accept="image/*" hidden></div>
    </div>
    <div class="steps">
      <div class="card pad" id="result"><div class="muted">${icon("info", "sm")} Aquí verás lo que hay dentro del QR.</div></div>
      <div class="card pad"><div class="row between"><b>Últimos escaneos</b><button class="btn sm ghost" id="clearh">Borrar</button></div><div class="hist" id="hist"></div></div>
    </div>
  </div>`;
  let stream = null, raf = 0, facing = "environment", busy = false, lastVal = "";
  const video = $("#video", v), cam = $("#cam", v);
  function drawHist() {
    const list = JSON.parse(localStorage.getItem(histKey) || "[]");
    $("#hist", v).innerHTML = list.length ? list.map((x, i) => `<button data-h="${i}">${icon(TYPES[parse(x.t).kind]?.icon || "text", "sm")}<span class="t">${esc(x.t)}</span><span class="small faint">${ago(x.at)}</span></button>`).join("") : `<div class="small muted">Nada todavía.</div>`;
  }
  $("#hist", v).addEventListener("click", (e) => { const b = e.target.closest("[data-h]"); if (b) show(JSON.parse(localStorage.getItem(histKey))[+b.dataset.h].t, false); });
  $("#clearh", v).onclick = () => { localStorage.removeItem(histKey); drawHist(); };
  function show(text, save = true) {
    const p = parse(text);
    if (save) {
      const list = JSON.parse(localStorage.getItem(histKey) || "[]").filter((x) => x.t !== text);
      list.unshift({ t: text, at: Date.now() / 1000 }); localStorage.setItem(histKey, JSON.stringify(list.slice(0, 25))); drawHist();
      navigator.vibrate?.(60);
    }
    const f = p.fields, rows = Object.entries(f).filter(([k, x]) => x && k !== "auth" && k !== "hidden");
    const names = Object.fromEntries((TYPES[p.kind]?.fields || []).map((x) => [x.k, x.label]));
    const isUrl = /^https?:\/\//i.test(text);
    $("#result", v).innerHTML = `<div class="result"><div class="row">${icon(TYPES[p.kind]?.icon || "text", "lg")}<div><b style="font-size:17px">${esc(p.title)}</b><div class="small muted">${esc(p.summary || "")}</div></div></div>
      ${p.kind !== "text" && p.kind !== "url" ? `<dl class="kv">${rows.map(([k, x]) => `<dt>${esc(names[k] || k)}</dt><dd>${esc(x)}</dd>`).join("")}</dl>` : ""}
      <div class="raw">${esc(text)}</div>
      ${isUrl ? `<div class="small muted">${icon("shield", "sm")} Antes de abrir un enlace, mira que la dirección sea la que esperas.</div>` : ""}
      <div class="actions">
        ${isUrl ? `<a class="btn primary" href="${esc(text)}" target="_blank" rel="noopener noreferrer">${icon("link")}Abrir</a>` : ""}
        ${p.kind === "wifi" && f.password ? `<button class="btn" data-copy="${esc(f.password)}">${icon("key")}Copiar contraseña</button>` : ""}
        <button class="btn" data-copy="${esc(text)}">${icon("copy")}Copiar</button>
        <button class="btn" id="redesign">${icon("sparkle")}Recrear con mi diseño</button>
      </div></div>`;
    $$("[data-copy]", v).forEach((b) => (b.onclick = async () => { await navigator.clipboard.writeText(b.dataset.copy); toast("Copiado"); }));
    $("#redesign", v).onclick = () => { pendingLoad = p; E = null; location.hash = "#/crear"; };
  }
  async function start() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false });
    } catch { toast(location.protocol === "http:" && location.hostname !== "localhost" ? "Con http el navegador no deja usar la cámara en directo. Pulsa «O haz una foto»" : "No he podido usar la cámara. Revisa el permiso", "bad"); return; }
    video.srcObject = stream; await video.play();
    $("#camoff", v).classList.add("hidden"); video.classList.remove("hidden"); $(".corners", v).classList.remove("hidden"); $("#camui", v).classList.remove("hidden");
    cam.classList.add("live");
    const track = stream.getVideoTracks()[0];
    $("#torch", v).classList.toggle("hidden", !track.getCapabilities?.().torch);
    loop();
  }
  function stop() {
    cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); stream = null;
    cam.classList.remove("live", "hit"); video.classList.add("hidden"); $(".corners", v).classList.add("hidden"); $("#camui", v).classList.add("hidden"); $("#camoff", v).classList.remove("hidden");
  }
  const cv = document.createElement("canvas");
  async function loop() {
    if (!stream) return;
    if (!busy && video.readyState >= 2) {
      busy = true;
      const s = Math.min(video.videoWidth, video.videoHeight, 720), sx = (video.videoWidth - s) / 2, sy = (video.videoHeight - s) / 2;
      cv.width = cv.height = s;
      cv.getContext("2d", { willReadFrequently: true }).drawImage(video, sx, sy, s, s, 0, 0, s, s);
      const r = await decodeCanvas(cv, false).catch(() => null);
      if (r && r !== lastVal) { lastVal = r; cam.classList.add("hit"); setTimeout(() => cam.classList.remove("hit"), 500); show(r); setTimeout(() => (lastVal = ""), 3000); }
      busy = false;
    }
    raf = requestAnimationFrame(loop);
  }
  $("#start", v).onclick = start;
  $("#stop", v).onclick = stop;
  $("#flip", v).onclick = () => { facing = facing === "environment" ? "user" : "environment"; stop(); start(); };
  $("#torch", v).onclick = async () => { const t = stream?.getVideoTracks()[0]; if (!t) return; const on = !t.getSettings().torch; try { await t.applyConstraints({ advanced: [{ torch: on }] }); } catch { /* sin linterna */ } };
  async function fromFile(file) {
    try {
      const c = await fileToCanvas(file);
      const r = await decodeCanvas(c);
      if (r) show(r); else toast("No encuentro ningún QR en esa imagen. Prueba con una más nítida", "bad");
    } catch (err) { toast(err.message, "bad"); }
  }
  const snf = $("#snapf", v);
  $("#snap", v).onclick = () => snf.click();
  snf.onchange = () => { if (snf.files[0]) fromFile(snf.files[0]); snf.value = ""; };
  const sd = $("#sdrop", v), sf = $("#sfile", v);
  sd.onclick = () => sf.click();
  sf.onchange = () => { if (sf.files[0]) fromFile(sf.files[0]); sf.value = ""; };
  ["dragenter", "dragover"].forEach((t) => sd.addEventListener(t, (e) => { e.preventDefault(); sd.classList.add("over"); }));
  ["dragleave", "drop"].forEach((t) => sd.addEventListener(t, (e) => { e.preventDefault(); sd.classList.remove("over"); }));
  sd.addEventListener("drop", (e) => { const f = e.dataTransfer.files[0]; if (f) fromFile(f); });
  const onPaste = (e) => { const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith("image/")); if (f) { e.preventDefault(); fromFile(f); } };
  document.addEventListener("paste", onPaste);
  cleanup = () => { stop(); document.removeEventListener("paste", onPaste); };
  drawHist();
}

// =============================================================================
// POR LOTES
// =============================================================================
function viewBatch(v) {
  const design = (E && E.design) || mergeDesign(JSON.parse(localStorage.getItem("qp-draft") || "{}").design || {});
  v.innerHTML = `<div class="page-head"><div><h1>QR por lotes</h1><p>Crea decenas de QR de golpe con el diseño que tienes en «Crear».</p></div></div>
  <div class="batch">
    <div class="card pad steps">
      <b>Una línea por QR</b>
      <div class="small muted">Escribe <code>nombre ; contenido</code> o solo el contenido. También puedes cargar un CSV (dos columnas: nombre, contenido).</div>
      <textarea id="lines" placeholder="Mesa 1 ; https://mirestaurante.com/carta?mesa=1&#10;Mesa 2 ; https://mirestaurante.com/carta?mesa=2&#10;https://tuweb.com/oferta"></textarea>
      <div class="row"><button class="btn sm" id="csv">${icon("upload", "sm")}Cargar CSV</button><input type="file" id="csvf" accept=".csv,.txt,text/csv" hidden>
        <button class="btn sm ghost" id="seq">${icon("sparkle", "sm")}Generar numerados</button><span class="grow"></span><span class="small muted" id="count"></span></div>
      <div class="row">
        <label class="field half" style="flex:1"><span>Formato</span><select id="bfmt"><option value="png">PNG</option><option value="svg">SVG</option><option value="jpg">JPG</option><option value="webp">WebP</option><option value="pdf">PDF</option></select></label>
        <label class="field half" style="flex:1"><span>Tamaño</span><select id="bsize"><option value="512">512 px</option><option value="1024" selected>1024 px</option><option value="2048">2048 px</option></select></label>
      </div>
      <div class="progress hidden" id="prog"><i></i></div>
      <div class="actions"><button class="btn primary" id="go">${icon("zip")}Descargar ZIP</button><button class="btn" id="savell">${icon("save")}Guardar en la biblioteca</button></div>
    </div>
    <div class="card pad"><div class="row between"><b>Vista previa</b><a class="small" href="#/crear">Cambiar diseño</a></div><div class="bgrid" id="bprev" style="margin-top:12px"></div></div>
  </div>`;
  const parseLines = () => $("#lines", v).value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 1000).map((l, i) => {
    const m = l.match(/^([^;,\t]{1,80})\s*[;\t]\s*(.+)$/) || l.match(/^"?([^",]{1,80})"?\s*,\s*"?(.+?)"?$/);
    const content = m ? m[2].trim() : l, name = m ? m[1].trim() : `QR ${i + 1}`;
    return { name, content: /^www\./i.test(content) ? "https://" + content : content, design, kind: /^https?:/i.test(content) ? "url" : "text" };
  });
  const prev = debounce(() => {
    const items = parseLines();
    $("#count", v).textContent = items.length ? `${items.length} QR` : "";
    $("#bprev", v).innerHTML = items.slice(0, 24).map((q) => `<figure><div>${renderQR(q)}</div><figcaption>${esc(q.name)}</figcaption></figure>`).join("") + (items.length > 24 ? `<figure><div class="muted">+${items.length - 24}</div></figure>` : "") || `<div class="muted small">Escribe algunas líneas a la izquierda.</div>`;
  }, 250);
  $("#lines", v).addEventListener("input", prev);
  $("#csv", v).onclick = () => $("#csvf", v).click();
  $("#csvf", v).onchange = async (e) => { const f = e.target.files[0]; if (f) { $("#lines", v).value = (await f.text()).split(/\r?\n/).filter((l, i) => !(i === 0 && /nombre|name/i.test(l))).join("\n"); prev(); } };
  $("#seq", v).onclick = async () => {
    const base = await promptDlg("Generar numerados", "Dirección base (se añade el número al final)", "https://tuweb.com/mesa/", "https://...");
    if (!base) return;
    const n = Math.min(500, +(await promptDlg("¿Cuántos?", "Cantidad", "10")) || 0);
    $("#lines", v).value = Array.from({ length: n }, (_, i) => `${i + 1} ; ${base}${i + 1}`).join("\n"); prev();
  };
  const prog = $("#prog", v), bar = $("#prog i", v);
  $("#go", v).onclick = async () => {
    const items = parseLines(); if (!items.length) return toast("Escribe al menos una línea", "bad");
    prog.classList.remove("hidden");
    await zipQRs(items, $("#bfmt", v).value, +$("#bsize", v).value, (k) => (bar.style.width = k * 100 + "%"));
    confetti(); setTimeout(() => prog.classList.add("hidden"), 800);
  };
  $("#savell", v).onclick = async () => {
    const items = parseLines(); if (!items.length) return toast("Escribe al menos una línea", "bad");
    prog.classList.remove("hidden");
    for (let i = 0; i < items.length; i++) {
      const q = items[i];
      const fields = q.kind === "url" ? { url: q.content } : { text: q.content };
      S.qrs.unshift(await S.store.create({ ...q, fields, folder: "Lote " + new Date().toLocaleDateString("es-ES") }));
      bar.style.width = ((i + 1) / items.length) * 100 + "%";
    }
    toast(`${items.length} QR guardados en la carpeta del lote`); confetti(); setTimeout(() => prog.classList.add("hidden"), 800);
  };
  prev();
}

// =============================================================================
// AJUSTES
// =============================================================================
let installEvt = null;
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; });

async function changePassword() {
  const r = await dialog({
    title: "Cambiar contraseña",
    body: `<div class="steps" style="gap:10px"><label class="field"><span>Contraseña actual</span><input type="password" id="pw0" autocomplete="current-password"></label><label class="field"><span>Nueva (mínimo 6)</span><input type="password" id="pw1" autocomplete="new-password"></label></div>`,
    buttons: [["Cancelar", null], ["Cambiar", (w) => [w.querySelector("#pw0").value, w.querySelector("#pw1").value], "primary"]],
  });
  if (!r) return;
  try { await S.store.password(r[0], r[1]); toast("Contraseña cambiada. Las demás sesiones se han cerrado"); } catch (e) { toast(e.message, "bad"); }
}

async function viewSettings(v) {
  const srv = S.store.mode === "server", admin = srv && S.me.is_admin;
  const theme = localStorage.getItem("qp-theme") || "system";
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  v.innerHTML = `<div class="page-head"><div><h1>Ajustes</h1><p>${srv ? `Conectado como <b>${esc(S.me.username)}</b>${S.me.is_admin ? " (administrador)" : ""}.` : "Modo local: todo se guarda en este navegador."}</p></div></div>
  <div class="settings">
    <div class="card pad"><h3>${icon("sun")}Apariencia</h3>
      <div class="seg" id="theme-seg">${[["system", "Como el sistema"], ["light", "Claro"], ["dark", "Oscuro"]].map(([k, t]) => `<button data-v="${k}" class="${theme === k ? "on" : ""}">${t}</button>`).join("")}</div></div>

    ${APP ? `<div class="card pad"><h3>${icon("phone")}App de Android</h3>
      <div class="small muted">Estás en la app QRPanel ${esc(appVersion())}. Si cambias de casa a fuera (o al revés), la app elige sola la dirección que funciona.</div>
      <div class="row"><button class="btn" id="appsrv">${icon("globe")}Cambiar servidor</button><button class="btn ghost" id="appnews">${icon("sparkle")}Novedades de la app</button></div></div>` : `<div class="card pad"><h3>${icon("phone")}App para Android</h3>
      <div class="small muted">Descarga la app QRPanel (APK) para entrar desde el móvil con tu usuario, en casa o desde fuera. Guarda y comparte los QR por WhatsApp, Telegram…</div>
      <div class="row"><a class="btn" href="https://github.com/pctecnikk/qrpanel/releases?q=android&expanded=true" target="_blank" rel="noopener">${icon("download")}Descargar la app</a></div></div>`}

    ${APP ? "" : `<div class="card pad"><h3>${icon("install")}Instalar como app</h3>
      <div class="small muted">QRPanel funciona como una app: con su icono, a pantalla completa y sin conexión para crear y escanear.</div>
      ${isIOS ? `<div class="small">En iPhone/iPad: pulsa <b>Compartir</b> en Safari y luego <b>Añadir a pantalla de inicio</b>.</div>` : `<button class="btn primary" id="install" ${installEvt ? "" : "disabled"}>${icon("install")}Instalar QRPanel</button><div class="small faint">${installEvt ? "" : matchMedia("(display-mode: standalone)").matches ? "Ya está instalada." : "Si el botón no se activa, usa el menú del navegador → «Instalar aplicación»."}</div>`}
    </div>`}

    <div class="card pad"><h3>${icon("box")}Copia de seguridad</h3>
      <div class="small muted">Descarga todos tus QR, logos y plantillas en un archivo, o recupéralos desde uno.</div>
      <div class="row"><button class="btn" id="exp">${icon("download")}Exportar</button><button class="btn" id="imp">${icon("upload")}Importar</button><input type="file" id="impf" accept=".json,application/json" hidden></div></div>

    ${srv ? `<div class="card pad"><h3>${icon("user")}Tu cuenta</h3><div class="row"><button class="btn" id="pw">${icon("key")}Cambiar contraseña</button><button class="btn danger" id="out">${icon("logout")}Salir</button></div></div>` : ""}

    ${admin ? `<div class="card pad"><h3>${icon("globe")}Dirección pública</h3>
      <div class="small muted">La dirección con la que se llega a QRPanel desde internet. Es la que llevan dentro los QR dinámicos, así que ponla <b>antes</b> de imprimirlos. Ejemplo: <code>https://qr.midominio.com</code></div>
      <div class="row"><input class="input grow" id="purl" value="${esc(S.me.public_url_custom || "")}" placeholder="${esc(location.origin)}"><button class="btn primary" id="psave">Guardar</button></div>
      <div class="small faint">Ahora se usa: ${esc(S.me.public_url)}</div></div>

    <div class="card pad"><h3>${icon("sparkle")}Tu marca</h3>
      <div class="small muted">Pon el nombre y el logo de tu negocio o tu familia. Se ven arriba, en la pantalla de entrada y en las páginas de QR compartidos.</div>
      <div class="row"><div class="drop" id="bdrop" style="padding:10px;flex:none"><div class="thumb" id="bthumb">${S.brand?.logo ? `<img src="${esc(S.brand.logo)}" alt="">` : icon("image", "lg")}</div></div>
        <input class="input grow" id="bname" maxlength="40" placeholder="QRPanel" value="${esc(S.brand?.name && S.brand.name !== "QRPanel" ? S.brand.name : "")}"><input type="file" id="bfile" accept="image/*" hidden></div>
      <div class="row"><button class="btn primary" id="bsave">Guardar marca</button><button class="btn ghost" id="breset">Volver a QRPanel</button></div></div>

    <div class="card pad" style="grid-column:1/-1"><div class="row between"><h3>${icon("users")}Usuarios</h3><button class="btn sm" id="uadd">${icon("plus", "sm")}Crear usuario</button></div><div class="ulist" id="ulist"></div></div>` : ""}

    <div class="card pad"><h3>${icon("info")}Acerca de</h3>
      <div class="small"><b>Web ${esc(S.info?.version || S.me.version || "")}</b>${APP ? ` · <b>App ${esc(appVersion())}</b>` : ""} · QRPanel, tu propio generador de códigos QR. Código disponible gratis para uso no comercial (licencia PolyForm Noncommercial).</div>
      <div class="small faint">«QR Code» es una marca registrada de DENSO WAVE INCORPORATED. Los nombres de servicios que aparecen (WhatsApp, Google Maps…) son de sus dueños y solo se usan para indicar con qué funcionan.</div>
      <div class="row"><a class="btn sm" href="https://github.com/pctecnikk/qrpanel" target="_blank" rel="noopener">${icon("github", "sm")}GitHub</a><a class="btn sm ghost" href="/static/vendor/LICENSES.txt" target="_blank">Licencias</a></div>
      <div class="small faint">Atajos: Ctrl+S guardar · Ctrl+Z deshacer · Ctrl+Y rehacer · Ctrl+V pegar logo o imagen.</div></div>
  </div>`;
  $("#theme-seg", v).onclick = (e) => { const b = e.target.closest("[data-v]"); if (!b) return; localStorage.setItem("qp-theme", b.dataset.v); applyTheme(); $$("#theme-seg button", v).forEach((x) => x.classList.toggle("on", x === b)); $("#theme").innerHTML = icon(document.documentElement.dataset.theme === "dark" ? "sun" : "moon"); };
  $("#appsrv", v)?.addEventListener("click", () => APP.changeServer());
  $("#appnews", v)?.addEventListener("click", () => APP.news());
  $("#install", v)?.addEventListener("click", async () => { if (!installEvt) return; installEvt.prompt(); const r = await installEvt.userChoice; if (r.outcome === "accepted") { confetti(); toast("¡Instalada!"); } installEvt = null; });
  $("#exp", v).onclick = async () => { const d = await S.store.exportAll(); download(new Blob([JSON.stringify(d, null, 1)], { type: "application/json" }), `qrpanel-copia-${new Date().toISOString().slice(0, 10)}.json`); };
  $("#imp", v).onclick = () => $("#impf", v).click();
  $("#impf", v).onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (data.app !== "qrpanel") throw new Error("Ese archivo no es una copia de QRPanel");
      const r = await S.store.importAll(data);
      await loadData(); toast(`Importados ${r.qrs} QR y ${r.logos} logos`); confetti();
    } catch (err) { toast(err.message, "bad"); }
  };
  $("#pw", v)?.addEventListener("click", changePassword);
  $("#out", v)?.addEventListener("click", async () => { await S.store.logout(); location.reload(); });
  if (!admin) return;
  let blogo = S.brand?.logo || null;
  $("#bdrop", v).onclick = () => $("#bfile", v).click();
  $("#bfile", v).onchange = async (e) => {
    try { blogo = await readImage(e.target.files[0], 256); $("#bthumb", v).innerHTML = `<img src="${esc(blogo)}" alt="">`; } catch (err) { toast(err.message, "bad"); }
  };
  const saveBrand = async (b) => {
    try { const r = await S.store.saveBrand(b); S.brand = r.brand; applyBrand(); shell(); route(); toast("Marca guardada"); } catch (err) { toast(err.message, "bad"); }
  };
  $("#bsave", v).onclick = () => saveBrand({ name: $("#bname", v).value, logo: blogo });
  $("#breset", v).onclick = () => saveBrand({ name: "", logo: null });
  $("#psave", v).onclick = async () => {
    try { await S.store.saveSettings({ public_url: $("#purl", v).value }); S.me = await S.store.me(); toast("Dirección guardada"); route(); } catch (e) { toast(e.message, "bad"); }
  };
  async function users() {
    const list = await S.store.users();
    const st = { approved: ["Activo", "ok"], pending: ["Pendiente", ""], blocked: ["Bloqueado", "off"] };
    $("#ulist", v).innerHTML = list.map((u) => `<div class="urow"><span class="avatar">${esc(u.username[0].toUpperCase())}</span><div class="grow"><b>${esc(u.username)}</b>${u.is_admin ? ' <span class="chip">admin</span>' : ""} <span class="chip ${st[u.status][1]}">${st[u.status][0]}</span><div class="small muted">${fmtN(u.qrs)} QR · ${fmtN(u.scans)} lecturas · desde ${fmtDate(u.created)}</div></div>
      ${u.status === "pending" ? `<button class="btn sm primary" data-u="${u.id}" data-a="approve">Aprobar</button>` : ""}
      ${u.username !== S.me.username ? `<button class="btn ghost icon" data-u="${u.id}" data-a="more">${icon("dots")}</button>` : ""}</div>`).join("");
    $("#ulist", v).onclick = async (e) => {
      const b = e.target.closest("[data-a]"); if (!b) return;
      const id = +b.dataset.u, u = list.find((x) => x.id === id);
      const doit = async (fn, msg) => { try { await fn(); toast(msg); users(); } catch (err) { toast(err.message, "bad"); } };
      if (b.dataset.a === "approve") return doit(() => S.store.updUser(id, { status: "approved" }), "Usuario aprobado");
      menu(b, [
        u.status === "blocked" ? { icon: "play", label: "Desbloquear", run: () => doit(() => S.store.updUser(id, { status: "approved" }), "Desbloqueado") }
          : { icon: "pause", label: "Bloquear", run: () => doit(() => S.store.updUser(id, { status: "blocked" }), "Bloqueado") },
        { icon: "shield", label: u.is_admin ? "Quitar administrador" : "Hacer administrador", run: () => doit(() => S.store.updUser(id, { is_admin: !u.is_admin }), "Cambiado") },
        { icon: "key", label: "Poner contraseña nueva", run: async () => { const p = await promptDlg("Contraseña nueva", `Para ${u.username} (mínimo 6)`); if (p) doit(() => S.store.updUser(id, { password: p }), "Contraseña cambiada"); } },
        "-",
        { icon: "trash", label: "Eliminar usuario y sus QR", danger: true, run: async () => { if (await confirmDlg(`¿Eliminar a ${u.username}?`, "Se borran también sus QR, logos y estadísticas.")) doit(() => S.store.delUser(id), "Eliminado"); } },
      ]);
    };
  }
  $("#uadd", v).onclick = async () => {
    const r = await dialog({
      title: "Crear usuario",
      body: `<div class="steps" style="gap:10px"><label class="field"><span>Usuario</span><input id="nu" maxlength="32"></label><label class="field"><span>Contraseña (mínimo 6)</span><input id="np" type="password"></label><label class="switch"><input type="checkbox" id="na"><i></i><span>Administrador</span></label></div>`,
      buttons: [["Cancelar", null], ["Crear", (w) => ({ username: w.querySelector("#nu").value, password: w.querySelector("#np").value, is_admin: w.querySelector("#na").checked }), "primary"]],
    });
    if (!r) return;
    try { await S.store.addUser(r); toast("Usuario creado"); users(); } catch (e) { toast(e.message, "bad"); }
  };
  users();
}

// --- app instalable --------------------------------------------------------------------
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

boot().catch((e) => { app.innerHTML = `<div class="auth"><div class="card pad">No se pudo arrancar QRPanel: ${esc(e.message)}</div></div>`; });
