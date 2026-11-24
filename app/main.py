import asyncio, hashlib, json, re, secrets, time
from contextlib import asynccontextmanager
from html import escape
from pathlib import Path
from urllib.parse import parse_qs

from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.responses import FileResponse, JSONResponse, HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import db, limits
from .version import VERSION
from .config import ALLOW_REGISTER, PUBLIC_URL


@asynccontextmanager
async def lifespan(_app):
    db.init()
    yield


APP_DIR = Path(__file__).parent
STATIC = APP_DIR / "static"
app = FastAPI(title="QRPanel", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
COOKIE = "qp_session"
USER_RE = re.compile(r"^[a-zA-Z0-9_-][a-zA-Z0-9_.-]{2,31}$")
CODE_RE = re.compile(r"^[A-Za-z0-9_-]{3,40}$")
COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
# Destinos permitidos para un QR dinamico: nunca javascript: ni data:
TARGET_RE = re.compile(r"^(https?://|mailto:|tel:|sms:|smsto:|geo:|whatsapp:|tg:)", re.I)
MAX_PENDING = 20
MAX_JSON = 400_000        # diseno + campos de un QR (sin logos, que van aparte)
MAX_LOGO = 1_500_000      # un logo en data URL (el navegador lo reduce antes de subirlo)
LOGO_RE = re.compile(r"^data:image/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$")
CSP = ("default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; "
       "script-src 'self'; connect-src 'self'; media-src 'self' blob:; worker-src 'self'; "
       "object-src 'none'; base-uri 'self'; frame-ancestors 'self'")


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "?"


@app.middleware("http")
async def _security_headers(request: Request, call_next):
    r = await call_next(request)
    r.headers.setdefault("X-Content-Type-Options", "nosniff")
    r.headers.setdefault("Referrer-Policy", "same-origin")
    r.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
    r.headers.setdefault("Content-Security-Policy", CSP)
    r.headers.setdefault("Permissions-Policy", "camera=(self), geolocation=(self)")
    return r


# --- autenticacion -------------------------------------------------------------
def current_user(request: Request):
    u = db.session_user(request.cookies.get(COOKIE, ""))
    if not u:
        raise HTTPException(401, "Inicia sesión")
    return u


def admin_user(u=Depends(current_user)):
    if not u["is_admin"]:
        raise HTTPException(403, "Solo para administradores")
    return u


def public_base(request: Request) -> str:
    """Direccion que llevan dentro los QR dinamicos."""
    base = db.setting("public_url") or PUBLIC_URL
    if base:
        return base.rstrip("/")
    return str(request.base_url).rstrip("/")


class Creds(BaseModel):
    username: str = Field(max_length=64)
    password: str = Field(max_length=256)


def brand() -> dict:
    return {"name": db.setting("brand_name") or "QRPanel", "logo": db.setting("brand_logo") or None}


@app.get("/api/info")
def info():
    has_users = db.q1("SELECT COUNT(*) n FROM users")["n"] > 0
    return {"app": "qrpanel", "version": VERSION, "has_users": has_users,
            "allow_register": ALLOW_REGISTER or not has_users, "brand": brand()}


@app.post("/api/register")
def register(c: Creds, request: Request):
    name = c.username.strip()
    ip = client_ip(request)
    first = db.q1("SELECT COUNT(*) n FROM users")["n"] == 0
    if not first and not ALLOW_REGISTER:
        raise HTTPException(403, "El registro está cerrado. Pide al administrador que te cree una cuenta")
    if not first and limits.register.blocked(ip):
        raise HTTPException(429, "Demasiadas cuentas nuevas desde aquí. Prueba más tarde")
    if not first and db.q1("SELECT COUNT(*) n FROM users WHERE status='pending'")["n"] >= MAX_PENDING:
        raise HTTPException(429, "Hay demasiadas cuentas esperando aprobación. Prueba más tarde")
    if not USER_RE.match(name):
        raise HTTPException(400, "Usuario: 3-32 caracteres (letras, números, . _ -)")
    if len(c.password) < 6:
        raise HTTPException(400, "La contraseña debe tener al menos 6 caracteres")
    if db.q1("SELECT id FROM users WHERE username=?", name):
        raise HTTPException(400, "Ese usuario ya existe")
    if not first:
        limits.register.hit(ip)
    db.run("INSERT INTO users(username,pw_hash,is_admin,status,created) VALUES(?,?,?,?,?)",
           name, db.hash_pw(c.password), 1 if first else 0,
           "approved" if first else "pending", time.time())
    if first:
        return {"ok": True, "first": True, "msg": "Cuenta de administrador creada. Ya puedes entrar."}
    return {"ok": True, "msg": "Cuenta creada. El administrador tiene que aprobarla antes de entrar."}


@app.post("/api/login")
async def login(c: Creds, request: Request):
    name, ip = c.username.strip(), client_ip(request)
    wait = limits.login_blocked(ip, name)
    if wait:
        raise HTTPException(429, f"Demasiados intentos fallidos. Espera {max(1, wait // 60)} min y vuelve a probar")
    u = await asyncio.to_thread(db.authenticate, name, c.password)
    if not u:
        limits.login_failed(ip, name)
        await asyncio.sleep(0.7)
        raise HTTPException(401, "Usuario o contraseña incorrectos")
    limits.login_ok(ip, name)
    if u["status"] == "pending":
        raise HTTPException(403, "Tu cuenta está pendiente de aprobación")
    if u["status"] != "approved":
        raise HTTPException(403, "Tu cuenta está bloqueada")
    tok = db.new_session(u["id"])
    r = JSONResponse({"ok": True})
    r.set_cookie(COOKIE, tok, max_age=30 * 86400, httponly=True, samesite="lax")
    return r


@app.post("/api/logout")
def logout(request: Request):
    db.run("DELETE FROM sessions WHERE token=?", request.cookies.get(COOKIE, ""))
    r = JSONResponse({"ok": True})
    r.delete_cookie(COOKIE)
    return r


class PwChange(BaseModel):
    old: str = Field(max_length=256)
    new: str = Field(max_length=256)


@app.post("/api/password")
def change_pw(p: PwChange, request: Request, u=Depends(current_user)):
    if not db.check_pw(p.old, u["pw_hash"]):
        raise HTTPException(400, "La contraseña actual no es correcta")
    if len(p.new) < 6:
        raise HTTPException(400, "Mínimo 6 caracteres")
    db.run("UPDATE users SET pw_hash=? WHERE id=?", db.hash_pw(p.new), u["id"])
    db.run("DELETE FROM sessions WHERE user_id=? AND token<>?", u["id"], request.cookies.get(COOKIE, ""))
    return {"ok": True}


@app.get("/api/me")
def me(request: Request, u=Depends(current_user)):
    pending = db.q1("SELECT COUNT(*) n FROM users WHERE status='pending'")["n"] if u["is_admin"] else 0
    return {"username": u["username"], "is_admin": bool(u["is_admin"]), "pending": pending,
            "version": VERSION, "public_url": public_base(request),
            "public_url_custom": db.setting("public_url") or PUBLIC_URL, "brand": brand()}


# --- QR ------------------------------------------------------------------------
class QRIn(BaseModel):
    name: str = Field("", max_length=120)
    kind: str = Field("url", max_length=20)
    fields: dict = {}
    content: str = Field("", max_length=8000)
    design: dict = {}
    folder: str = Field("", max_length=60)
    favorite: bool = False
    dynamic: bool = False
    code: str | None = Field(None, max_length=40)
    target: str | None = Field(None, max_length=4000)
    active: bool = True
    expires: float | None = None
    max_scans: int | None = Field(None, ge=0, le=10_000_000)
    # PIN para abrir el QR: None = no cambiar, "" = quitarlo, texto = ponerlo
    pin: str | None = Field(None, max_length=32)
    pin_hash: str | None = Field(None, max_length=200)  # solo al importar una copia


PIN_RE = re.compile(r"^[A-Za-z0-9]{4,32}$")
PIN_HASH_RE = re.compile(r"^pbkdf2\$(\d{4,7})\$[0-9a-f]{32}\$[0-9a-f]{64}$")


def _pin_value(b: QRIn, old: str | None) -> str | None:
    if not b.dynamic:
        return old
    if b.pin is None:
        m = PIN_HASH_RE.match(b.pin_hash or "")
        if m and 1000 <= int(m.group(1)) <= 1_000_000:  # que una copia no traiga un hash imposible
            return b.pin_hash
        return old
    p = b.pin.strip()
    if not p:
        return None
    if not PIN_RE.match(p):
        raise HTTPException(400, "El PIN debe tener de 4 a 32 letras o números")
    return db.hash_pw(p)


def _new_code() -> str:
    alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    while True:
        c = "".join(secrets.choice(alphabet) for _ in range(6))
        if not db.q1("SELECT id FROM qrs WHERE code=?", c):
            return c


def _row(r, base: str) -> dict:
    d = dict(r)
    d["fields"] = json.loads(d["fields"] or "{}")
    d["design"] = json.loads(d["design"] or "{}")
    d["favorite"], d["dynamic"], d["active"] = bool(d["favorite"]), bool(d["dynamic"]), bool(d["active"])
    d.pop("user_id", None)
    d["has_pin"] = bool(d.pop("pin", None))
    d["short_url"] = f"{base}/r/{d['code']}" if d["dynamic"] and d["code"] else None
    d["share_url"] = f"{base}/s/{d['share']}" if d.get("share") else None
    return d


def _check(b: QRIn, qid: int | None = None) -> tuple[str | None, str | None]:
    blob = json.dumps(b.design) + json.dumps(b.fields)
    if len(blob) > MAX_JSON:
        raise HTTPException(413, "El diseño es demasiado grande")
    if not b.dynamic:
        return None, None
    target = (b.target or "").strip()
    if not TARGET_RE.match(target):
        raise HTTPException(400, "Un QR dinámico necesita un destino válido (https://, mailto:, tel:...)")
    code = (b.code or "").strip()
    if code:
        if not CODE_RE.match(code):
            raise HTTPException(400, "El código corto solo admite letras, números, - y _ (3 a 40)")
        other = db.q1("SELECT id FROM qrs WHERE code=?", code)
        if other and other["id"] != qid:
            raise HTTPException(400, "Ese código corto ya está en uso")
    return code or None, target


@app.get("/api/qrs")
def list_qrs(request: Request, u=Depends(current_user)):
    base = public_base(request)
    rows = db.q("SELECT * FROM qrs WHERE user_id=? ORDER BY updated DESC", u["id"])
    return [_row(r, base) for r in rows]


@app.post("/api/qrs")
def create_qr(b: QRIn, request: Request, u=Depends(current_user)):
    code, target = _check(b)
    if b.dynamic and not code:
        code = _new_code()
    if b.dynamic:  # lo que va dentro del QR es la direccion corta, no el destino
        b.content = f"{public_base(request)}/r/{code}"
    now = time.time()
    cur = db.run("INSERT INTO qrs(user_id,name,kind,fields,content,design,folder,favorite,dynamic,code,target,"
                 "active,expires,max_scans,pin,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                 u["id"], b.name.strip() or "Sin nombre", b.kind, json.dumps(b.fields), b.content,
                 json.dumps(b.design), b.folder.strip(), int(b.favorite), int(b.dynamic), code, target,
                 int(b.active), b.expires, b.max_scans or None, _pin_value(b, None), now, now)
    r = db.q1("SELECT * FROM qrs WHERE id=?", cur.lastrowid)
    return _row(r, public_base(request))


def _own(qid: int, u):
    r = db.q1("SELECT * FROM qrs WHERE id=? AND user_id=?", qid, u["id"])
    if not r:
        raise HTTPException(404, "No existe ese QR")
    return r


@app.put("/api/qrs/{qid}")
def update_qr(qid: int, b: QRIn, request: Request, u=Depends(current_user)):
    old = _own(qid, u)
    code, target = _check(b, qid)
    if b.dynamic:
        # el codigo corto no cambia salvo que se pida: los QR ya impresos siguen funcionando
        code = code or old["code"] or _new_code()
        # si ya estaba impreso con esta direccion, no se cambia aunque cambie la direccion publica
        keep = old["dynamic"] and (old["content"] or "").endswith(f"/r/{code}")
        b.content = old["content"] if keep else f"{public_base(request)}/r/{code}"
    else:
        code = old["code"]  # se guarda por si se vuelve a hacer dinamico
    db.run("UPDATE qrs SET name=?,kind=?,fields=?,content=?,design=?,folder=?,favorite=?,dynamic=?,code=?,"
           "target=?,active=?,expires=?,max_scans=?,pin=?,updated=? WHERE id=?",
           b.name.strip() or "Sin nombre", b.kind, json.dumps(b.fields), b.content, json.dumps(b.design),
           b.folder.strip(), int(b.favorite), int(b.dynamic), code, target if b.dynamic else old["target"],
           int(b.active), b.expires, b.max_scans or None, _pin_value(b, old["pin"]), time.time(), qid)
    return _row(db.q1("SELECT * FROM qrs WHERE id=?", qid), public_base(request))


class QRPatch(BaseModel):
    favorite: bool | None = None
    active: bool | None = None
    folder: str | None = Field(None, max_length=60)
    name: str | None = Field(None, max_length=120)


@app.patch("/api/qrs/{qid}")
def patch_qr(qid: int, b: QRPatch, request: Request, u=Depends(current_user)):
    _own(qid, u)
    for col, val in (("favorite", b.favorite), ("active", b.active), ("folder", b.folder), ("name", b.name)):
        if val is not None:
            db.run(f"UPDATE qrs SET {col}=? WHERE id=?", int(val) if isinstance(val, bool) else val.strip(), qid)
    return _row(db.q1("SELECT * FROM qrs WHERE id=?", qid), public_base(request))


@app.delete("/api/qrs/{qid}")
def delete_qr(qid: int, u=Depends(current_user)):
    _own(qid, u)
    db.run("DELETE FROM scans WHERE qr_id=?", qid)
    db.run("DELETE FROM qrs WHERE id=?", qid)
    return {"ok": True}


# --- compartir con un enlace publico -----------------------------------------------
@app.post("/api/qrs/{qid}/share")
def share_on(qid: int, request: Request, u=Depends(current_user)):
    r = _own(qid, u)
    if not r["share"]:
        db.run("UPDATE qrs SET share=? WHERE id=?", secrets.token_urlsafe(12), qid)
    return _row(db.q1("SELECT * FROM qrs WHERE id=?", qid), public_base(request))


@app.delete("/api/qrs/{qid}/share")
def share_off(qid: int, request: Request, u=Depends(current_user)):
    _own(qid, u)
    db.run("UPDATE qrs SET share=NULL WHERE id=?", qid)
    return _row(db.q1("SELECT * FROM qrs WHERE id=?", qid), public_base(request))


@app.get("/api/share/{token}")
def share_get(token: str):
    r = db.q1("SELECT q.*, u.username FROM qrs q JOIN users u ON u.id=q.user_id WHERE q.share=?", token)
    if not r or len(token) < 10:
        raise HTTPException(404, "Este enlace ya no existe")
    design = json.loads(r["design"] or "{}")
    logo = design.get("logo") or {}
    if logo.get("id") is not None:  # el logo va dentro para que se vea igual
        lg = db.q1("SELECT data FROM logos WHERE id=? AND user_id=?", logo["id"], r["user_id"])
        logo["src"], logo["id"] = (lg["data"] if lg else None), None
    return {"name": r["name"], "kind": r["kind"], "content": r["content"], "design": design,
            "owner": r["username"], "dynamic": bool(r["dynamic"]), "updated": r["updated"], "brand": brand()}


@app.get("/s/{token}")
def share_page(token: str):
    return FileResponse(STATIC / "share.html", headers={"Cache-Control": "no-cache"})


def _days(n: int) -> list[str]:
    today = time.time()
    return [time.strftime("%Y-%m-%d", time.localtime(today - i * 86400)) for i in range(n - 1, -1, -1)]


def _group(sql: str, *args) -> list[dict]:
    return [{"k": r["k"] or "Otro", "n": r["n"]} for r in db.q(sql, *args)]


@app.get("/api/qrs/{qid}/stats")
def qr_stats(qid: int, days: int = 30, u=Depends(current_user)):
    r = _own(qid, u)
    days = max(7, min(days, 365))
    since = time.time() - days * 86400
    per = {x["day"]: x["n"] for x in db.q(
        "SELECT day, COUNT(*) n FROM scans WHERE qr_id=? AND at>=? GROUP BY day", qid, since)}
    return {
        "total": r["scans"], "last_scan": r["last_scan"],
        "unique": db.q1("SELECT COUNT(DISTINCT visitor) n FROM scans WHERE qr_id=?", qid)["n"],
        "days": [{"day": d, "n": per.get(d, 0)} for d in _days(days)],
        "devices": _group("SELECT device k, COUNT(*) n FROM scans WHERE qr_id=? GROUP BY device ORDER BY n DESC", qid),
        "os": _group("SELECT os k, COUNT(*) n FROM scans WHERE qr_id=? GROUP BY os ORDER BY n DESC", qid),
        "browsers": _group("SELECT browser k, COUNT(*) n FROM scans WHERE qr_id=? GROUP BY browser ORDER BY n DESC LIMIT 6", qid),
        "hours": _hours(qid),
        "recent": [dict(x) for x in db.q(
            "SELECT at, device, os, browser FROM scans WHERE qr_id=? ORDER BY at DESC LIMIT 15", qid)],
    }


def _hours(qid: int) -> list[int]:
    out = [0] * 24
    for x in db.q("SELECT at FROM scans WHERE qr_id=? ORDER BY at DESC LIMIT 5000", qid):
        out[time.localtime(x["at"]).tm_hour] += 1
    return out


@app.get("/api/stats")
def stats(u=Depends(current_user)):
    uid = u["id"]
    since = time.time() - 30 * 86400
    per = {x["day"]: x["n"] for x in db.q(
        "SELECT s.day, COUNT(*) n FROM scans s JOIN qrs q ON q.id=s.qr_id WHERE q.user_id=? AND s.at>=? "
        "GROUP BY s.day", uid, since)}
    week = time.time() - 7 * 86400
    return {
        "qrs": db.q1("SELECT COUNT(*) n FROM qrs WHERE user_id=?", uid)["n"],
        "dynamic": db.q1("SELECT COUNT(*) n FROM qrs WHERE user_id=? AND dynamic=1", uid)["n"],
        "scans": db.q1("SELECT COALESCE(SUM(scans),0) n FROM qrs WHERE user_id=?", uid)["n"],
        "week": db.q1("SELECT COUNT(*) n FROM scans s JOIN qrs q ON q.id=s.qr_id WHERE q.user_id=? AND s.at>=?",
                      uid, week)["n"],
        "days": [{"day": d, "n": per.get(d, 0)} for d in _days(30)],
        "top": [dict(x) for x in db.q(
            "SELECT id, name, scans, code FROM qrs WHERE user_id=? AND dynamic=1 ORDER BY scans DESC LIMIT 5", uid)],
        "devices": _group("SELECT s.device k, COUNT(*) n FROM scans s JOIN qrs q ON q.id=s.qr_id "
                          "WHERE q.user_id=? GROUP BY s.device ORDER BY n DESC", uid),
    }


# --- logos y plantillas ----------------------------------------------------------
class LogoIn(BaseModel):
    name: str = Field("Logo", max_length=80)
    data: str = Field(max_length=MAX_LOGO)


@app.get("/api/logos")
def list_logos(u=Depends(current_user)):
    return [dict(r) for r in db.q("SELECT id, name, data, created FROM logos WHERE user_id=? ORDER BY id DESC", u["id"])]


@app.post("/api/logos")
def add_logo(b: LogoIn, u=Depends(current_user)):
    if not LOGO_RE.match(b.data):
        raise HTTPException(400, "La imagen no es válida (PNG, JPG, WebP, GIF o SVG)")
    if db.q1("SELECT COUNT(*) n FROM logos WHERE user_id=?", u["id"])["n"] >= 200:
        raise HTTPException(400, "Has llegado al máximo de 200 logos. Borra alguno")
    cur = db.run("INSERT INTO logos(user_id,name,data,created) VALUES(?,?,?,?)",
                 u["id"], b.name.strip() or "Logo", b.data, time.time())
    return {"id": cur.lastrowid, "name": b.name, "data": b.data, "created": time.time()}


@app.delete("/api/logos/{lid}")
def del_logo(lid: int, u=Depends(current_user)):
    db.run("DELETE FROM logos WHERE id=? AND user_id=?", lid, u["id"])
    return {"ok": True}


class TemplateIn(BaseModel):
    name: str = Field("Mi plantilla", max_length=80)
    design: dict


@app.get("/api/templates")
def list_templates(u=Depends(current_user)):
    return [{"id": r["id"], "name": r["name"], "design": json.loads(r["design"]), "created": r["created"]}
            for r in db.q("SELECT * FROM templates WHERE user_id=? ORDER BY id DESC", u["id"])]


@app.post("/api/templates")
def add_template(b: TemplateIn, u=Depends(current_user)):
    blob = json.dumps(b.design)
    if len(blob) > MAX_JSON:
        raise HTTPException(413, "La plantilla es demasiado grande")
    cur = db.run("INSERT INTO templates(user_id,name,design,created) VALUES(?,?,?,?)",
                 u["id"], b.name.strip() or "Mi plantilla", blob, time.time())
    return {"id": cur.lastrowid, "name": b.name, "design": b.design}


@app.delete("/api/templates/{tid}")
def del_template(tid: int, u=Depends(current_user)):
    db.run("DELETE FROM templates WHERE id=? AND user_id=?", tid, u["id"])
    return {"ok": True}


# --- copia de seguridad --------------------------------------------------------------
@app.get("/api/export")
def export(request: Request, u=Depends(current_user)):
    pins = {r["id"]: r["pin"] for r in db.q("SELECT id, pin FROM qrs WHERE user_id=? AND pin IS NOT NULL", u["id"])}
    qrs = list_qrs(request, u)
    for x in qrs:
        if x["id"] in pins:
            x["pin_hash"] = pins[x["id"]]
    data = {"app": "qrpanel", "version": VERSION, "exported": time.time(),
            "qrs": qrs, "logos": list_logos(u), "templates": list_templates(u)}
    return JSONResponse(data, headers={"Content-Disposition": 'attachment; filename="qrpanel-copia.json"'})


class ImportIn(BaseModel):
    qrs: list[dict] = []
    logos: list[dict] = []
    templates: list[dict] = []


@app.post("/api/import")
def import_data(b: ImportIn, request: Request, u=Depends(current_user)):
    if len(b.qrs) > 5000 or len(b.logos) > 200 or len(b.templates) > 500:
        raise HTTPException(413, "La copia es demasiado grande")
    logo_map, n = {}, 0
    for lg in b.logos:
        if isinstance(lg.get("data"), str) and LOGO_RE.match(lg["data"]) and len(lg["data"]) <= MAX_LOGO:
            nid = add_logo(LogoIn(name=str(lg.get("name", "Logo"))[:80], data=lg["data"]), u)["id"]
            logo_map[str(lg.get("id"))] = nid
    for t in b.templates:
        if isinstance(t.get("design"), dict):
            add_template(TemplateIn(name=str(t.get("name", "Plantilla"))[:80], design=t["design"]), u)
    for x in b.qrs:
        try:
            design = x.get("design") or {}
            logo = design.get("logo") or {}
            if logo.get("id") is not None:
                logo["id"] = logo_map.get(str(logo["id"]))
            item = QRIn(**{k: x[k] for k in QRIn.model_fields if k in x and x[k] is not None and k != "pin"})
            # los codigos cortos que ya existen en este servidor no se pisan
            if item.code and db.q1("SELECT id FROM qrs WHERE code=?", item.code):
                item.code = None
            create_qr(item, request, u)
            n += 1
        except (HTTPException, ValueError, TypeError):
            continue
    return {"ok": True, "qrs": n, "logos": len(logo_map)}


# --- administracion -------------------------------------------------------------
@app.get("/api/admin/users")
def admin_users(a=Depends(admin_user)):
    return [dict(r) for r in db.q(
        "SELECT u.id, u.username, u.is_admin, u.status, u.created, "
        "(SELECT COUNT(*) FROM qrs q WHERE q.user_id=u.id) qrs, "
        "(SELECT COALESCE(SUM(scans),0) FROM qrs q WHERE q.user_id=u.id) scans "
        "FROM users u ORDER BY u.status='pending' DESC, u.username")]


class NewUser(BaseModel):
    username: str = Field(max_length=64)
    password: str = Field(max_length=256)
    is_admin: bool = False


@app.post("/api/admin/users")
def admin_create(b: NewUser, a=Depends(admin_user)):
    name = b.username.strip()
    if not USER_RE.match(name):
        raise HTTPException(400, "Usuario: 3-32 caracteres (letras, números, . _ -)")
    if len(b.password) < 6:
        raise HTTPException(400, "La contraseña debe tener al menos 6 caracteres")
    if db.q1("SELECT id FROM users WHERE username=?", name):
        raise HTTPException(400, "Ese usuario ya existe")
    db.run("INSERT INTO users(username,pw_hash,is_admin,status,created) VALUES(?,?,?,'approved',?)",
           name, db.hash_pw(b.password), int(b.is_admin), time.time())
    return {"ok": True}


class UserUpd(BaseModel):
    status: str | None = None
    is_admin: bool | None = None
    password: str | None = Field(None, max_length=256)


@app.patch("/api/admin/users/{uid}")
def admin_update(uid: int, b: UserUpd, a=Depends(admin_user)):
    t = db.q1("SELECT * FROM users WHERE id=?", uid)
    if not t:
        raise HTTPException(404)
    if t["id"] == a["id"] and (b.status not in (None, "approved") or b.is_admin is False):
        raise HTTPException(400, "No puedes quitarte el acceso a ti mismo")
    if b.status is not None:
        if b.status not in ("approved", "blocked", "pending"):
            raise HTTPException(400)
        db.run("UPDATE users SET status=? WHERE id=?", b.status, uid)
        if b.status != "approved":
            db.run("DELETE FROM sessions WHERE user_id=?", uid)
    if b.is_admin is not None:
        db.run("UPDATE users SET is_admin=? WHERE id=?", int(b.is_admin), uid)
    if b.password:
        if len(b.password) < 6:
            raise HTTPException(400, "Mínimo 6 caracteres")
        db.run("UPDATE users SET pw_hash=? WHERE id=?", db.hash_pw(b.password), uid)
        if uid != a["id"]:
            db.run("DELETE FROM sessions WHERE user_id=?", uid)
    return {"ok": True}


@app.delete("/api/admin/users/{uid}")
def admin_delete(uid: int, a=Depends(admin_user)):
    t = db.q1("SELECT * FROM users WHERE id=?", uid)
    if not t or t["id"] == a["id"]:
        raise HTTPException(400, "No se puede eliminar")
    db.run("DELETE FROM scans WHERE qr_id IN (SELECT id FROM qrs WHERE user_id=?)", uid)
    for table in ("qrs", "logos", "templates"):
        db.run(f"DELETE FROM {table} WHERE user_id=?", uid)
    db.run("DELETE FROM sessions WHERE user_id=?", uid)
    db.run("DELETE FROM users WHERE id=?", uid)
    return {"ok": True}


class SettingsIn(BaseModel):
    public_url: str = Field("", max_length=300)


@app.post("/api/admin/settings")
def admin_settings(b: SettingsIn, a=Depends(admin_user)):
    url = b.public_url.strip().rstrip("/")
    if url and not re.match(r"^https?://[^\s/]+(/[^\s]*)?$", url):
        raise HTTPException(400, "Escribe la dirección completa, por ejemplo https://qr.midominio.com")
    db.set_setting("public_url", url)
    return {"ok": True}


class BrandIn(BaseModel):
    name: str = Field("", max_length=40)
    logo: str | None = Field(None, max_length=MAX_LOGO)


@app.post("/api/admin/brand")
def admin_brand(b: BrandIn, a=Depends(admin_user)):
    """Nombre y logo propios de esta instalacion (cabecera, entrada y paginas compartidas)."""
    if b.logo and not LOGO_RE.match(b.logo):
        raise HTTPException(400, "La imagen no es válida (PNG, JPG, WebP, GIF o SVG)")
    db.set_setting("brand_name", b.name.strip())
    db.set_setting("brand_logo", b.logo or "")
    return {"ok": True, "brand": brand()}


# --- redireccion de los QR dinamicos ----------------------------------------------
def _ua_info(ua: str) -> tuple[str, str, str]:
    s = ua.lower()
    if "ipad" in s or "tablet" in s or ("android" in s and "mobile" not in s):
        device = "Tablet"
    elif "mobi" in s or "iphone" in s or "android" in s:
        device = "Móvil"
    elif "bot" in s or "spider" in s or "crawl" in s or "preview" in s:
        device = "Robot"
    else:
        device = "Ordenador"
    if "iphone" in s or "ipad" in s or "ios" in s:
        os_ = "iOS"
    elif "android" in s:
        os_ = "Android"
    elif "windows" in s:
        os_ = "Windows"
    elif "mac os" in s or "macintosh" in s:
        os_ = "macOS"
    elif "cros" in s:
        os_ = "ChromeOS"
    elif "linux" in s:
        os_ = "Linux"
    else:
        os_ = "Otro"
    if "edg/" in s:
        br = "Edge"
    elif "samsungbrowser" in s:
        br = "Samsung Internet"
    elif "opr/" in s or "opera" in s:
        br = "Opera"
    elif "firefox" in s or "fxios" in s:
        br = "Firefox"
    elif "crios" in s or "chrome" in s:
        br = "Chrome"
    elif "safari" in s:
        br = "Safari"
    else:
        br = "Otro"
    return device, os_, br


def _pin_page(code: str, name: str, error: str = "", status: int = 200) -> HTMLResponse:
    err = f'<p class="err">{escape(error)}</p>' if error else ""
    html = f"""<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>QR protegido</title><link rel="stylesheet" href="/static/redirect.css"></head><body><main>
<img src="/static/icons/icon.svg" alt="" width="64" height="64"><h1>Este QR tiene PIN</h1>
<p>Escribe el PIN que te han dado para continuar.</p>{err}
<form method="post" action="/r/{escape(code)}" autocomplete="off">
<input name="pin" type="password" inputmode="text" maxlength="32" required autofocus aria-label="PIN" placeholder="PIN">
<button type="submit">Abrir</button></form>
</main></body></html>"""
    return HTMLResponse(html, status_code=status, headers={"Cache-Control": "no-store", "X-Robots-Tag": "noindex"})


def _closed_page(title: str, text: str) -> HTMLResponse:
    html = f"""<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>{escape(title)}</title>
<link rel="stylesheet" href="/static/redirect.css"></head><body><main>
<img src="/static/icons/icon.svg" alt="" width="64" height="64"><h1>{escape(title)}</h1><p>{escape(text)}</p>
</main></body></html>"""
    return HTMLResponse(html, status_code=410, headers={"Cache-Control": "no-store"})


def _open(code: str):
    """Devuelve (fila, None) si el QR se puede abrir, o (None, pagina de aviso)."""
    r = db.q1("SELECT * FROM qrs WHERE code=? AND dynamic=1", code)
    if not r:
        return None, _closed_page("Este QR no existe", "Puede que lo hayan borrado. Pide uno nuevo a quien te lo dio.")
    if not r["active"]:
        return None, _closed_page("Este QR está en pausa", "Su dueño lo ha desactivado por ahora. Prueba más tarde.")
    if r["expires"] and time.time() > r["expires"]:
        return None, _closed_page("Este QR ha caducado", "Ya no lleva a ningún sitio.")
    if r["max_scans"] and r["scans"] >= r["max_scans"]:
        return None, _closed_page("Este QR ya no está disponible", "Ha llegado al número máximo de lecturas.")
    return r, None


@app.get("/r/{code}")
def go(code: str, request: Request):
    r, page = _open(code)
    if page:
        return page
    if r["pin"]:
        return _pin_page(code, r["name"])
    return _scan(r, request)


@app.post("/r/{code}")
async def go_pin(code: str, request: Request):
    r, page = _open(code)
    if page:
        return page
    if not r["pin"]:
        return _scan(r, request)
    ip = client_ip(request)
    wait = max(limits.pin_ip.blocked((ip, code)), limits.pin_qr.blocked(code))
    if wait:
        return _pin_page(code, r["name"], f"Demasiados intentos. Espera {max(1, wait // 60)} minutos.", 429)
    body = (await request.body())[:2000]
    pin = (parse_qs(body.decode("utf-8", "replace")).get("pin") or [""])[0].strip()
    if not pin or not db.check_pw(pin, r["pin"]):
        limits.pin_ip.hit((ip, code)); limits.pin_qr.hit(code)
        await asyncio.sleep(0.6)
        return _pin_page(code, r["name"], "PIN incorrecto. Vuelve a probar.", 403)
    limits.pin_ip.reset((ip, code))
    return _scan(r, request, 303)


def _scan(r, request: Request, status: int = 302):
    now = time.time()
    ua = request.headers.get("user-agent", "")[:400]
    device, os_, br = _ua_info(ua)
    day = time.strftime("%Y-%m-%d", time.localtime(now))
    visitor = hashlib.sha256(f"{client_ip(request)}|{ua}|{day}".encode()).hexdigest()[:16]
    db.run("INSERT INTO scans(qr_id,at,day,device,os,browser,visitor) VALUES(?,?,?,?,?,?,?)",
           r["id"], now, day, device, os_, br, visitor)
    db.run("UPDATE qrs SET scans=scans+1, last_scan=? WHERE id=?", now, r["id"])
    return RedirectResponse(r["target"], status_code=status, headers={"Cache-Control": "no-store"})


# --- web ------------------------------------------------------------------------
@app.api_route("/", methods=["GET", "HEAD"])
def index():
    return FileResponse(STATIC / "index.html", headers={"Cache-Control": "no-cache"})


@app.get("/sw.js")
def service_worker():
    return FileResponse(STATIC / "sw.js", media_type="text/javascript",
                        headers={"Cache-Control": "no-cache", "Service-Worker-Allowed": "/"})


@app.get("/manifest.webmanifest")
def manifest():
    return FileResponse(STATIC / "manifest.webmanifest", media_type="application/manifest+json")


app.mount("/static", StaticFiles(directory=STATIC), name="static")
