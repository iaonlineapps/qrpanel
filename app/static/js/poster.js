import { t } from "./i18n.js";
// Cartel de mascota perdida: A4 para imprimir (con tiras recortables) y versiones para redes
// (post cuadrado e historia vertical). Todo se dibuja en un canvas.

const FONT = "Inter, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
export const HEADINGS = ["SE BUSCA", "PERDIDO", "PERDIDA", "¿ME HAS VISTO?", "AYÚDAME A VOLVER A CASA"];
export const SIZES = {
  a4: { w: 1654, h: 2339, name: "A4 para imprimir" },
  post: { w: 1080, h: 1080, name: "Post cuadrado" },
  story: { w: 1080, h: 1920, name: "Historia / estado" },
};
const SPECIES = { perro: "Perro", gato: "Gato", conejo: "Conejo", pajaro: "Pájaro", hamster: "Hámster", tortuga: "Tortuga", caballo: "Caballo", huron: "Hurón" };

const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

function wrap(g, text, maxw, maxLines = 3) {
  const words = String(text || "").split(/\s+/).filter(Boolean), lines = [];
  let cur = "";
  for (const w of words) { const t = cur ? cur + " " + w : w; if (g.measureText(t).width > maxw && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] += "…"; }
  return lines;
}
/** Texto de una línea que se encoge hasta caber. */
function fit(g, text, maxw, size, weight = 900, min = 20) {
  let s = size;
  do { g.font = `${weight} ${s}px ${FONT}`; if (g.measureText(text).width <= maxw) break; s -= 2; } while (s > min);
  return s;
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
// la foto entera (sin cortar la cabeza), y detrás la misma foto difuminada para llenar el hueco
function cover(g, img, x, y, w, h, r) {
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const k = Math.max(w / iw, h / ih), sw = w / k, sh = h / k;
  g.save(); rr(g, x, y, w, h, r); g.clip();
  g.filter = "blur(24px) brightness(0.85)";
  g.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x - 30, y - 30, w + 60, h + 60);
  g.filter = "none";
  const c = Math.min(w / iw, h / ih), dw = iw * c, dh = ih * c;
  g.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); g.restore();
}
function paw(g, cx, cy, s, color) {
  g.fillStyle = color;
  const el = (x, y, rx, ry) => { g.beginPath(); g.ellipse(cx + x * s, cy + y * s, rx * s, ry * s, 0, 0, Math.PI * 2); g.fill(); };
  el(0, 0.28, 0.42, 0.36); el(-0.46, -0.12, 0.16, 0.2); el(0.46, -0.12, 0.16, 0.2); el(-0.18, -0.42, 0.17, 0.21); el(0.18, -0.42, 0.17, 0.21);
}

/**
 * Dibuja el cartel. f: campos de la ficha; qr: canvas con el QR; o: {size, heading, note, strips, color}
 * Devuelve el canvas.
 */
export async function drawPoster(f, qr, o = {}) {
  const S = SIZES[o.size] || SIZES.a4, W = S.w, H = S.h;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  const red = o.color || "#dc2626", ink = "#111827", soft = "#4b5563";
  const photo = f.photo ? await loadImg(f.photo).catch(() => null) : null;
  const name = (f.name || t("Mi mascota")).trim();
  const heading = t(o.heading || HEADINGS[0]).toUpperCase();
  const desc = [t(SPECIES[f.species]) || (f.species && f.species !== "otro" ? f.species : ""), f.breed, f.sex ? f.sex[0].toUpperCase() + f.sex.slice(1) : "", f.age].filter(Boolean).join(" · ");
  // por privacidad el teléfono solo sale si el dueño lo pide: si no, se ve al escanear el QR
  const phone = o.showPhone ? (f.phone || "").trim() : "";
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, W, H);

  if (o.size === "post") {
    // ---- cuadrado: cabecera, foto a la izquierda, datos y QR a la derecha
    const m = 44;
    g.fillStyle = red; g.fillRect(0, 0, W, 170);
    g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
    fit(g, heading, W - 2 * m, 110); g.fillText(heading, W / 2, 92);
    const pw = 500, py = 210;
    if (photo) cover(g, photo, m, py, pw, 620, 28); else { g.fillStyle = "#fef3c7"; rr(g, m, py, pw, 620, 28); g.fill(); paw(g, m + pw / 2, py + 310, 180, "#f59e0b"); }
    const tx = m + pw + 40, tw = W - tx - m;
    g.textAlign = "left"; g.textBaseline = "alphabetic"; g.fillStyle = ink;
    const ns = fit(g, name.toUpperCase(), tw, 96); g.fillText(name.toUpperCase(), tx, py + ns * 0.85);
    let y = py + ns + 26;
    g.fillStyle = soft; g.font = `600 30px ${FONT}`;
    for (const l of wrap(g, desc, tw, 2)) { g.fillText(l, tx, y); y += 40; }
    if (f.color) { g.font = `500 28px ${FONT}`; for (const l of wrap(g, f.color, tw, 2)) { g.fillText(l, tx, y); y += 36; } }
    if (o.note) { g.fillStyle = red; g.font = `700 28px ${FONT}`; for (const l of wrap(g, o.note, tw, 3)) { g.fillText(l, tx, y + 6); y += 36; } }
    const qs = 300, qy = py + 620 - qs;
    g.drawImage(qr, tx + (tw - qs) / 2, qy, qs, qs * qr.height / qr.width > qs ? qs : qs * qr.height / qr.width);
    // pie: teléfono y recompensa
    g.fillStyle = ink; g.fillRect(0, H - 210, W, 210);
    g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
    const call = phone ? `${t("LLAMA AL")} ${phone}` : t("ESCANEA EL QR PARA AVISAR");
    fit(g, call, W - 2 * m, 70); g.fillText(call, W / 2, H - 140);
    g.font = `600 32px ${FONT}`; g.fillStyle = "#fde68a";
    g.fillText(f.reward ? `${t("🎁 Recompensa:")} ${f.reward}` : t("Con la cámara del móvil: verás su ficha y cómo avisar"), W / 2, H - 62);
    return cv;
  }

  // ---- vertical (A4 e historia)
  const a4 = o.size !== "story", m = a4 ? 90 : 64;
  const stripH = a4 && o.strips ? 360 : 0;
  const top = a4 ? 300 : 300;
  g.fillStyle = red; g.fillRect(0, 0, W, top);
  g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
  fit(g, heading, W - 2 * m, a4 ? 210 : 150); g.fillText(heading, W / 2, top / 2 + 8);
  // bloque inferior (QR + teléfono) fijo abajo; la foto ocupa lo que sobre
  const boxH = a4 ? 520 : 470, by = H - stripH - boxH - (a4 ? 50 : 70);
  const tw0 = W - 2 * m, gap = a4 ? 40 : 34;
  const ns = fit(g, name.toUpperCase(), tw0, a4 ? 170 : 130);
  const dS = a4 ? 48 : 40, cS = a4 ? 42 : 36, nS = a4 ? 44 : 38, rS = a4 ? 46 : 40;
  g.font = `500 ${cS}px ${FONT}`; const cl = f.color ? wrap(g, f.color, tw0, 2) : [];
  g.font = `800 ${nS}px ${FONT}`; const nl = o.note ? wrap(g, o.note, tw0, 2) : [];
  const textH = ns * 1.05 + (desc ? dS * 1.3 : 0) + cl.length * cS * 1.3 + nl.length * nS * 1.3 + (f.reward ? rS * 2.2 : 0);
  let y = top + gap;
  const ph = Math.max(200, by - gap - textH - gap - y), pw = Math.min(W - 2 * m, ph * 1.3), px = (W - pw) / 2;
  if (photo) cover(g, photo, px, y, pw, ph, 40); else { g.fillStyle = "#fef3c7"; rr(g, px, y, pw, ph, 40); g.fill(); paw(g, W / 2, y + ph / 2, Math.min(ph, pw) * 0.3, "#f59e0b"); }
  y += ph + gap;
  g.fillStyle = ink; g.textBaseline = "alphabetic"; g.textAlign = "center";
  fit(g, name.toUpperCase(), tw0, a4 ? 170 : 130); g.fillText(name.toUpperCase(), W / 2, y + ns * 0.78); y += ns * 1.05;
  if (desc) { g.fillStyle = soft; g.font = `600 ${dS}px ${FONT}`; g.fillText(desc, W / 2, y + dS * 0.9); y += dS * 1.3; }
  g.fillStyle = soft; g.font = `500 ${cS}px ${FONT}`; for (const l of cl) { g.fillText(l, W / 2, y + cS * 0.9); y += cS * 1.3; }
  g.fillStyle = red; g.font = `800 ${nS}px ${FONT}`; for (const l of nl) { g.fillText(l, W / 2, y + nS * 0.9); y += nS * 1.3; }
  if (f.reward) {
    g.font = `800 ${rS}px ${FONT}`;
    const rt = t("RECOMPENSA:") + " " + f.reward.toUpperCase(), tw = Math.min(tw0, g.measureText(rt).width + 80), bh = rS * 1.8;
    const yy = y + rS * 0.3;
    g.fillStyle = "#fef3c7"; rr(g, (W - tw) / 2, yy, tw, bh, bh / 2); g.fill();
    g.fillStyle = "#92400e"; g.textBaseline = "middle"; fit(g, rt, tw - 60, rS, 800); g.fillText(rt, W / 2, yy + bh / 2); g.textBaseline = "alphabetic";
  }
  g.fillStyle = "#f3f4f6"; rr(g, m, by, W - 2 * m, boxH, 36); g.fill();
  const qs = boxH - 80, qx = m + 40, qyy = by + 40;
  const qh = qs, qw = qs * qr.width / qr.height;
  g.fillStyle = "#fff"; rr(g, qx - 10, qyy - 10, qw + 20, qh + 20, 20); g.fill();
  g.drawImage(qr, qx, qyy, qw, qh);
  const tx = qx + qw + 50, tw = W - m - 40 - tx;
  g.textAlign = "left"; g.fillStyle = ink;
  let ty = by + (a4 ? 120 : 110);
  g.font = `800 ${a4 ? 46 : 40}px ${FONT}`;
  for (const l of wrap(g, t(phone ? "Si lo ves, escanea el QR o llama:" : "Si lo ves, escanea el QR:"), tw, 2)) { g.fillText(l, tx, ty); ty += a4 ? 58 : 50; }
  const big = phone || t("ESCANÉAME");
  g.fillStyle = red; const bs = fit(g, big, tw, a4 ? 96 : 80, 900); ty += bs * 0.4; g.fillText(big, tx, ty); ty += bs * 0.75;
  g.fillStyle = soft; g.font = `600 ${a4 ? 36 : 32}px ${FONT}`;
  if (f.owner && phone) { g.fillText(t("Pregunta por") + " " + f.owner, tx, ty); ty += a4 ? 46 : 40; }
  for (const l of wrap(g, t(phone ? "Al escanear verás su ficha y podrás mandarme dónde está." : "Con la cámara del móvil. Verás su ficha y podrás llamar a su familia o mandarle dónde está."), tw, 3)) { g.fillText(l, tx, ty); ty += a4 ? 44 : 38; }
  if (stripH) {
    // tiras recortables con el nombre y el teléfono
    const n = 8, sw = W / n, sy = H - stripH;
    g.strokeStyle = "#9ca3af"; g.lineWidth = 3; g.setLineDash([16, 12]);
    g.beginPath(); g.moveTo(0, sy); g.lineTo(W, sy); g.stroke();
    for (let i = 1; i < n; i++) { g.beginPath(); g.moveTo(i * sw, sy); g.lineTo(i * sw, H); g.stroke(); }
    g.setLineDash([]);
    for (let i = 0; i < n; i++) {
      if (phone) {
        g.save(); g.translate(i * sw + sw / 2, sy + stripH / 2); g.rotate(-Math.PI / 2);
        g.textAlign = "center"; g.fillStyle = ink; g.font = `800 34px ${FONT}`;
        g.fillText(name.slice(0, 16), 0, -14);
        g.fillStyle = red; fit(g, phone, stripH - 40, 38, 800); g.fillText(phone, 0, 30);
        g.restore();
      } else {
        // sin teléfono: cada tira lleva un QR pequeño de la ficha
        const qs2 = Math.min(sw - 30, stripH - 110), qx2 = i * sw + (sw - qs2) / 2, qy2 = sy + 24;
        g.drawImage(qr, qx2, qy2, qs2, qs2);
        g.textAlign = "center"; g.fillStyle = ink; g.textBaseline = "alphabetic";
        fit(g, name.slice(0, 14), sw - 20, 30, 800); g.fillText(name.slice(0, 14), i * sw + sw / 2, qy2 + qs2 + 38);
        g.fillStyle = red; fit(g, t("ESCANÉAME"), sw - 20, 24, 800); g.fillText(t("ESCANÉAME"), i * sw + sw / 2, qy2 + qs2 + 70);
      }
    }
  }
  return cv;
}
