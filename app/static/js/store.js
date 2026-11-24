// Donde se guardan los QR. Con servidor: su base de datos (SQLite) por la API.
// Sin servidor (por ejemplo abierto como página estática): IndexedDB del navegador.

export class ApiError extends Error {
  constructor(status, msg) { super(msg); this.status = status; }
}

async function api(method, url, body) {
  const r = await fetch(url, {
    method, credentials: "same-origin",
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await r.json(); } catch { /* sin cuerpo */ }
  if (!r.ok) {
    let msg = data?.detail;
    if (Array.isArray(msg)) msg = "Revisa los datos: hay algún campo demasiado largo o no válido";
    throw new ApiError(r.status, msg || `Error ${r.status}`);
  }
  return data;
}

export const ServerStore = {
  mode: "server",
  info: () => api("GET", "/api/info"),
  me: () => api("GET", "/api/me"),
  login: (username, password) => api("POST", "/api/login", { username, password }),
  register: (username, password) => api("POST", "/api/register", { username, password }),
  logout: () => api("POST", "/api/logout"),
  password: (old, nw) => api("POST", "/api/password", { old, new: nw }),
  list: () => api("GET", "/api/qrs"),
  create: (q) => api("POST", "/api/qrs", q),
  update: (id, q) => api("PUT", `/api/qrs/${id}`, q),
  patch: (id, p) => api("PATCH", `/api/qrs/${id}`, p),
  remove: (id) => api("DELETE", `/api/qrs/${id}`),
  qrStats: (id, days = 30) => api("GET", `/api/qrs/${id}/stats?days=${days}`),
  stats: () => api("GET", "/api/stats"),
  logos: () => api("GET", "/api/logos"),
  addLogo: (name, data) => api("POST", "/api/logos", { name, data }),
  delLogo: (id) => api("DELETE", `/api/logos/${id}`),
  templates: () => api("GET", "/api/templates"),
  addTemplate: (name, design) => api("POST", "/api/templates", { name, design }),
  delTemplate: (id) => api("DELETE", `/api/templates/${id}`),
  exportAll: () => api("GET", "/api/export"),
  importAll: (data) => api("POST", "/api/import", data),
  users: () => api("GET", "/api/admin/users"),
  addUser: (u) => api("POST", "/api/admin/users", u),
  updUser: (id, u) => api("PATCH", `/api/admin/users/${id}`, u),
  delUser: (id) => api("DELETE", `/api/admin/users/${id}`),
  saveSettings: (s) => api("POST", "/api/admin/settings", s),
};

// --- modo local (IndexedDB) -------------------------------------------------------
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open("qrpanel", 1);
    r.onupgradeneeded = () => { for (const s of ["qrs", "logos", "templates"]) r.result.createObjectStore(s, { keyPath: "id", autoIncrement: true }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
let dbp = null;
async function tx(store, mode, fn) {
  dbp ||= idb();
  const db = await dbp;
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode), s = t.objectStore(store);
    const req = fn(s);
    t.oncomplete = () => res(req?.result); t.onerror = () => rej(t.error);
  });
}
const all = (s) => tx(s, "readonly", (st) => st.getAll());
const put = (s, v) => tx(s, "readwrite", (st) => st.put(v));
const del = (s, id) => tx(s, "readwrite", (st) => st.delete(id));
const get = (s, id) => tx(s, "readonly", (st) => st.get(id));
const local = (q) => ({ ...q, dynamic: false, code: null, short_url: null, scans: 0 });

export const LocalStore = {
  mode: "local",
  me: async () => ({ username: "Este dispositivo", is_admin: false, local: true, version: "local" }),
  list: async () => (await all("qrs")).sort((a, b) => b.updated - a.updated),
  create: async (q) => { const now = Date.now() / 1000; const v = local({ ...q, created: now, updated: now }); delete v.id; v.id = await put("qrs", v); return v; },
  update: async (id, q) => { const old = await get("qrs", id); const v = local({ ...old, ...q, id, updated: Date.now() / 1000 }); await put("qrs", v); return v; },
  patch: async (id, p) => { const old = await get("qrs", id); const v = { ...old, ...p }; await put("qrs", v); return v; },
  remove: (id) => del("qrs", id),
  logos: async () => (await all("logos")).reverse(),
  addLogo: async (name, data) => { const v = { name, data, created: Date.now() / 1000 }; v.id = await put("logos", v); return v; },
  delLogo: (id) => del("logos", id),
  templates: async () => (await all("templates")).reverse(),
  addTemplate: async (name, design) => { const v = { name, design }; v.id = await put("templates", v); return v; },
  delTemplate: (id) => del("templates", id),
  stats: async () => { const q = await all("qrs"); return { qrs: q.length, dynamic: 0, scans: 0, week: 0, days: [], top: [], devices: [] }; },
  exportAll: async () => ({ app: "qrpanel", version: "local", exported: Date.now() / 1000, qrs: await all("qrs"), logos: await all("logos"), templates: await all("templates") }),
  importAll: async (data) => {
    const map = {};
    for (const l of data.logos || []) { const id = (await LocalStore.addLogo(l.name, l.data)).id; map[l.id] = id; }
    for (const t of data.templates || []) await LocalStore.addTemplate(t.name, t.design);
    let n = 0;
    for (const q of data.qrs || []) {
      const c = structuredClone(q); delete c.id;
      if (c.design?.logo?.id != null) c.design.logo.id = map[c.design.logo.id] ?? null;
      await LocalStore.create(c); n++;
    }
    return { qrs: n, logos: Object.keys(map).length };
  },
};

/** Decide si hay servidor de QRPanel detras o se trabaja en local. */
export async function detect() {
  try {
    const r = await fetch("/api/info", { credentials: "same-origin" });
    if (!r.ok) return { store: LocalStore };
    const info = await r.json();
    if (info?.app !== "qrpanel") return { store: LocalStore };
    return { store: ServerStore, info };
  } catch {
    return { store: LocalStore };
  }
}
