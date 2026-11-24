// Modelo 3D de un QR para imprimir: placa (base) + módulos en relieve, con borde,
// esquinas redondeadas y agujero de llavero opcionales. Exporta STL y 3MF (dos colores).
// Unidades en milímetros, eje Z hacia arriba.
import { matrix } from "./qr.js";
import { makeZip } from "./zip.js";

export const DEFAULT_3D = {
  size: 50,        // lado de la placa (mm)
  base: 2,         // grosor de la base (mm)
  height: 1,       // altura de los módulos sobre la base (mm)
  margin: 2,       // borde blanco alrededor, en módulos
  radius: 3,       // esquinas redondeadas (mm)
  keychain: false, // anilla con agujero para llavero
  hole: 5,         // diámetro del agujero (mm)
  baseColor: "#ffffff",
  modColor: "#111111",
  format: "3mf",
};

const mesh = () => ({ pos: [], idx: [] });
function vtx(m, x, y, z) { m.pos.push(x, y, z); return m.pos.length / 3 - 1; }

/** Prisma vertical de un polígono en sentido antihorario (visto desde arriba). */
function prism(m, poly, z0, z1) {
  const n = poly.length, b = poly.map(([x, y]) => vtx(m, x, y, z0)), t = poly.map(([x, y]) => vtx(m, x, y, z1));
  if (n === 4) {
    m.idx.push(t[0], t[1], t[2], t[0], t[2], t[3], b[0], b[2], b[1], b[0], b[3], b[2]);
  } else { // convexo: abanico desde el centro
    const cx = poly.reduce((s, p) => s + p[0], 0) / n, cy = poly.reduce((s, p) => s + p[1], 0) / n;
    const ct = vtx(m, cx, cy, z1), cb = vtx(m, cx, cy, z0);
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; m.idx.push(ct, t[i], t[j], cb, b[j], b[i]); }
  }
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; m.idx.push(b[i], b[j], t[j], b[i], t[j], t[i]); }
}
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
function roundRect(x0, y0, x1, y1, r, seg = 10) {
  if (r <= 0.01) return rect(x0, y0, x1, y1);
  const pts = [], c = [[x1 - r, y0 + r, -90], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180]];
  for (const [cx, cy, a0] of c) for (let i = 0; i <= seg; i++) { const a = ((a0 + (90 * i) / seg) * Math.PI) / 180; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return pts;
}
/** Anilla (corona circular) para el llavero. */
function ring(m, cx, cy, rin, rout, z0, z1, seg = 40) {
  const O = [], I = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    O.push([vtx(m, cx + rout * c, cy + rout * s, z0), vtx(m, cx + rout * c, cy + rout * s, z1)]);
    I.push([vtx(m, cx + rin * c, cy + rin * s, z0), vtx(m, cx + rin * c, cy + rin * s, z1)]);
  }
  for (let i = 0; i < seg; i++) {
    const j = (i + 1) % seg;
    m.idx.push(I[i][1], O[i][1], O[j][1], I[i][1], O[j][1], I[j][1]);      // arriba
    m.idx.push(I[i][0], O[j][0], O[i][0], I[i][0], I[j][0], O[j][0]);      // abajo
    m.idx.push(O[i][0], O[j][0], O[j][1], O[i][0], O[j][1], O[i][1]);      // por fuera
    m.idx.push(I[i][0], I[j][1], I[j][0], I[i][0], I[i][1], I[j][1]);      // por dentro
  }
}
/** Junta módulos vecinos en rectángulos para que el modelo tenga pocas piezas. */
function rects(grid) {
  const n = grid.length, used = grid.map((r) => r.map(() => false)), out = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!grid[r][c] || used[r][c]) continue;
    let w = 1; while (c + w < n && grid[r][c + w] && !used[r][c + w]) w++;
    let h = 1;
    grow: while (r + h < n) { for (let k = 0; k < w; k++) if (!grid[r + h][c + k] || used[r + h][c + k]) break grow; h++; }
    for (let i = 0; i < h; i++) for (let k = 0; k < w; k++) used[r + i][c + k] = true;
    out.push([r, c, w, h]);
  }
  return out;
}

/** Crea el modelo. Devuelve las dos piezas (base y módulos) y datos para mostrar. */
export function build(text, ecc, o) {
  o = { ...DEFAULT_3D, ...o };
  const { n, grid } = matrix(text, ecc || "M");
  const U = n + 2 * o.margin, u = o.size / U, S = o.size;
  const base = mesh(), mods = mesh();
  const r = Math.max(0, Math.min(o.radius, S / 4));
  const zTop = o.base, zMod = o.base + o.height;
  prism(base, roundRect(0, 0, S, S, r), 0, zTop);
  const rin = o.hole / 2, rout = rin + Math.max(2.2, o.hole * 0.45);
  if (o.keychain) ring(base, S / 2, S + rin + 1.2, rin, rout, 0, zTop);
  for (const [rr, c, w, h] of rects(grid)) {
    const x0 = (o.margin + c) * u, y1 = S - (o.margin + rr) * u;
    prism(mods, rect(x0, y1 - h * u, x0 + w * u, y1), zTop, zMod);
  }
  const tris = (base.idx.length + mods.idx.length) / 3;
  return {
    parts: [{ name: "Base", color: o.baseColor, mesh: base }, { name: "Modulos", color: o.modColor, mesh: mods }],
    info: { n, module: u, width: S, depth: o.keychain ? S + 1.2 + rin + rout : S, height: zMod, tris, colorChange: zTop },
    opts: o,
  };
}

// --- exportar -------------------------------------------------------------------
export function toSTL(model) {
  const tris = model.parts.reduce((s, p) => s + p.mesh.idx.length / 3, 0);
  const buf = new ArrayBuffer(84 + tris * 50), dv = new DataView(buf);
  const head = "QRPanel - codigo QR en 3D";
  for (let i = 0; i < head.length; i++) dv.setUint8(i, head.charCodeAt(i));
  dv.setUint32(80, tris, true);
  let o = 84;
  for (const { mesh: m } of model.parts) {
    const P = m.pos;
    for (let i = 0; i < m.idx.length; i += 3) {
      const a = m.idx[i] * 3, b = m.idx[i + 1] * 3, c = m.idx[i + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
      const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      for (const v of [nx, ny, nz]) { dv.setFloat32(o, v, true); o += 4; }
      for (const k of [a, b, c]) for (let j = 0; j < 3; j++) { dv.setFloat32(o, P[k + j], true); o += 4; }
      o += 2;
    }
  }
  return new Blob([buf], { type: "model/stl" });
}

const hex = (c) => (/^#[0-9a-f]{6}$/i.test(c) ? c.toUpperCase() + "FF" : "#000000FF");
export async function to3MF(model, title = "QR") {
  const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]);
  let objs = "";
  model.parts.forEach((p, i) => {
    const P = p.mesh.pos, I = p.mesh.idx;
    let v = "", t = "";
    for (let k = 0; k < P.length; k += 3) v += `<vertex x="${+P[k].toFixed(4)}" y="${+P[k + 1].toFixed(4)}" z="${+P[k + 2].toFixed(4)}"/>`;
    for (let k = 0; k < I.length; k += 3) t += `<triangle v1="${I[k]}" v2="${I[k + 1]}" v3="${I[k + 2]}"/>`;
    objs += `<object id="${i + 2}" name="${esc(p.name)}" type="model" pid="1" pindex="${i}"><mesh><vertices>${v}</vertices><triangles>${t}</triangles></mesh></object>`;
  });
  const comps = model.parts.map((_, i) => `<component objectid="${i + 2}"/>`).join("");
  const id = model.parts.length + 2;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="es-ES" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
<metadata name="Title">${esc(title)}</metadata><metadata name="Application">QRPanel</metadata>
<resources><basematerials id="1">${model.parts.map((p) => `<base name="${esc(p.name)}" displaycolor="${hex(p.color)}"/>`).join("")}</basematerials>
${objs}<object id="${id}" name="${esc(title)}" type="model"><components>${comps}</components></object></resources>
<build><item objectid="${id}"/></build></model>`;
  return makeZip([
    { name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>` },
    { name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>` },
    { name: "3D/3dmodel.model", data: xml },
  ]).then((z) => new Blob([z], { type: "model/3mf" }));
}
/** Dos STL (base y módulos) en un ZIP, para impresoras multicolor que los cargan como piezas. */
export async function toSTLParts(model, base) {
  const files = model.parts.map((p) => ({ name: `${base}-${p.name.toLowerCase()}.stl`, data: toSTL({ parts: [p] }) }));
  return new Blob([await makeZip(files)], { type: "application/zip" });
}
