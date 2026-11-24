// Expositor de mesa en 3D: una placa vertical con el QR, un texto («DEJA TU RESEÑA»), estrellas
// y un logo o icono, todo en relieve de colores, y una base con ranura donde se encaja la placa.
// Todas las aristas van redondeadas para que no pinche. Dos piezas que se imprimen tumbadas,
// sin soportes. Unidades: mm. La cara de la placa se dibuja en un canvas y cada color pasa a
// ser una pieza en relieve (3MF multicolor).
import { render, svgToCanvas } from "./qr.js";

export const DEFAULT_STAND = {
  width: 85, height: 135, thick: 3, relief: 0.6, radius: 6,
  msg: "", line1: "DEJA TU", line2: "RESEÑA", bottom: "Escanea el QR",
  icon: "bubble", stars: 5, plateColor: "#111111",
  base: true, baseDepth: 45, baseHeight: 12, tilt: 12,
};
// colores de impresión (filamentos habituales); el fondo de la placa no se imprime en relieve
export const PALETTE = [
  ["Blanco", "#f5f5f5"], ["Amarillo", "#facc15"], ["Rojo", "#dc2626"], ["Azul", "#2563eb"], ["Verde", "#16a34a"],
];
const PX = 0.4; // tamaño del pixel de la cara (mm) = boquilla de 0,4

const mesh = () => ({ pos: [], idx: [] });
const vtx = (m, x, y, z) => { m.pos.push(x, y, z); return m.pos.length / 3 - 1; };
function roundRect(x0, y0, x1, y1, r, seg = 8) {
  const pts = [], c = [[x1 - r, y0 + r, -90], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180]];
  for (const [cx, cy, a0] of c) for (let i = 0; i <= seg; i++) { const a = ((a0 + (90 * i) / seg) * Math.PI) / 180; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return pts;
}
/** Bloque con esquinas redondeadas (en planta) y aristas de arriba y abajo redondeadas. */
function roundedSlab(m, x0, y0, x1, y1, z0, z1, rxy, re, steps = 4) {
  re = Math.min(re, (z1 - z0) / 2, rxy - 0.3);
  const levels = [];
  for (let k = 0; k <= steps; k++) { const a = (k / steps) * Math.PI / 2; levels.push([z0 + re - re * Math.cos(a), re - re * Math.sin(a)]); }
  for (let k = steps; k >= 0; k--) { const a = (k / steps) * Math.PI / 2; levels.push([z1 - re + re * Math.cos(a), re - re * Math.sin(a)]); }
  const rings = levels.map(([z, ins]) => roundRect(x0 + ins, y0 + ins, x1 - ins, y1 - ins, rxy - ins).map(([x, y]) => vtx(m, x, y, z)));
  const n = rings[0].length;
  for (let k = 0; k < rings.length - 1; k++) {
    const A = rings[k], B = rings[k + 1];
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; m.idx.push(A[i], A[j], B[j], A[i], B[j], B[i]); }
  }
  const cap = (R, z, up) => {
    const c = vtx(m, (x0 + x1) / 2, (y0 + y1) / 2, z);
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; if (up) m.idx.push(c, R[i], R[j]); else m.idx.push(c, R[j], R[i]); }
  };
  cap(rings[0], levels[0][0], false); cap(rings[rings.length - 1], levels[levels.length - 1][0], true);
}
function box(m, x0, y0, x1, y1, z0, z1) {
  const v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]].map((p) => vtx(m, ...p));
  const f = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]];
  for (const t of f) m.idx.push(...t.map((i) => v[i]));
}
/** Une pixeles vecinos del mismo color en rectángulos (pocas piezas). */
function rects(mask, w, h) {
  const used = new Uint8Array(w * h), out = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (!mask[i] || used[i]) continue;
    let rw = 1; while (x + rw < w && mask[i + rw] && !used[i + rw]) rw++;
    let rh = 1;
    grow: while (y + rh < h) { for (let k = 0; k < rw; k++) { const j = (y + rh) * w + x + k; if (!mask[j] || used[j]) break grow; } rh++; }
    for (let a = 0; a < rh; a++) for (let k = 0; k < rw; k++) used[(y + a) * w + x + k] = 1;
    out.push([x, y, rw, rh]);
  }
  return out;
}

const ICONS = {
  bubble: (g, cx, cy, s) => { // bocadillo con corazón
    const w = s * 1.25, h = s * 0.78, x = cx - w / 2, y = cy - h / 2 - s * 0.08;
    g.fillStyle = "#f5f5f5";
    g.beginPath(); g.roundRect(x, y, w, h, s * 0.2); g.fill();
    // la colita sale de dentro del recuadro: una sola pieza, sin cortes, y con la punta redondeada
    g.beginPath(); g.moveTo(x + w * 0.18, y + h * 0.6); g.lineTo(x + w * 0.12, y + h + s * 0.24); g.lineTo(x + w * 0.46, y + h * 0.6); g.closePath();
    g.lineJoin = "round"; g.lineWidth = s * 0.06; g.strokeStyle = "#f5f5f5"; g.fill(); g.stroke();
    heart(g, cx, y + h / 2 + s * 0.02, s * 0.4, "#dc2626");
  },
  heart: (g, cx, cy, s) => heart(g, cx, cy, s * 0.8, "#dc2626"),
  thumb: (g, cx, cy, s) => { // pulgar arriba
    g.fillStyle = "#f5f5f5"; g.beginPath(); g.roundRect(cx - s * 0.45, cy - s * 0.05, s * 0.2, s * 0.5, s * 0.05); g.fill();
    g.beginPath(); g.roundRect(cx - s * 0.2, cy - s * 0.08, s * 0.62, s * 0.53, s * 0.12); g.fill();
    g.beginPath(); g.roundRect(cx - s * 0.12, cy - s * 0.5, s * 0.2, s * 0.5, s * 0.1); g.fill();
  },
  none: () => {},
};
function heart(g, cx, cy, s, color) {
  g.fillStyle = color; g.beginPath();
  g.moveTo(cx, cy + s * 0.45);
  g.bezierCurveTo(cx - s * 0.75, cy - s * 0.05, cx - s * 0.4, cy - s * 0.6, cx, cy - s * 0.22);
  g.bezierCurveTo(cx + s * 0.4, cy - s * 0.6, cx + s * 0.75, cy - s * 0.05, cx, cy + s * 0.45);
  g.fill();
}
function star(g, cx, cy, R, color) {
  g.fillStyle = color; g.strokeStyle = color; g.lineJoin = "round"; g.lineWidth = R * 0.22;
  g.beginPath();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? R * 0.42 : R * 0.86, a = -Math.PI / 2 + (i * Math.PI) / 5; g[i ? "lineTo" : "moveTo"](cx + r * Math.cos(a), cy + r * Math.sin(a)); }
  g.closePath(); g.fill(); g.stroke();
}

/** Dibuja la cara de la placa (vista previa y base del relieve). logo: Image opcional. */
export async function drawFace(content, o, logo = null) {
  o = { ...DEFAULT_STAND, ...o };
  const W = Math.round(o.width / PX), H = Math.round(o.height / PX), mm = 1 / PX;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d"), font = "'Arial Black', 'Segoe UI Black', Inter, 'Helvetica Neue', Arial, sans-serif";
  g.fillStyle = o.plateColor; g.beginPath(); g.roundRect(0, 0, W, H, o.radius * mm); g.fill();
  const white = PALETTE[0][1], yellow = PALETTE[1][1];
  g.fillStyle = white; g.textAlign = "center"; g.textBaseline = "middle";
  const m = 5 * mm;
  const fitText = (t, y, size) => { if (!t) return; let s = size; do { g.font = `900 ${s}px ${font}`; s -= 1; } while (g.measureText(t).width > W - 2 * m && s > 8); g.fillText(t, W / 2, y); };
  let y = 7 * mm;
  const ts = 12.5 * mm;
  // mensaje de agradecimiento arriba (más pequeño, en amarillo)
  if (o.msg) { g.fillStyle = yellow; fitText(o.msg, y - 1.5 * mm + 3 * mm, 6 * mm); g.fillStyle = white; y += 6.5 * mm; }
  if (o.line1) { fitText(o.line1.toUpperCase(), y + ts / 2, ts); y += ts * 1.08; }
  if (o.line2) { fitText(o.line2.toUpperCase(), y + ts / 2, ts); y += ts * 1.08; }
  // logo o icono
  const iconH = 22 * mm;
  if (logo) {
    const k = Math.min((W - 2 * m) / logo.naturalWidth, iconH / logo.naturalHeight);
    g.drawImage(logo, (W - logo.naturalWidth * k) / 2, y + 2 * mm + (iconH - logo.naturalHeight * k) / 2, logo.naturalWidth * k, logo.naturalHeight * k);
    y += iconH + 4 * mm;
  } else if (o.icon !== "none") { (ICONS[o.icon] || ICONS.bubble)(g, W / 2, y + 2 * mm + iconH / 2, iconH); y += iconH + 4 * mm; }
  // estrellas
  if (o.stars > 0) {
    const n = o.stars, sw = (W - 2 * m) / n, R = Math.min(sw * 0.5, 7.5 * mm);
    for (let i = 0; i < n; i++) star(g, m + sw * (i + 0.5), y + R, R, yellow);
    y += 2 * R + 4 * mm;
  }
  // QR en una pastilla blanca: los módulos quedan del color de la placa
  const bottomH = o.bottom ? 8 * mm : 0;
  const qs = Math.min(W - 2 * m, H - y - bottomH - 5 * mm);
  if (qs > 15 * mm) {
    const qx = (W - qs) / 2;
    g.fillStyle = white; g.beginPath(); g.roundRect(qx, y, qs, qs, 3 * mm); g.fill();
    const pad = 2.5 * mm;
    const qc = await svgToCanvas(render(content || " ", { dots: { shape: "square" }, eyes: { frame: "rounded", ball: "rounded" }, fg: { type: "solid", c1: "#000000" }, bg: { type: "none" }, margin: 0, ecc: "M", frame: { style: "none" } }).svg, Math.round(qs - 2 * pad));
    const t = document.createElement("canvas"); t.width = qc.width; t.height = qc.height;
    const tg = t.getContext("2d"); tg.drawImage(qc, 0, 0);
    // los módulos negros se pintan con el color de la placa (hueco en la pastilla blanca)
    tg.globalCompositeOperation = "source-in"; tg.fillStyle = o.plateColor; tg.fillRect(0, 0, t.width, t.height);
    g.imageSmoothingEnabled = false; g.drawImage(t, qx + pad, y + pad); g.imageSmoothingEnabled = true;
    y += qs + 2 * mm;
  }
  if (o.bottom) { g.fillStyle = white; fitText(o.bottom, Math.min(H - 5 * mm, y + bottomH / 2), 5.5 * mm); }
  return cv;
}

const hexRGB = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** Crea el modelo a partir de la cara dibujada. */
export function buildStand(face, o) {
  o = { ...DEFAULT_STAND, ...o };
  const W = face.width, H = face.height, data = face.getContext("2d").getImageData(0, 0, W, H).data;
  const cols = [["Placa", o.plateColor], ...PALETTE];
  const rgb = cols.map(([, c]) => hexRGB(c));
  // cada pixel al color más cercano; lo transparente (fuera de las esquinas) no cuenta
  const cls = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (data[i * 4 + 3] < 128) { cls[i] = 255; continue; }
    const r = data[i * 4], g = data[i * 4 + 1], bl = data[i * 4 + 2];
    // grises (texto suavizado): o placa o blanco, nunca un color
    if (Math.max(r, g, bl) - Math.min(r, g, bl) < 40) { const l = (r + g + bl) / 3, pl = (rgb[0][0] + rgb[0][1] + rgb[0][2]) / 3; cls[i] = l > (pl + 245) / 2 ? 1 : 0; continue; }
    // un borde suavizado es una mezcla entre la placa y un color: se mide la distancia a esa mezcla
    // y solo cuenta como color si tiene más de la mitad de él (así no salen motas rojas alrededor del amarillo)
    let best = 0, bd = 1e9, bt = 0;
    const p0 = rgb[0];
    for (let k = 1; k < rgb.length; k++) {
      const dx = rgb[k][0] - p0[0], dy = rgb[k][1] - p0[1], dz = rgb[k][2] - p0[2], L = dx * dx + dy * dy + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((r - p0[0]) * dx + (g - p0[1]) * dy + (bl - p0[2]) * dz) / L));
      const d = (r - p0[0] - t * dx) ** 2 + (g - p0[1] - t * dy) ** 2 + (bl - p0[2] - t * dz) ** 2;
      if (d < bd) { bd = d; best = k; bt = t; }
    }
    cls[i] = bt >= 0.5 ? best : 0;
  }
  // quita puntos sueltos (bordes suavizados) que no se pueden imprimir
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x, c = cls[i]; if (!c || c === 255) continue;
    let same = 0; for (const j of [i - 1, i + 1, i - W, i + W]) if (cls[j] === c) same++;
    if (same === 0) cls[i] = 0;
  }
  // un color con muy pocos pixeles es ruido del suavizado: se queda en el color de la placa
  const count = new Uint32Array(cols.length);
  for (let i = 0; i < W * H; i++) if (cls[i] !== 255) count[cls[i]]++;
  for (let i = 0; i < W * H; i++) if (cls[i] !== 255 && cls[i] && count[cls[i]] < 60) cls[i] = 0;
  const parts = [];
  const plate = mesh();
  roundedSlab(plate, 0, 0, o.width, o.height, 0, o.thick, o.radius, Math.min(1, o.thick / 3));
  parts.push({ name: "Placa", color: o.plateColor, mesh: plate });
  // relieve de colores (encima de la placa, dentro de la zona plana para no pisar el redondeo)
  const edge = 1.2;
  for (let k = 1; k < cols.length; k++) {
    const mask = new Uint8Array(W * H);
    let any = false;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, mx = x * PX, my = y * PX;
      if (cls[i] === k && mx > edge && my > edge && mx < o.width - edge && my < o.height - edge) { mask[i] = 1; any = true; }
    }
    if (!any) continue;
    const mm = mesh();
    for (const [x, y, w, h] of rects(mask, W, H)) box(mm, x * PX, o.height - (y + h) * PX, (x + w) * PX, o.height - y * PX, o.thick - 0.01, o.thick + o.relief);
    parts.push({ name: cols[k][0], color: cols[k][1], mesh: mm });
  }
  let depth = o.height;
  if (o.base) {
    // base con ranura donde la placa encaja de pie: se imprime al lado de la placa
    const b = mesh(), bx = o.width + 8, bw = o.width + 10, bd = o.baseDepth, bh = o.baseHeight;
    const gap = o.thick + 0.35, sy = bd * 0.42, floor = 3;
    roundedSlab(b, bx, 0, bx + bw, bd, 0, floor + 0.5, 5, 1.2);                         // suelo
    roundedSlab(b, bx, 0, bx + bw, sy, 0, bh, 5, 1.2);                                     // delante de la ranura
    roundedSlab(b, bx, sy + gap, bx + bw, bd, 0, bh * 0.8, 5, 1.2);                        // detrás (más bajo: deja inclinar)
    roundedSlab(b, bx, sy - 1, bx + 4, sy + gap + 1, 0, bh * 0.8, 1.6, 1.2);               // cierre izquierdo
    roundedSlab(b, bx + bw - 4, sy - 1, bx + bw, sy + gap + 1, 0, bh * 0.8, 1.6, 1.2);     // cierre derecho
    parts.splice(1, 0, { name: "Base", color: o.plateColor, mesh: b });
    depth = Math.max(depth, bd);
  }
  const tris = parts.reduce((s, p) => s + p.mesh.idx.length / 3, 0);
  return { parts, info: { width: o.base ? o.width * 2 + 18 : o.width, depth, height: o.thick + o.relief, tris, colors: parts.length - (o.base ? 1 : 0) }, opts: o };
}
