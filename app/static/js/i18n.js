// Idioma de la web: español (el original) o inglés.
// La interfaz se escribe en español; en inglés se traduce lo que aparece en pantalla con un
// diccionario (i18n-en.json) que va de la frase en español a la inglesa.
const KEY = "qp-lang";
const saved = (() => { try { return localStorage.getItem(KEY); } catch { return null; } })();
export const LANG = saved === "es" || saved === "en" ? saved : (navigator.language || "es").toLowerCase().startsWith("es") ? "es" : "en";

let DICT = null, FRAGS = [];
if (LANG === "en") {
  try {
    DICT = await (await fetch("/static/js/i18n-en.json?v=4")).json();
    // los trozos largos se traducen también dentro de frases con datos (números, nombres…)
    FRAGS = Object.keys(DICT).filter((k) => k.length >= 12 && k.includes(" ")).sort((a, b) => b.length - a.length);
  } catch { DICT = null; }
}

// frases con números que se montan en el código
const PATTERNS = [
  [/^hace (\d+) min$/, "$1 min ago"], [/^hace (\d+) h$/, "$1 h ago"], [/^hace (\d+) días?$/, "$1 days ago"],
  [/^dentro de (\d+) min$/, "in $1 min"], [/^dentro de (\d+) h$/, "in $1 h"], [/^dentro de (\d+) días$/, "in $1 days"],
  [/^(\d+) lecturas?$/, "$1 scans"], [/^Versión (\d+) · (.*)$/, "Version $1 · $2"], [/^(\d+) QR$/, "$1 QR"], [/^Lote (.+)$/, "Batch $1"],
  [/^Demasiados intentos fallidos\. Espera (\d+) min y vuelve a probar$/, "Too many failed attempts. Wait $1 min and try again"],
];

// un trozo suelto: exacto, o «3 piezas» / «10.440 triángulos» (número + palabra)
function one(x) {
  const k = x.trim();
  if (DICT[k] != null) return x.replace(k, DICT[k]);
  let m = k.match(/^([\d.,×x ]+(?:mm)?\s*)(.+)$/);
  if (m && DICT[m[2]] != null) return x.replace(k, m[1] + DICT[m[2]]);
  m = k.match(/^(.+?)(\s+[\d×x.,][\d×x.,\s]*(?:mm)?)$/);  // «Version 3», «corrección M» no; «QR de 29×29»
  if (m && DICT[m[1]] != null) return x.replace(k, DICT[m[1]] + m[2]);
  m = k.match(/^(.+?) (\S+)$/);
  if (m && DICT[m[1]] != null && /^[A-Z0-9]{1,2}$/.test(m[2])) return x.replace(k, DICT[m[1]] + " " + m[2]);
  return x;
}

/** Traduce una frase (si estamos en inglés y se conoce). */
export function t(s) {
  if (!DICT || s == null) return s;
  const str = String(s), k = str.trim();
  if (!k) return str;
  let out = DICT[k];
  if (out == null) {
    for (const [re, rep] of PATTERNS) if (re.test(k)) { out = t(k.replace(re, rep)); break; }
  }
  if (out == null) {
    // «Tipo: contenido» (el resumen del QR)
    const m = k.match(/^([^:\n]{2,30}): ([\s\S]*)$/);
    if (m && DICT[m[1]]) out = DICT[m[1]] + ": " + m[2];
  }
  if (out == null) {
    let x = k, hit = false;
    for (const f of FRAGS) if (x.includes(f)) { x = x.split(f).join(DICT[f]); hit = true; }
    if (x.includes("·")) {
      // «Pequeño · 70 × 110 mm», «· 3 piezas · 10.440 triángulos»…: cada trozo por separado
      const parts = x.split(/(\s*·\s*)/), tr = parts.map((y) => (/·/.test(y) ? y : one(y)));
      if (tr.some((y, i) => y !== parts[i])) { x = tr.join(""); hit = true; }
    }
    if (!hit) return str;
    out = x;
  }
  // conserva los espacios de alrededor
  const a = str.match(/^\s*/)[0], b = str.match(/\s*$/)[0];
  return a + out + b;
}

const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE", "svg", "SVG"]);
const ATTRS = ["placeholder", "title", "aria-label", "alt"];

function walk(root) {
  if (root.nodeType === 3) { const v = t(root.nodeValue); if (v !== root.nodeValue) root.nodeValue = v; return; }
  if (root.nodeType !== 1 && root.nodeType !== 11) return;
  if (root.nodeType === 1) {
    if (root.closest?.("[data-noi18n]")) return;
    for (const a of ATTRS) if (root.hasAttribute(a)) { const v = root.getAttribute(a), n = t(v); if (n !== v) root.setAttribute(a, n); }
    if (SKIP.has(root.tagName) || root.closest?.("svg")) return;
  }
  for (let c = root.firstChild; c; c = c.nextSibling) walk(c);
}

/** Pone la web en el idioma elegido y la vuelve a cargar. */
export function setLang(l) {
  try { localStorage.setItem(KEY, l); } catch { /* nada */ }
  try { window.QRPanelAndroid?.setLang?.(l); } catch { /* fuera de la app */ }
  document.cookie = `qp_lang=${l}; path=/; max-age=31536000; samesite=lax`;
  location.reload();
}

document.documentElement.lang = LANG;
document.cookie = `qp_lang=${LANG}; path=/; max-age=31536000; samesite=lax`;
if (DICT) {
  const start = () => {
    walk(document.body);
    new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === "attributes") { walk(m.target); continue; }
        for (const n of m.addedNodes) walk(n);
      }
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ATTRS });
  };
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
}
