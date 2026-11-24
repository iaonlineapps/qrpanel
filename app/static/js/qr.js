// Motor de QRPanel: convierte un texto y un diseño en un SVG listo para ver o descargar.
// Usa qrcode.js (Kazuhiko Arase, MIT) solo para calcular la matriz; el dibujo es propio.
const QR = window.qrcode;
QR.stringToBytes = QR.stringToBytesFuncs["UTF-8"];

export const DEFAULT_DESIGN = {
  ecc: "M",
  margin: 3,
  dots: { shape: "rounded", scale: 1 },
  fg: { type: "solid", c1: "#0f172a", c2: "#6d28d9", angle: 45 },
  bg: { type: "solid", c1: "#ffffff", c2: "#e0e7ff", angle: 135, radius: 0.06 },
  eyes: { frame: "rounded", ball: "rounded", custom: false, frameColor: "#0f172a", ballColor: "#6d28d9" },
  logo: { src: null, id: null, size: 0.22, pad: 1, plate: true, plateColor: "#ffffff", round: 0.3, excavate: true },
  frame: { style: "none", text: "ESCANÉAME", color: "#0f172a", textColor: "#ffffff", font: "sans" },
};

export const DOT_SHAPES = [
  ["square", "Cuadrado"], ["rounded", "Redondeado"], ["liquid", "Líquido"], ["dots", "Puntos"],
  ["tiny", "Píxel"], ["classy", "Elegante"], ["diamond", "Rombo"], ["star", "Estrella"],
  ["bars-v", "Barras"], ["bars-h", "Líneas"],
];
export const FRAME_SHAPES = [
  ["square", "Cuadrado"], ["rounded", "Redondeado"], ["circle", "Círculo"], ["leaf", "Hoja"],
  ["bevel", "Biselado"], ["dots", "Puntos"],
];
export const BALL_SHAPES = [
  ["square", "Cuadrado"], ["rounded", "Redondeado"], ["circle", "Círculo"], ["leaf", "Hoja"],
  ["diamond", "Rombo"], ["star", "Estrella"], ["dots", "Puntos"], ["paw", "Huella"],
];
export const FRAMES = [
  ["none", "Sin marco"], ["card", "Tarjeta"], ["top", "Cinta arriba"], ["bubble", "Bocadillo"],
  ["brackets", "Esquinas"], ["ticket", "Entrada"],
];
const FONTS = {
  sans: "Inter, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  rounded: "'Nunito', 'Varela Round', 'Arial Rounded MT Bold', 'Segoe UI', sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'JetBrains Mono', Consolas, 'Courier New', monospace",
};

const n3 = (v) => Math.round(v * 1000) / 1000;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const color = (c, d = "#000000") => (/^#[0-9a-fA-F]{6}$/.test(c || "") ? c : d);

export function mergeDesign(d) {
  const out = structuredClone(DEFAULT_DESIGN);
  for (const k of Object.keys(d || {})) {
    if (d[k] && typeof d[k] === "object" && !Array.isArray(d[k]) && typeof out[k] === "object") Object.assign(out[k], d[k]);
    else if (d[k] !== undefined) out[k] = d[k];
  }
  return out;
}

/** Matriz del QR: {n, dark(r,c)}. Elige la version mas pequeña que quepa. */
export function matrix(text, ecc = "M") {
  const q = QR(0, ecc);
  q.addData(text || " ", "Byte");
  q.make();
  const n = q.getModuleCount();
  const grid = [];
  for (let r = 0; r < n; r++) { const row = []; for (let c = 0; c < n; c++) row.push(q.isDark(r, c)); grid.push(row); }
  return { n, version: (n - 17) / 4, grid };
}

// --- formas -------------------------------------------------------------------
function rr(x, y, w, h, tl, tr, br, bl) {
  return `M${n3(x + tl)} ${n3(y)}H${n3(x + w - tr)}${tr ? `A${tr} ${tr} 0 0 1 ${n3(x + w)} ${n3(y + tr)}` : ""}` +
    `V${n3(y + h - br)}${br ? `A${br} ${br} 0 0 1 ${n3(x + w - br)} ${n3(y + h)}` : ""}` +
    `H${n3(x + bl)}${bl ? `A${bl} ${bl} 0 0 1 ${n3(x)} ${n3(y + h - bl)}` : ""}` +
    `V${n3(y + tl)}${tl ? `A${tl} ${tl} 0 0 1 ${n3(x + tl)} ${n3(y)}` : ""}Z`;
}
const circle = (cx, cy, r) => `M${n3(cx - r)} ${n3(cy)}a${n3(r)} ${n3(r)} 0 1 0 ${n3(2 * r)} 0a${n3(r)} ${n3(r)} 0 1 0 ${n3(-2 * r)} 0Z`;
function star(cx, cy, R, r, pts = 5, rot = -Math.PI / 2) {
  let d = "";
  for (let i = 0; i < pts * 2; i++) {
    const a = rot + (i * Math.PI) / pts, rad = i % 2 ? r : R;
    d += (i ? "L" : "M") + n3(cx + Math.cos(a) * rad) + " " + n3(cy + Math.sin(a) * rad);
  }
  return d + "Z";
}
const diamond = (cx, cy, r) => `M${n3(cx)} ${n3(cy - r)}L${n3(cx + r)} ${n3(cy)}L${n3(cx)} ${n3(cy + r)}L${n3(cx - r)} ${n3(cy)}Z`;
function octagon(x, y, s, cut) {
  return `M${n3(x + cut)} ${n3(y)}H${n3(x + s - cut)}L${n3(x + s)} ${n3(y + cut)}V${n3(y + s - cut)}L${n3(x + s - cut)} ${n3(y + s)}` +
    `H${n3(x + cut)}L${n3(x)} ${n3(y + s - cut)}V${n3(y + cut)}Z`;
}

function modulesPath(m, skip, shape, scale) {
  const { n, grid } = m;
  const on = (r, c) => r >= 0 && c >= 0 && r < n && c < n && grid[r][c] && !skip(r, c);
  let d = "";
  if (shape === "square") {
    for (let r = 0; r < n; r++) {
      let c = 0;
      while (c < n) {
        if (!on(r, c)) { c++; continue; }
        let e = c; while (e < n && on(r, e)) e++;
        d += `M${c} ${r}h${e - c}v1h${c - e}Z`; c = e;
      }
    }
    return d;
  }
  if (shape === "bars-v" || shape === "bars-h") {
    const v = shape === "bars-v", w = 0.82 * scale, o = (1 - w) / 2, rad = w / 2;
    for (let a = 0; a < n; a++) {
      let b = 0;
      while (b < n) {
        const ok = (k) => (v ? on(k, a) : on(a, k));
        if (!ok(b)) { b++; continue; }
        let e = b; while (e < n && ok(e)) e++;
        const len = e - b - 2 * o;
        d += v ? rr(a + o, b + o, w, len, rad, rad, rad, rad) : rr(b + o, a + o, len, w, rad, rad, rad, rad);
        b = e;
      }
    }
    return d;
  }
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const x = c, y = r, cx = c + 0.5, cy = r + 0.5;
    if (!on(r, c)) {
      if (shape === "liquid" && !skip(r, c)) { // rellenos curvos en los huecos para que fluya
        const t = on(r - 1, c), b = on(r + 1, c), l = on(r, c - 1), rt = on(r, c + 1), h = 0.5;
        if (t && l && on(r - 1, c - 1)) d += `M${x} ${y}h${h}A${h} ${h} 0 0 0 ${x} ${y + h}Z`;
        if (t && rt && on(r - 1, c + 1)) d += `M${x + 1} ${y}v${h}A${h} ${h} 0 0 0 ${x + h} ${y}Z`;
        if (b && rt && on(r + 1, c + 1)) d += `M${x + 1} ${y + 1}h${-h}A${h} ${h} 0 0 0 ${x + 1} ${y + h}Z`;
        if (b && l && on(r + 1, c - 1)) d += `M${x} ${y + 1}v${-h}A${h} ${h} 0 0 0 ${x + h} ${y + 1}Z`;
      }
      continue;
    }
    switch (shape) {
      case "dots": d += circle(cx, cy, 0.5 * scale * 0.96); break;
      case "tiny": { const s = 0.72 * scale, o = (1 - s) / 2; d += `M${n3(x + o)} ${n3(y + o)}h${n3(s)}v${n3(s)}h${n3(-s)}Z`; break; }
      case "diamond": d += diamond(cx, cy, 0.6 * scale); break;
      case "star": d += star(cx, cy, 0.62 * scale, 0.3 * scale); break;
      case "classy": case "rounded": case "liquid": {
        const t = on(r - 1, c), b = on(r + 1, c), l = on(r, c - 1), rt = on(r, c + 1), R = 0.5;
        let tl = !t && !l ? R : 0, tr = !t && !rt ? R : 0, br = !b && !rt ? R : 0, bl = !b && !l ? R : 0;
        if (shape === "classy") { tr = 0; bl = 0; }
        d += rr(x, y, 1, 1, tl, tr, br, bl);
        break;
      }
      default: d += `M${x} ${y}h1v1h-1Z`;
    }
  }
  return d;
}

function eyeFrame(x, y, shape) {
  switch (shape) {
    case "rounded": return rr(x, y, 7, 7, 2.2, 2.2, 2.2, 2.2) + rr(x + 1, y + 1, 5, 5, 1.3, 1.3, 1.3, 1.3);
    case "circle": return circle(x + 3.5, y + 3.5, 3.5) + circle(x + 3.5, y + 3.5, 2.5);
    case "leaf": return rr(x, y, 7, 7, 3, 0.4, 3, 0.4) + rr(x + 1, y + 1, 5, 5, 2, 0.2, 2, 0.2);
    case "bevel": return octagon(x, y, 7, 2) + octagon(x + 1, y + 1, 5, 1.4);
    case "dots": {
      let d = "";
      for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++)
        if (i === 0 || j === 0 || i === 6 || j === 6) d += circle(x + i + 0.5, y + j + 0.5, 0.46);
      return d;
    }
    default: return `M${x} ${y}h7v7h-7Z M${x + 1} ${y + 1}h5v5h-5Z`;
  }
}
function eyeBall(x, y, shape) {
  const cx = x + 1.5, cy = y + 1.5;
  switch (shape) {
    case "rounded": return rr(x, y, 3, 3, 0.9, 0.9, 0.9, 0.9);
    case "circle": return circle(cx, cy, 1.5);
    case "leaf": return rr(x, y, 3, 3, 1.4, 0.2, 1.4, 0.2);
    case "diamond": return diamond(cx, cy, 1.85);
    case "star": return star(cx, cy, 2.0, 0.95, 5);
    case "dots": { let d = ""; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) d += circle(x + i + 0.5, y + j + 0.5, 0.5); return d; }
    case "paw": {
      // huella: almohadilla y cuatro dedos, ocupando el cuadrado de 3x3
      const el = (ex, ey, rx, ry) => `M${n3(ex - rx)} ${n3(ey)}a${n3(rx)} ${n3(ry)} 0 1 0 ${n3(2 * rx)} 0a${n3(rx)} ${n3(ry)} 0 1 0 ${n3(-2 * rx)} 0Z`;
      return el(cx, cy + 0.5, 1.02, 0.92) + el(cx - 1.12, cy - 0.22, 0.42, 0.5) + el(cx + 1.12, cy - 0.22, 0.42, 0.5) + el(cx - 0.45, cy - 1.0, 0.44, 0.52) + el(cx + 0.45, cy - 1.0, 0.44, 0.52);
    }
    default: return `M${x} ${y}h3v3h-3Z`;
  }
}

function paint(id, p, x0, y0, size) {
  if (p.type === "linear") {
    const a = ((Number(p.angle) || 0) * Math.PI) / 180, cx = x0 + size / 2, cy = y0 + size / 2, h = size / 2;
    const dx = Math.cos(a) * h, dy = Math.sin(a) * h;
    return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${n3(cx - dx)}" y1="${n3(cy - dy)}" x2="${n3(cx + dx)}" y2="${n3(cy + dy)}">` +
      `<stop offset="0" stop-color="${color(p.c1)}"/><stop offset="1" stop-color="${color(p.c2)}"/></linearGradient>`;
  }
  if (p.type === "radial") {
    return `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${n3(x0 + size / 2)}" cy="${n3(y0 + size / 2)}" r="${n3(size * 0.62)}">` +
      `<stop offset="0" stop-color="${color(p.c1)}"/><stop offset="1" stop-color="${color(p.c2)}"/></radialGradient>`;
  }
  return "";
}
const fillOf = (id, p) => (p.type === "linear" || p.type === "radial" ? `url(#${id})` : color(p.c1));

/**
 * Dibuja el QR. Devuelve {svg, n, version, w, h}.
 * opts.logoSrc: data URL del logo ya resuelto (si el diseño lo guarda por id).
 */
export function render(text, design, opts = {}) {
  const D = mergeDesign(design);
  const logoSrc = opts.logoSrc ?? D.logo.src;
  const hasLogo = !!logoSrc;
  const ecc = hasLogo && D.ecc !== "H" && D.ecc !== "Q" ? "H" : D.ecc;
  const m = matrix(text, ecc);
  const { n } = m;
  const mg = Math.max(0, Math.min(8, Number(D.margin) || 0));
  const T = n + 2 * mg;
  const uid = "q" + Math.random().toString(36).slice(2, 8);

  // zona del logo
  let lb = null;
  if (hasLogo) {
    const s = Math.max(0.1, Math.min(0.32, Number(D.logo.size) || 0.22)) * n;
    const pad = Math.max(0, Math.min(3, Number(D.logo.pad) || 0));
    lb = { x: (n - s) / 2, y: (n - s) / 2, s, pad };
  }
  const inEye = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  const inLogo = (r, c) => lb && D.logo.excavate &&
    c + 1 > lb.x - lb.pad && c < lb.x + lb.s + lb.pad && r + 1 > lb.y - lb.pad && r < lb.y + lb.s + lb.pad;
  const skip = (r, c) => inEye(r, c) || inLogo(r, c);

  const dots = modulesPath(m, skip, D.dots.shape, Math.max(0.5, Math.min(1.1, Number(D.dots.scale) || 1)));
  const eyes = [[0, 0], [n - 7, 0], [0, n - 7]];
  const frames = eyes.map(([x, y]) => eyeFrame(x, y, D.eyes.frame)).join("");
  const balls = eyes.map(([x, y]) => eyeBall(x + 2, y + 2, D.eyes.ball)).join("");

  let defs = paint(uid + "f", D.fg, 0, 0, n) + paint(uid + "b", D.bg, -mg, -mg, T);
  const fg = fillOf(uid + "f", D.fg);
  const frameFill = D.eyes.custom ? color(D.eyes.frameColor) : fg;
  const ballFill = D.eyes.custom ? color(D.eyes.ballColor) : fg;
  const bgRad = Math.max(0, Math.min(0.5, Number(D.bg.radius) || 0)) * T;

  let qr = "";
  if (D.bg.type !== "none") qr += `<rect x="${-mg}" y="${-mg}" width="${T}" height="${T}" rx="${n3(bgRad)}" fill="${fillOf(uid + "b", D.bg)}"/>`;
  qr += `<path d="${dots}" fill="${fg}"/>`;
  qr += `<path d="${frames}" fill="${frameFill}" fill-rule="evenodd"/>`;
  qr += `<path d="${balls}" fill="${ballFill}"/>`;
  if (lb) {
    const p = lb.pad * 0.6, ps = lb.s + 2 * p;
    if (D.logo.plate) qr += `<rect x="${n3(lb.x - p)}" y="${n3(lb.y - p)}" width="${n3(ps)}" height="${n3(ps)}" rx="${n3(ps * (Number(D.logo.round) || 0) / 2)}" fill="${color(D.logo.plateColor, "#ffffff")}"/>`;
    qr += `<image href="${esc(logoSrc)}" x="${n3(lb.x)}" y="${n3(lb.y)}" width="${n3(lb.s)}" height="${n3(lb.s)}" preserveAspectRatio="xMidYMid meet"/>`;
  }

  // marco con texto
  const F = D.frame, fc = color(F.color, "#0f172a"), tc = color(F.textColor, "#ffffff");
  const font = FONTS[F.font] || FONTS.sans;
  const label = esc(String(F.text || "").slice(0, 40));
  let vx = -mg, vy = -mg, w = T, h = T, under = "", over = "";
  const L = T * 0.2, P = T * 0.05;
  // el texto se encoge si no cabe (los textos largos no se salen del marco)
  const nch = Math.max(1, [...String(F.text || "").slice(0, 40)].length);
  const txt = (y, fill, avail = T * 0.92) => {
    const fs = Math.min(L * 0.42, avail / (nch * 0.68)), ls = fs * 0.07;
    return `<text x="${n3(-mg + T / 2)}" y="${n3(y)}" text-anchor="middle" dominant-baseline="central" font-family="${esc(font)}" font-weight="800" font-size="${n3(fs)}" letter-spacing="${n3(ls)}" fill="${fill}">${label}</text>`;
  };
  switch (F.style) {
    case "card":
      vx -= P; vy -= P; w += 2 * P; h += 2 * P + L;
      under = `<rect x="${n3(vx)}" y="${n3(vy)}" width="${n3(w)}" height="${n3(h)}" rx="${n3(T * 0.08)}" fill="${fc}"/>`;
      over = txt(-mg + T + P + L / 2, tc); break;
    case "top":
      vx -= P; vy -= P + L; w += 2 * P; h += 2 * P + L;
      under = `<rect x="${n3(vx)}" y="${n3(vy)}" width="${n3(w)}" height="${n3(h)}" rx="${n3(T * 0.08)}" fill="${fc}"/>`;
      over = txt(-mg - P - L / 2, tc); break;
    case "bubble": {
      const s = T * 0.025;
      vx -= P + s; vy -= P + s; w += 2 * (P + s); h += 2 * (P + s) + L * 1.25;
      under = `<rect x="${n3(-mg - P)}" y="${n3(-mg - P)}" width="${n3(T + 2 * P)}" height="${n3(T + 2 * P)}" rx="${n3(T * 0.08)}" fill="none" stroke="${fc}" stroke-width="${n3(s * 2)}"/>`;
      const by = -mg + T + P + s + L * 0.3, bw = Math.min(T + 2 * P, Math.max(T * 0.78, nch * L * 0.42 * 0.68 + L * 0.6)), bx = -mg + (T - bw) / 2, cx = -mg + T / 2;
      over = `<path d="M${n3(cx - L * 0.18)} ${n3(by + 0.5)}L${n3(cx)} ${n3(by - L * 0.22)}L${n3(cx + L * 0.18)} ${n3(by + 0.5)}Z" fill="${fc}"/>` +
        `<rect x="${n3(bx)}" y="${n3(by)}" width="${n3(bw)}" height="${n3(L * 0.9)}" rx="${n3(L * 0.45)}" fill="${fc}"/>` + txt(by + L * 0.45, tc, bw - L * 0.6);
      break;
    }
    case "brackets": {
      const g = P * 1.4, k = T * 0.22, s = T * 0.03, x0 = -mg - g, y0 = -mg - g, x1 = -mg + T + g, y1 = -mg + T + g;
      vx = x0 - s; vy = y0 - s; w = x1 - x0 + 2 * s; h = y1 - y0 + 2 * s + L;
      const c = (d) => `<path d="${d}" fill="none" stroke="${fc}" stroke-width="${n3(s * 2)}" stroke-linecap="round" stroke-linejoin="round"/>`;
      over = c(`M${n3(x0)} ${n3(y0 + k)}V${n3(y0)}H${n3(x0 + k)}`) + c(`M${n3(x1 - k)} ${n3(y0)}H${n3(x1)}V${n3(y0 + k)}`) +
        c(`M${n3(x1)} ${n3(y1 - k)}V${n3(y1)}H${n3(x1 - k)}`) + c(`M${n3(x0 + k)} ${n3(y1)}H${n3(x0)}V${n3(y1 - k)}`) + txt(y1 + L * 0.55, fc);
      break;
    }
    case "ticket": {
      vx -= P; vy -= P; w += 2 * P; h += 2 * P + L * 1.1;
      const sep = -mg + T + P * 0.9, r = L * 0.22;
      under = `<rect x="${n3(vx)}" y="${n3(vy)}" width="${n3(w)}" height="${n3(h)}" rx="${n3(T * 0.05)}" fill="${fc}"/>`;
      over = `<line x1="${n3(vx + r * 1.6)}" y1="${n3(sep)}" x2="${n3(vx + w - r * 1.6)}" y2="${n3(sep)}" stroke="${tc}" stroke-opacity=".55" stroke-width="${n3(T * 0.008)}" stroke-dasharray="${n3(T * 0.02)} ${n3(T * 0.02)}"/>` +
        `<circle cx="${n3(vx)}" cy="${n3(sep)}" r="${n3(r)}" fill="${opts.cut || "#fff"}" class="qp-notch"/><circle cx="${n3(vx + w)}" cy="${n3(sep)}" r="${n3(r)}" fill="${opts.cut || "#fff"}" class="qp-notch"/>` +
        txt(sep + L * 0.6, tc);
      break;
    }
  }
  const px = opts.size ? ` width="${opts.size}" height="${n3((opts.size * h) / w)}"` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n3(vx)} ${n3(vy)} ${n3(w)} ${n3(h)}"${px} shape-rendering="geometricPrecision"><defs>${defs}</defs>${under}${qr}${over}</svg>`;
  return { svg, n, version: m.version, ecc, w, h };
}

/** Muestra pequeña de una forma de modulo, para los botones del editor. */
export function shapeSample(shape) {
  const g = ["11010", "01110", "10011", "11101", "01011"].map((r) => [...r].map((c) => c === "1"));
  const d = modulesPath({ n: 5, grid: g }, () => false, shape, 1);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-0.3 -0.3 5.6 5.6"><path d="${d}" fill="currentColor"/></svg>`;
}

/** Convierte un SVG en un canvas de `size` px de ancho. */
export function svgToCanvas(svg, size, bgFill) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    img.onload = () => {
      const ratio = img.naturalHeight && img.naturalWidth ? img.naturalHeight / img.naturalWidth : 1;
      const cv = document.createElement("canvas");
      cv.width = size; cv.height = Math.round(size * ratio);
      const ctx = cv.getContext("2d");
      if (bgFill) { ctx.fillStyle = bgFill; ctx.fillRect(0, 0, cv.width, cv.height); }
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      resolve(cv);
    };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

// --- comprobacion de lectura ------------------------------------------------------
function lum(hex) {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
export function contrast(a, b) {
  const x = lum(color(a)), y = lum(color(b));
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

let jsqrLoading = null;
export function loadJsQR() {
  if (window.jsQR) return Promise.resolve(window.jsQR);
  jsqrLoading ||= new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "/static/vendor/jsQR.min.js";
    s.onload = () => res(window.jsQR); s.onerror = rej;
    document.head.appendChild(s);
  });
  return jsqrLoading;
}

function jsqrOnce(jsQR, cv) {
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, cv.width, cv.height);
  const r = jsQR(img.data, cv.width, cv.height, { inversionAttempts: "attemptBoth" });
  return r ? r.data : null;
}
function scaled(src, w, blur) {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = Math.round((src.height * w) / src.width);
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
  if (blur) ctx.filter = `blur(${blur}px)`;
  ctx.drawImage(src, 0, 0, cv.width, cv.height);
  return cv;
}

/**
 * Lee un QR de un canvas o imagen. Prueba BarcodeDetector (rapido, en Android/Chrome/Safari)
 * y luego jsQR a varios tamaños y con un poco de desenfoque, como lo veria una camara.
 * thorough=false hace solo un intento (para la camara en directo).
 */
export async function decodeCanvas(cv, thorough = true) {
  if ("BarcodeDetector" in window) {
    try {
      const det = new window.BarcodeDetector({ formats: ["qr_code"] });
      const r = await det.detect(cv);
      if (r.length) return r[0].rawValue;
    } catch { /* sigue con jsQR */ }
  }
  const jsQR = await loadJsQR();
  const first = cv instanceof HTMLCanvasElement ? jsqrOnce(jsQR, cv) : null;
  if (first || !thorough) return first;
  const w = cv.width || cv.naturalWidth || cv.videoWidth;
  for (const size of [480, 360, 260, 800, 200]) {
    if (size > w * 1.6) continue;
    for (const blur of [0, size / 260, size / 160]) {
      const r = jsqrOnce(jsQR, scaled(cv, size, blur));
      if (r) return r;
    }
  }
  return null;
}

/**
 * Puntuacion de legibilidad 0-100 con consejos. Hace una lectura REAL del QR dibujado
 * (como haria un movil) a tamaño grande y pequeño.
 */
export async function readability(text, design, logoSrc) {
  const D = mergeDesign(design);
  const tips = [];
  let score = 100;
  const { svg, n } = render(text, { ...D, frame: { style: "none" } }, { logoSrc });
  const bgHex = D.bg.type === "none" ? "#ffffff" : D.bg.c1;
  const fgCols = D.fg.type === "solid" ? [D.fg.c1] : [D.fg.c1, D.fg.c2];
  const minC = Math.min(...fgCols.map((c) => contrast(c, bgHex)), ...(D.bg.type !== "solid" && D.bg.type !== "none" ? fgCols.map((c) => contrast(c, D.bg.c2)) : [21]));
  if (minC < 2.2) { score -= 40; tips.push("Hay muy poco contraste entre el QR y el fondo."); }
  else if (minC < 3.5) { score -= 18; tips.push("Sube el contraste: oscurece el QR o aclara el fondo."); }
  else if (minC < 5) { score -= 6; }
  if (lum(color(fgCols[0])) > lum(color(bgHex))) { score -= 12; tips.push("QR claro sobre fondo oscuro: algunos móviles antiguos no lo leen."); }
  if (logoSrc) {
    const s = Number(D.logo.size) || 0.22;
    if (s > 0.28) { score -= 12; tips.push("El logo es grande: si falla, hazlo un poco más pequeño."); }
    else if (s > 0.24) score -= 4;
  }
  if ((Number(D.margin) || 0) < 2) { score -= 10; tips.push("Deja al menos 2 módulos de margen alrededor."); }
  if (["star", "diamond"].includes(D.dots.shape) || (Number(D.dots.scale) || 1) < 0.75) { score -= 6; tips.push("Los módulos pequeños o con picos se leen peor de lejos."); }
  if (n > 77) { score -= 8; tips.push("Hay mucho texto: el QR sale muy denso. Usa un QR dinámico para acortarlo."); }

  let readBig = false, readSmall = false;
  try {
    const big = await svgToCanvas(svg, 720, "#ffffff");
    readBig = (await decodeCanvas(big)) === text;
    // impreso pequeño: unos 3 px por modulo, como un QR de 2 cm visto con el movil
    const small = await svgToCanvas(svg, Math.max(120, Math.round((n + 6) * 3)), "#ffffff");
    readSmall = (await decodeCanvas(small, false)) === text;
  } catch { /* si el navegador no deja leer, solo cuenta lo demas */ }
  if (!readBig) { score = Math.min(score, 30); tips.unshift("No he podido leerlo: cambia colores, forma o tamaño del logo."); }
  else if (!readSmall) { score -= 12; tips.push("Impreso muy pequeño puede costar leerlo."); }
  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, tips, readBig, readSmall, contrast: minC };
}
