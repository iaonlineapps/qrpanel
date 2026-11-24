// Tipos de contenido: formulario de cada tipo, como se codifica y como se reconoce al escanear.

export const TYPES = {
  url: {
    name: "Enlace", icon: "link", dyn: true,
    fields: [{ k: "url", label: "Dirección web", ph: "https://tuweb.com", type: "url", req: true }],
    encode: (f) => normUrl(f.url),
  },
  text: {
    name: "Texto", icon: "text",
    fields: [{ k: "text", label: "Texto", ph: "Escribe lo que quieras", type: "textarea", req: true }],
    encode: (f) => f.text || "",
  },
  wifi: {
    name: "WiFi", icon: "wifi",
    fields: [
      { k: "ssid", label: "Nombre de la red (SSID)", ph: "MiCasa_5G", req: true },
      { k: "password", label: "Contraseña", ph: "••••••••", type: "password" },
      { k: "auth", label: "Seguridad", type: "select", options: [["WPA", "WPA / WPA2 / WPA3"], ["WEP", "WEP"], ["nopass", "Sin contraseña"]] },
      { k: "hidden", label: "Red oculta", type: "check" },
    ],
    encode: (f) => `WIFI:T:${f.auth || "WPA"};S:${wesc(f.ssid)};${f.auth === "nopass" ? "" : `P:${wesc(f.password)};`}${f.hidden ? "H:true;" : ""};`,
  },
  vcard: {
    name: "Contacto", icon: "user",
    fields: [
      { k: "first", label: "Nombre", ph: "Ana", half: true, req: true }, { k: "last", label: "Apellidos", ph: "García", half: true },
      { k: "phone", label: "Teléfono", ph: "+34 600 000 000", type: "tel", half: true }, { k: "email", label: "Email", ph: "ana@correo.com", type: "email", half: true },
      { k: "org", label: "Empresa", ph: "Mi Empresa", half: true }, { k: "title", label: "Cargo", ph: "Diseñadora", half: true },
      { k: "web", label: "Web", ph: "https://...", type: "url" },
      { k: "address", label: "Dirección", ph: "Calle, número, ciudad" },
      { k: "note", label: "Nota", ph: "", type: "textarea" },
    ],
    encode: (f) => ["BEGIN:VCARD", "VERSION:3.0", `N:${vesc(f.last)};${vesc(f.first)};;;`, `FN:${vesc([f.first, f.last].filter(Boolean).join(" "))}`,
      f.org && `ORG:${vesc(f.org)}`, f.title && `TITLE:${vesc(f.title)}`, f.phone && `TEL;TYPE=CELL:${f.phone}`,
      f.email && `EMAIL:${f.email}`, f.web && `URL:${normUrl(f.web)}`, f.address && `ADR:;;${vesc(f.address)};;;;`,
      f.note && `NOTE:${vesc(f.note)}`, "END:VCARD"].filter(Boolean).join("\n"),
  },
  email: {
    name: "Email", icon: "mail", dyn: true,
    fields: [
      { k: "to", label: "Para", ph: "hola@tuweb.com", type: "email", req: true },
      { k: "subject", label: "Asunto", ph: "" }, { k: "body", label: "Mensaje", type: "textarea" },
    ],
    encode: (f) => `mailto:${f.to || ""}${qs({ subject: f.subject, body: f.body })}`,
  },
  whatsapp: {
    name: "WhatsApp", icon: "chat", dyn: true,
    fields: [
      { k: "phone", label: "Número con prefijo", ph: "34600000000", type: "tel", req: true },
      { k: "text", label: "Mensaje inicial", type: "textarea", ph: "¡Hola! Vengo del QR" },
    ],
    encode: (f) => `https://wa.me/${(f.phone || "").replace(/[^0-9]/g, "")}${qs({ text: f.text })}`,
  },
  phone: {
    name: "Llamada", icon: "phone", dyn: true,
    fields: [{ k: "phone", label: "Teléfono", ph: "+34 600 000 000", type: "tel", req: true }],
    encode: (f) => `tel:${(f.phone || "").replace(/[^0-9+]/g, "")}`,
  },
  sms: {
    name: "SMS", icon: "sms",
    fields: [{ k: "phone", label: "Teléfono", ph: "+34 600 000 000", type: "tel", req: true }, { k: "text", label: "Mensaje", type: "textarea" }],
    encode: (f) => `SMSTO:${(f.phone || "").replace(/[^0-9+]/g, "")}:${f.text || ""}`,
  },
  geo: {
    name: "Ubicación", icon: "pin", dyn: true,
    fields: [
      { k: "lat", label: "Latitud", ph: "40.4168", half: true, req: true }, { k: "lng", label: "Longitud", ph: "-3.7038", half: true, req: true },
      { k: "label", label: "Nombre del sitio", ph: "Puerta del Sol" },
      { k: "_here", label: "Usar mi ubicación", type: "button", action: "geo" },
    ],
    encode: (f) => `https://maps.google.com/?q=${encodeURIComponent(`${(f.lat || "").trim()},${(f.lng || "").trim()}`)}${f.label ? `(${encodeURIComponent(f.label)})` : ""}`,
  },
  pet: {
    name: "Mascota", icon: "paw", dyn: true, page: true,
    fields: [
      { k: "photo", label: "Foto", type: "image" },
      { k: "name", label: "Nombre de la mascota", ph: "Toby", half: true, req: true },
      { k: "species", label: "Es un…", type: "select", half: true, options: [["perro", "Perro"], ["gato", "Gato"], ["otro", "Otro"]] },
      { k: "breed", label: "Raza", ph: "Mestizo, Beagle…", half: true }, { k: "color", label: "Color / señas", ph: "Marrón con mancha blanca", half: true },
      { k: "sex", label: "Sexo", type: "select", half: true, options: [["", "—"], ["macho", "Macho"], ["hembra", "Hembra"]] }, { k: "age", label: "Edad o nacimiento", ph: "3 años", half: true },
      { k: "chip", label: "Nº de microchip", ph: "941000000000000", half: true }, { k: "vet", label: "Veterinario", ph: "Clínica… y teléfono", half: true },
      { k: "health", label: "Salud: alergias, medicación, enfermedades", type: "textarea", ph: "Toma pastillas para el corazón por la mañana" },
      { k: "notes", label: "Carácter y cosas a saber", type: "textarea", ph: "Es miedoso: no le persigas, llámale por su nombre" },
      { k: "owner", label: "Nombre del dueño", ph: "David", half: true, req: true }, { k: "phone", label: "Teléfono (con prefijo)", ph: "+34 600 000 000", type: "tel", half: true, req: true },
      { k: "phone2", label: "Otro teléfono", ph: "+34 …", type: "tel", half: true }, { k: "email", label: "Email", ph: "tu@correo.com", type: "email", half: true },
      { k: "zone", label: "Zona donde vive", ph: "Barrio, ciudad" }, { k: "reward", label: "Recompensa", ph: "Se gratificará" },
      { k: "lost", label: "Se ha perdido: mostrar un aviso grande", type: "check" },
    ],
    // sin servidor (o si se lee sin internet) el QR lleva los datos en texto
    encode: (f) => [`🐾 ${f.name ? "Me llamo " + f.name : "Mascota"}${(f.species || "perro") !== "otro" ? ` (${f.species || "perro"}${f.breed ? ", " + f.breed : ""})` : ""}`,
      f.lost && "¡ME HE PERDIDO!", `Si me encuentras, avisa a ${f.owner || "mi familia"}: ${f.phone || ""}`, f.phone2 && `Otro teléfono: ${f.phone2}`,
      f.chip && `Microchip: ${f.chip}`, f.health && `Salud: ${f.health}`, f.reward && `Recompensa: ${f.reward}`].filter(Boolean).join("\n"),
  },
  event: {
    name: "Evento", icon: "calendar",
    fields: [
      { k: "title", label: "Título", ph: "Cumpleaños de Ana", req: true },
      { k: "start", label: "Empieza", type: "datetime-local", half: true, req: true }, { k: "end", label: "Termina", type: "datetime-local", half: true },
      { k: "location", label: "Lugar", ph: "" }, { k: "desc", label: "Descripción", type: "textarea" },
    ],
    encode: (f) => ["BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT", `SUMMARY:${vesc(f.title)}`,
      f.start && `DTSTART:${ical(f.start)}`, f.end && `DTEND:${ical(f.end)}`, f.location && `LOCATION:${vesc(f.location)}`,
      f.desc && `DESCRIPTION:${vesc(f.desc)}`, "END:VEVENT", "END:VCALENDAR"].filter(Boolean).join("\n"),
  },
};

function normUrl(u) {
  u = (u || "").trim();
  if (!u) return "";
  return /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : "https://" + u;
}
const wesc = (s) => String(s || "").replace(/([\\;,:"])/g, "\\$1");
const vesc = (s) => String(s || "").replace(/([\\;,])/g, "\\$1").replace(/\n/g, "\\n");
const ical = (v) => v.replace(/[-:]/g, "").slice(0, 13) + "00";
function qs(o) {
  const p = Object.entries(o).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
  return p.length ? "?" + p.join("&") : "";
}

export function encode(kind, fields) {
  const t = TYPES[kind] || TYPES.text;
  return t.encode(fields || {});
}

export function missing(kind, fields) {
  const t = TYPES[kind];
  return t ? t.fields.filter((f) => f.req && !String(fields?.[f.k] ?? "").trim()).map((f) => f.label) : [];
}

/** Reconoce lo que hay dentro de un QR leido: {kind, fields, title, summary}. */
export function parse(raw) {
  const s = String(raw || "");
  const unv = (x) => (x || "").replace(/\\n/g, "\n").replace(/\\([\\;,:"])/g, "$1");
  if (/^WIFI:/i.test(s)) {
    const get = (k) => { const m = s.match(new RegExp(`[:;]${k}:((?:\\\\.|[^;])*)`, "i")); return m ? unv(m[1]) : ""; };
    const auth = get("T") || "nopass";
    return { kind: "wifi", fields: { ssid: get("S"), password: get("P"), auth: /wep/i.test(auth) ? "WEP" : /nopass/i.test(auth) || !auth ? "nopass" : "WPA", hidden: /true/i.test(get("H")) }, title: "Red WiFi", summary: get("S") };
  }
  if (/^BEGIN:VCARD/i.test(s)) {
    const line = (k) => { const m = s.match(new RegExp(`^${k}[^:\\n]*:(.*)$`, "im")); return m ? unv(m[1].trim()) : ""; };
    const [last = "", first = ""] = line("N").split(";");
    return { kind: "vcard", fields: { first: first || line("FN"), last, phone: line("TEL"), email: line("EMAIL"), org: line("ORG"), title: line("TITLE"), web: line("URL"), address: line("ADR").replace(/;+/g, " ").trim(), note: line("NOTE") }, title: "Contacto", summary: line("FN") || first };
  }
  if (/BEGIN:VEVENT/i.test(s)) {
    const line = (k) => { const m = s.match(new RegExp(`^${k}[^:\\n]*:(.*)$`, "im")); return m ? unv(m[1].trim()) : ""; };
    const dt = (v) => (v && v.length >= 13 ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}T${v.slice(9, 11)}:${v.slice(11, 13)}` : "");
    return { kind: "event", fields: { title: line("SUMMARY"), start: dt(line("DTSTART")), end: dt(line("DTEND")), location: line("LOCATION"), desc: line("DESCRIPTION") }, title: "Evento", summary: line("SUMMARY") };
  }
  if (/^mailto:/i.test(s)) {
    const u = new URL(s);
    return { kind: "email", fields: { to: decodeURIComponent(u.pathname), subject: u.searchParams.get("subject") || "", body: u.searchParams.get("body") || "" }, title: "Email", summary: decodeURIComponent(u.pathname) };
  }
  if (/^tel:/i.test(s)) return { kind: "phone", fields: { phone: s.slice(4) }, title: "Llamada", summary: s.slice(4) };
  if (/^(SMSTO|sms):/i.test(s)) {
    const [, phone = "", text = ""] = s.match(/^(?:SMSTO|sms):([^:?]*)[:?]?(?:body=)?(.*)$/i) || [];
    return { kind: "sms", fields: { phone, text: decodeURIComponent(text) }, title: "SMS", summary: phone };
  }
  let m = s.match(/^https?:\/\/(?:wa\.me|api\.whatsapp\.com\/send\?phone=)\/?(\d+)(?:[?&]text=(.*))?/i);
  if (m) return { kind: "whatsapp", fields: { phone: m[1], text: m[2] ? decodeURIComponent(m[2]) : "" }, title: "WhatsApp", summary: "+" + m[1] };
  m = s.match(/^geo:(-?[\d.]+),(-?[\d.]+)/i) || s.match(/maps\.google\.[^/]+\/\?q=(-?[\d.]+)(?:,|%2C)(-?[\d.]+)/i);
  if (m) return { kind: "geo", fields: { lat: m[1], lng: m[2], label: "" }, title: "Ubicación", summary: `${m[1]}, ${m[2]}` };
  if (/^https?:\/\//i.test(s)) { let host = s; try { host = new URL(s).host; } catch { /* nada */ } return { kind: "url", fields: { url: s }, title: "Enlace", summary: host }; }
  return { kind: "text", fields: { text: s }, title: "Texto", summary: s.slice(0, 80) };
}
