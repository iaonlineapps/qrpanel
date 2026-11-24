// Iconos de animales para el centro del QR (sobre todo para las placas de mascota).
// Cada uno es una silueta blanca sobre un círculo de color; los detalles (ojos, nariz)
// se pintan con el color del círculo para que se vean.

const ART = {
  perro: (c) => `
    <ellipse cx="13.2" cy="21" rx="4.6" ry="8.6" transform="rotate(22 13.2 21)" fill="#fff" opacity=".82"/>
    <ellipse cx="34.8" cy="21" rx="4.6" ry="8.6" transform="rotate(-22 34.8 21)" fill="#fff" opacity=".82"/>
    <ellipse cx="24" cy="25.5" rx="10.6" ry="11.2" fill="#fff"/>
    <circle cx="19.8" cy="23" r="1.7" fill="${c}"/><circle cx="28.2" cy="23" r="1.7" fill="${c}"/>
    <ellipse cx="24" cy="28.4" rx="2.7" ry="1.9" fill="${c}"/>
    <path d="M24 30.2v2.2M21.2 32.6q2.8 1.9 5.6 0" stroke="${c}" stroke-width="1.3" fill="none" stroke-linecap="round"/>`,
  gato: (c) => `
    <path d="M12.6 25 13.4 8.8 22 16.4ZM35.4 25 34.6 8.8 26 16.4Z" fill="#fff" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>
    <ellipse cx="24" cy="26.5" rx="12.2" ry="10.4" fill="#fff"/>
    <ellipse cx="19.4" cy="25" rx="1.5" ry="2.3" fill="${c}"/><ellipse cx="28.6" cy="25" rx="1.5" ry="2.3" fill="${c}"/>
    <path d="M22.4 29.2h3.2L24 31Z" fill="${c}" stroke="${c}" stroke-width=".8" stroke-linejoin="round"/>
    <path d="M24 31v1.2M21.6 33q1.2 1 2.4-.8 1.2 1.8 2.4.8M13.5 28.6l5 .9M13.8 31.8l4.8-.7M34.5 28.6l-5 .9M34.2 31.8l-4.8-.7" stroke="${c}" stroke-width="1.1" fill="none" stroke-linecap="round"/>`,
  conejo: (c) => `
    <ellipse cx="19.2" cy="14.5" rx="3.8" ry="9.6" transform="rotate(-9 19.2 14.5)" fill="#fff"/>
    <ellipse cx="28.8" cy="14.5" rx="3.8" ry="9.6" transform="rotate(9 28.8 14.5)" fill="#fff"/>
    <ellipse cx="19.2" cy="15" rx="1.6" ry="6.6" transform="rotate(-9 19.2 15)" fill="${c}" opacity=".35"/>
    <ellipse cx="28.8" cy="15" rx="1.6" ry="6.6" transform="rotate(9 28.8 15)" fill="${c}" opacity=".35"/>
    <ellipse cx="24" cy="30" rx="10.4" ry="9.4" fill="#fff"/>
    <circle cx="20.2" cy="28.6" r="1.5" fill="${c}"/><circle cx="27.8" cy="28.6" r="1.5" fill="${c}"/>
    <path d="M22.6 31.6h2.8L24 33Z" fill="${c}" stroke="${c}" stroke-width=".8" stroke-linejoin="round"/>
    <path d="M24 33v1.4" stroke="${c}" stroke-width="1.1" stroke-linecap="round"/>
    <rect x="22.6" y="34.4" width="2.8" height="2.4" rx=".5" fill="${c}" opacity=".5"/>`,
  pajaro: (c) => `
    <path d="M13.6 30.5 6.8 35.4h8.6Z" fill="#fff" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/>
    <circle cx="23" cy="25" r="11" fill="#fff"/>
    <path d="M33 20.6 40.4 23 33 25.6Z" fill="#fbbf24" stroke="#fbbf24" stroke-width="1" stroke-linejoin="round"/>
    <circle cx="28" cy="21" r="1.7" fill="${c}"/>
    <path d="M14.6 25.4q5.6-2.6 10.4 3.4-5.6 4-10.4-3.4Z" fill="${c}" opacity=".4"/>
    <path d="M21 36v4M25.5 36v4M19.6 40h3M24.1 40h3" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>`,
  pez: (c) => `
    <path d="M30.5 24 40.4 15.6v16.8Z" fill="#fff" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M18 17.4q4-4.4 9-1.4M18.5 30.6q3.5 3.6 7 1.4" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <ellipse cx="21" cy="24" rx="12" ry="8" fill="#fff"/>
    <circle cx="14.6" cy="22.4" r="1.7" fill="${c}"/>
    <path d="M19.2 19q2.2 5 0 10M23.5 21.5q1.2 2.5 0 5M27 21.5q1.2 2.5 0 5" stroke="${c}" stroke-width="1.2" fill="none" stroke-linecap="round" opacity=".7"/>`,
  hamster: (c) => `
    <circle cx="14.6" cy="15.6" r="4.6" fill="#fff"/><circle cx="33.4" cy="15.6" r="4.6" fill="#fff"/>
    <circle cx="14.6" cy="15.6" r="2.2" fill="${c}" opacity=".35"/><circle cx="33.4" cy="15.6" r="2.2" fill="${c}" opacity=".35"/>
    <ellipse cx="24" cy="26" rx="13" ry="11.6" fill="#fff"/>
    <circle cx="19.4" cy="23.6" r="1.7" fill="${c}"/><circle cx="28.6" cy="23.6" r="1.7" fill="${c}"/>
    <ellipse cx="15.6" cy="29.2" rx="2.6" ry="1.7" fill="${c}" opacity=".25"/><ellipse cx="32.4" cy="29.2" rx="2.6" ry="1.7" fill="${c}" opacity=".25"/>
    <ellipse cx="24" cy="27.4" rx="1.5" ry="1.1" fill="${c}"/>
    <path d="M24 28.4v1.4M22 30.6q1 1 2-.8 1 1.8 2 .8" stroke="${c}" stroke-width="1.1" fill="none" stroke-linecap="round"/>`,
  tortuga: (c) => `
    <ellipse cx="14.2" cy="31.6" rx="2.8" ry="3.4" fill="#fff"/><ellipse cx="31.8" cy="31.6" rx="2.8" ry="3.4" fill="#fff"/>
    <circle cx="37.8" cy="26.2" r="3.9" fill="#fff"/>
    <path d="M9 29.6a14 13.6 0 0 1 28 0Z" fill="#fff" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>
    <circle cx="38.8" cy="25.4" r="1.1" fill="${c}"/>
    <path d="M23 18.4l4.2 3.6-1.6 5H20.4l-1.6-5ZM18.8 22l-5 2.6M27.2 22l5 2.6M20.4 27l-2 2.6M25.6 27l2 2.6M23 18.4v-2" stroke="${c}" stroke-width="1.2" fill="none" stroke-linejoin="round" stroke-linecap="round" opacity=".6"/>`,
  caballo: (c) => `
    <path d="M17.6 38.6c-.8-6 .6-10.4 1.4-13.2l-4.4 1.8c-1.6.7-3.2-.4-3-2.2l.6-3.4c.4-2.2 2-4 3.8-5.4l4-3.2-.6-4.6 3.6 2.8 1.6-3.6 1.4 4.4c5.6 1.6 9.4 7 9.6 13.2l.2 13.4Z" fill="#fff" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/>
    <circle cx="21" cy="17.6" r="1.4" fill="${c}"/><circle cx="13.4" cy="24.4" r=".9" fill="${c}"/>
    <path d="M24.6 13.6c3.4 1.2 6.8 4.6 7.8 10M26.4 12.8c4.2 1.4 7.8 5.6 8.6 11.4" stroke="${c}" stroke-width="1.2" fill="none" stroke-linecap="round" opacity=".5"/>`,
  huella: (c) => `
    <ellipse cx="17.6" cy="16.2" rx="3.2" ry="4.1" fill="#fff"/><ellipse cx="30.4" cy="16.2" rx="3.2" ry="4.1" fill="#fff"/>
    <ellipse cx="11.4" cy="23.6" rx="2.9" ry="3.6" transform="rotate(-18 11.4 23.6)" fill="#fff"/><ellipse cx="36.6" cy="23.6" rx="2.9" ry="3.6" transform="rotate(18 36.6 23.6)" fill="#fff"/>
    <path d="M24 22.6c-4.6 0-9 5.6-9 9 0 2.6 2.2 3.8 4.4 3.8 1.9 0 2.6-1 4.6-1s2.7 1 4.6 1c2.2 0 4.4-1.2 4.4-3.8 0-3.4-4.4-9-9-9Z" fill="#fff"/>`,
  hueso: (c) => `
    <g transform="rotate(-35 24 24)"><circle cx="11.6" cy="20.6" r="4.4" fill="#fff"/><circle cx="11.6" cy="27.4" r="4.4" fill="#fff"/>
    <circle cx="36.4" cy="20.6" r="4.4" fill="#fff"/><circle cx="36.4" cy="27.4" r="4.4" fill="#fff"/>
    <rect x="11.6" y="20.4" width="24.8" height="7.2" rx="2" fill="#fff"/></g>`,
};

/** [clave, nombre, color] en el orden en que se muestran. */
export const ANIMALS = [
  ["perro", "Perro", "#b45309"], ["gato", "Gato", "#7c3aed"], ["conejo", "Conejo", "#db2777"],
  ["pajaro", "Pájaro", "#0891b2"], ["pez", "Pez", "#2563eb"], ["hamster", "Hámster", "#ea580c"],
  ["tortuga", "Tortuga", "#16a34a"], ["caballo", "Caballo", "#78350f"], ["huella", "Huella", "#e11d48"],
  ["hueso", "Hueso", "#0f172a"],
];

const hex = (c) => (/^#[0-9a-fA-F]{6}$/.test(c || "") ? c : null);

/** SVG del animal (data URL). bg: color del círculo. */
export function animalLogo(key, bg) {
  const a = ANIMALS.find((x) => x[0] === key) || ANIMALS[0];
  const c = hex(bg) || a[2];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="${c}"/>${ART[a[0]](c)}</svg>`;
  return "data:image/svg+xml;base64," + btoa(svg);
}

/** Qué icono va con la especie elegida en la ficha. */
export function animalFor(species) {
  const s = String(species || "").toLowerCase();
  if (s.startsWith("gat")) return "gato";
  if (s.startsWith("conej")) return "conejo";
  if (s.startsWith("p") && (s.includes("jar") || s.includes("ájar"))) return "pajaro";
  if (s.startsWith("hám") || s.startsWith("ham")) return "hamster";
  if (s.startsWith("tort")) return "tortuga";
  if (s.startsWith("caball") || s.startsWith("yegu")) return "caballo";
  if (s.startsWith("pez") || s.startsWith("pec")) return "pez";
  if (!s || s.startsWith("perr")) return "perro";
  return "huella";
}

/** Recorta la foto de la mascota en un círculo con borde blanco (PNG data URL). */
export function roundPhoto(src, size = 320, ring = "#ffffff") {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement("canvas"); cv.width = cv.height = size;
      const g = cv.getContext("2d"), r = size / 2, b = Math.round(size * 0.06);
      g.fillStyle = ring; g.beginPath(); g.arc(r, r, r, 0, Math.PI * 2); g.fill();
      g.save(); g.beginPath(); g.arc(r, r, r - b, 0, Math.PI * 2); g.clip();
      const s = Math.min(img.naturalWidth, img.naturalHeight);
      g.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, b, b, size - 2 * b, size - 2 * b);
      g.restore();
      res(cv.toDataURL("image/png"));
    };
    img.onerror = () => rej(new Error("No se pudo leer la foto"));
    img.src = src;
  });
}
