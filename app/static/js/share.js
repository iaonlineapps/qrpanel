// Pagina publica de un QR compartido: se ve y se descarga sin cuenta.
import { render, svgToCanvas } from "./qr.js";
import { parse, TYPES } from "./content.js";
import { makePdf } from "./pdf.js";
import { icon, esc, download, slug, toast, confetti, $ } from "./ui.js";

const dark = matchMedia("(prefers-color-scheme: dark)").matches;
document.documentElement.dataset.theme = dark ? "dark" : "light";
const token = location.pathname.split("/").pop();
const box = $("#sp");

async function main() {
  const r = await fetch(`/api/share/${encodeURIComponent(token)}`);
  if (!r.ok) {
    box.innerHTML = `<div class="card pad share-card empty"><img src="/static/icons/icon.svg" width="56" height="56" alt=""><h2 style="margin:0">Este enlace ya no existe</h2><p class="muted" style="margin:0">Puede que su dueño haya dejado de compartirlo.</p></div>`;
    return;
  }
  const q = await r.json();
  const bn = q.brand?.name || "QRPanel";
  document.title = `${q.name} · ${bn}`;
  if (q.brand?.logo) document.querySelector('link[rel="icon"]').href = q.brand.logo;
  const svg = render(q.content || " ", q.design).svg;
  const p = parse(q.content);
  const isUrl = /^https?:\/\//i.test(q.content);
  box.innerHTML = `<div class="card share-card">
    <div class="stage"><div class="qrbox pop">${svg}</div></div>
    <div class="pad steps" style="gap:12px">
      <div><h1 style="margin:0;font-size:24px;letter-spacing:-.02em">${esc(q.name)}</h1>
        <div class="small muted">${icon(TYPES[q.kind]?.icon || "qr", "sm")} ${esc(TYPES[q.kind]?.name || "QR")} · compartido por <b>${esc(q.owner)}</b></div></div>
      ${isUrl ? `<a class="btn ghost" href="${esc(q.content)}" target="_blank" rel="noopener noreferrer" style="justify-content:flex-start">${icon("link")}<span style="overflow:hidden;text-overflow:ellipsis">${esc(q.content)}</span></a>` : p.kind === "wifi" ? `<div class="small">Red WiFi: <b>${esc(p.fields.ssid)}</b></div>` : ""}
      <div class="row"><select id="fmt" class="input" style="width:auto"><option value="png">PNG</option><option value="svg">SVG</option><option value="jpg">JPG</option><option value="pdf">PDF</option></select>
        <button class="btn primary grow" id="dl">${icon("download")}Descargar</button></div>
      ${bn !== "QRPanel" || q.brand?.logo ? `<div class="row" style="justify-content:center;gap:8px">${q.brand?.logo ? `<img src="${esc(q.brand.logo)}" alt="" width="28" height="28" style="border-radius:8px;object-fit:contain">` : ""}<b>${esc(bn)}</b></div>` : ""}
      <div class="small faint" style="text-align:center">Hecho con <a href="https://github.com/pctecnikk/qrpanel" target="_blank" rel="noopener">QRPanel</a> · tu propio generador de QR</div>
    </div></div>`;
  $("#dl").onclick = async (e) => {
    const rc = e.currentTarget.getBoundingClientRect();
    const fmt = $("#fmt").value, name = slug(q.name);
    try {
      let blob;
      if (fmt === "svg") blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${svg}`], { type: "image/svg+xml" });
      else {
        const cv = await svgToCanvas(svg, fmt === "pdf" ? 2048 : 1024, fmt === "png" ? null : "#ffffff");
        blob = await new Promise((res) => cv.toBlob(res, fmt === "png" ? "image/png" : "image/jpeg", 0.95));
        if (fmt === "pdf") blob = await makePdf(blob, cv.width, cv.height, q.name);
      }
      download(blob, `${name}.${fmt}`);
      confetti(rc.left + rc.width / 2, rc.top, 40);
    } catch { toast("No se pudo descargar", "bad"); }
  };
}
main().catch(() => { box.innerHTML = `<div class="card pad share-card">No se pudo cargar el QR.</div>`; });
