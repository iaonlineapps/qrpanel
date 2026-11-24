// Plantillas de diseño incluidas y el generador "Sorpréndeme".
const P = (name, d) => ({ name, design: d });
const sol = (c) => ({ type: "solid", c1: c });
const lin = (c1, c2, angle = 45) => ({ type: "linear", c1, c2, angle });
const rad = (c1, c2) => ({ type: "radial", c1, c2 });
const white = { type: "solid", c1: "#ffffff", radius: 0.06 };

export const PRESETS = [
  P("Clásico", { dots: { shape: "square" }, eyes: { frame: "square", ball: "square", custom: false }, fg: sol("#000000"), bg: { ...white, radius: 0 } }),
  P("Suave", { dots: { shape: "rounded" }, eyes: { frame: "rounded", ball: "rounded", custom: false }, fg: sol("#0f172a"), bg: white }),
  P("Violeta", { dots: { shape: "liquid" }, eyes: { frame: "rounded", ball: "circle", custom: false }, fg: lin("#4c1d95", "#2563eb", 45), bg: white }),
  P("Atardecer", { dots: { shape: "dots", scale: 0.95 }, eyes: { frame: "circle", ball: "circle", custom: false }, fg: lin("#be123c", "#c2410c", 90), bg: { type: "solid", c1: "#fff7ed", radius: 0.1 } }),
  P("Océano", { dots: { shape: "rounded" }, eyes: { frame: "leaf", ball: "leaf", custom: true, frameColor: "#0c4a6e", ballColor: "#0891b2" }, fg: rad("#0e7490", "#0c4a6e"), bg: { type: "solid", c1: "#ecfeff", radius: 0.08 } }),
  P("Bosque", { dots: { shape: "classy" }, eyes: { frame: "leaf", ball: "leaf", custom: false }, fg: lin("#14532d", "#166534", 135), bg: { type: "solid", c1: "#f0fdf4", radius: 0.06 } }),
  P("Lava", { dots: { shape: "liquid" }, eyes: { frame: "bevel", ball: "diamond", custom: true, frameColor: "#7f1d1d", ballColor: "#dc2626" }, fg: lin("#7f1d1d", "#b91c1c", 0), bg: { type: "solid", c1: "#fef2f2", radius: 0.06 } }),
  P("Galaxia", { dots: { shape: "dots", scale: 0.9 }, eyes: { frame: "rounded", ball: "star", custom: true, frameColor: "#312e81", ballColor: "#7c3aed" }, fg: rad("#6d28d9", "#1e1b4b"), bg: { type: "linear", c1: "#f5f3ff", c2: "#e0e7ff", angle: 135, radius: 0.1 } }),
  P("Oro", { dots: { shape: "diamond", scale: 0.95 }, eyes: { frame: "bevel", ball: "diamond", custom: false }, fg: lin("#713f12", "#a16207", 45), bg: { type: "solid", c1: "#fffbeb", radius: 0.04 } }),
  P("Caramelo", { dots: { shape: "bars-v" }, eyes: { frame: "circle", ball: "rounded", custom: true, frameColor: "#9d174d", ballColor: "#db2777" }, fg: lin("#9d174d", "#6d28d9", 45), bg: { type: "solid", c1: "#fdf2f8", radius: 0.12 } }),
  P("Píxel", { dots: { shape: "tiny" }, eyes: { frame: "dots", ball: "dots", custom: false }, fg: sol("#1e293b"), bg: { type: "solid", c1: "#f8fafc", radius: 0.03 } }),
  P("Tinta", { dots: { shape: "bars-h" }, eyes: { frame: "square", ball: "rounded", custom: false }, fg: lin("#111827", "#374151", 90), bg: { type: "solid", c1: "#fafaf9", radius: 0.02 } }),
];

const DOTS = ["rounded", "liquid", "dots", "classy", "square", "bars-v", "tiny", "diamond"];
const FR = ["rounded", "circle", "leaf", "square", "bevel"];
const BA = ["rounded", "circle", "leaf", "square", "diamond", "star"];
const pick = (a) => a[(Math.random() * a.length) | 0];

function hsl(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))).toString(16).padStart(2, "0");
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Diseño aleatorio pero siempre legible: colores oscuros sobre fondo muy claro. */
export function surprise() {
  const h = Math.random() * 360, h2 = (h + 30 + Math.random() * 60) % 360;
  const dark1 = hsl(h, 55 + Math.random() * 30, 18 + Math.random() * 12);
  const dark2 = hsl(h2, 60 + Math.random() * 30, 24 + Math.random() * 12);
  const kind = pick(["solid", "linear", "linear", "radial"]);
  const custom = Math.random() < 0.4;
  return {
    dots: { shape: pick(DOTS), scale: 1 },
    eyes: { frame: pick(FR), ball: pick(BA), custom, frameColor: dark1, ballColor: hsl(h2, 75, 38) },
    fg: { type: kind, c1: dark1, c2: dark2, angle: pick([0, 45, 90, 135]) },
    bg: { type: "solid", c1: Math.random() < 0.6 ? "#ffffff" : hsl(h, 60, 97), c2: hsl(h2, 60, 93), angle: 135, radius: pick([0, 0.04, 0.08, 0.12]) },
  };
}
