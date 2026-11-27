import asyncio, hashlib, json, re, secrets, time
from contextlib import asynccontextmanager
from html import escape
from pathlib import Path
from urllib.parse import parse_qs, quote

from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.responses import FileResponse, JSONResponse, HTMLResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import db, limits, i18n
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


@app.middleware("http")
async def _public_lang(request: Request, call_next):
    """Las páginas públicas (/r/... y /s/...) salen en inglés si toca."""
    r = await call_next(request)
    path = request.url.path
    if not (path.startswith("/r/") or path.startswith("/s/")) or not r.headers.get("content-type", "").startswith("text/html"):
        return r
    owner = None
    parts = path.split("/")
    if len(parts) > 2 and parts[1] == "r":
        row = db.q1("SELECT u.lang FROM qrs q JOIN users u ON u.id=q.user_id WHERE q.code=?", parts[2])
        owner = row["lang"] if row else None
    lang = i18n.pick(request.query_params.get("lang"), request.cookies.get("qp_lang"), request.headers.get("accept-language"), owner)
    if lang == "es":
        return r
    body = b"".join([c async for c in r.body_iterator])
    html = i18n.localize(body.decode("utf-8", "replace"), lang)
    headers = {k: v for k, v in r.headers.items() if k.lower() not in ("content-length", "content-type")}
    return HTMLResponse(html, status_code=r.status_code, headers=headers)


# --- autenticacion -------------------------------------------------------------
def current_user(request: Request):
    u = db.session_user(request.cookies.get(COOKIE, ""))
    if not u:
        raise HTTPException(401, "Inicia sesión")
    lang = request.cookies.get("qp_lang")
    if lang in ("es", "en") and u["lang"] != lang:  # sus páginas públicas salen por defecto en su idioma
        db.run("UPDATE users SET lang=? WHERE id=?", lang, u["id"])
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
    code = db.new_recovery(db.q1("SELECT id FROM users WHERE username=?", name)["id"])
    if first:
        return {"ok": True, "first": True, "recovery_code": code, "msg": "Cuenta de administrador creada. Ya puedes entrar."}
    return {"ok": True, "recovery_code": code, "msg": "Cuenta creada. El administrador tiene que aprobarla antes de entrar."}


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
    # si ya habia otra cuenta abierta en este dispositivo, se queda guardada para cambiar rapido
    cur_tok = request.cookies.get(COOKIE, "")
    cur = db.session_user(cur_tok)
    keep = [cur_tok] if cur and cur["id"] != u["id"] else []
    if cur and cur["id"] == u["id"]:
        db.run("DELETE FROM sessions WHERE token=?", cur_tok)
    tok = db.new_session(u["id"])
    # las cuentas de antes no tenian codigo de recuperacion: se les da uno al entrar (se ve una vez)
    out = {"ok": True}
    if not u["recovery"]:
        out["recovery_code"] = db.new_recovery(u["id"])
    r = JSONResponse(out)
    r.set_cookie(COOKIE, tok, max_age=30 * 86400, httponly=True, samesite="lax")
    _save_accounts(r, request, keep + _accounts(request), u["id"])
    return r


class LogoutReq(BaseModel):
    all: bool = False


@app.post("/api/logout")
def logout(request: Request, b: LogoutReq | None = None):
    db.run("DELETE FROM sessions WHERE token=?", request.cookies.get(COOKIE, ""))
    r = JSONResponse({"ok": True})
    r.delete_cookie(COOKIE)
    if b and b.all:  # salir de todas las cuentas de este dispositivo
        for t in _accounts(request):
            db.run("DELETE FROM sessions WHERE token=?", t)
        r.delete_cookie(ACCOUNTS)
    return r


# --- cambio rapido de usuario ----------------------------------------------------
# Como en Google: las cuentas que se han abierto en este dispositivo se recuerdan
# (cada una con su propia sesion, guardada en una cookie que el JavaScript no puede leer)
# y se puede pasar de una a otra sin volver a poner la contrasena. Para entrar en
# una cuenta nueva siempre hace falta su contrasena. "Quitar" cierra esa sesion.
ACCOUNTS = "qp_accounts"
MAX_ACCOUNTS = 6


def _accounts(request: Request) -> list[str]:
    return [t for t in request.cookies.get(ACCOUNTS, "").split(".") if t][:MAX_ACCOUNTS * 2]


def _clean_accounts(toks: list[str], current_uid: int | None) -> list[tuple[str, object]]:
    """Quita sesiones caducadas, bloqueadas o repetidas (y las borra si sobran)."""
    out, seen = [], {current_uid}
    for t in dict.fromkeys(toks):
        u = db.session_user(t)
        if not u:
            continue
        if u["id"] in seen or len(out) >= MAX_ACCOUNTS:
            db.run("DELETE FROM sessions WHERE token=?", t)
            continue
        seen.add(u["id"])
        out.append((t, u))
    return out


def _save_accounts(r, request: Request, toks: list[str], current_uid: int | None):
    good = [t for t, _ in _clean_accounts(toks, current_uid)]
    if good:
        r.set_cookie(ACCOUNTS, ".".join(good), max_age=30 * 86400, httponly=True, samesite="lax")
    elif request.cookies.get(ACCOUNTS):
        r.delete_cookie(ACCOUNTS)


@app.get("/api/accounts")
def accounts_list(request: Request):
    """Cuentas recordadas en este dispositivo (sin contar la que esta abierta)."""
    cur = db.session_user(request.cookies.get(COOKIE, ""))
    toks = _accounts(request)
    found = _clean_accounts(toks, cur["id"] if cur else None)
    r = JSONResponse({"current": cur["username"] if cur else None,
                      "accounts": [{"username": u["username"], "avatar": u["avatar"]}
                                   for _, u in found]})
    if [t for t, _ in found] != toks:
        _save_accounts(r, request, toks, cur["id"] if cur else None)
    return r


class AccountReq(BaseModel):
    username: str


@app.post("/api/accounts/switch")
def accounts_switch(b: AccountReq, request: Request):
    cur_tok = request.cookies.get(COOKIE, "")
    cur = db.session_user(cur_tok)
    toks = _accounts(request)
    found = _clean_accounts(toks, cur["id"] if cur else None)
    target = next((t for t, u in found if u["username"] == b.username), None)
    if not target:
        raise HTTPException(400, "Esa cuenta ya no tiene la sesión abierta aquí. Entra con su contraseña")
    rest = ([cur_tok] if cur else []) + [t for t, _ in found if t != target]
    r = JSONResponse({"ok": True})
    r.set_cookie(COOKIE, target, max_age=30 * 86400, httponly=True, samesite="lax")
    _save_accounts(r, request, rest, db.session_user(target)["id"])
    return r


@app.post("/api/accounts/forget")
def accounts_forget(b: AccountReq, request: Request):
    """Quita una cuenta de la lista de este dispositivo (y cierra su sesion)."""
    cur = db.session_user(request.cookies.get(COOKIE, ""))
    toks = _accounts(request)
    rest = []
    for t, u in _clean_accounts(toks, cur["id"] if cur else None):
        if u["username"] == b.username:
            db.run("DELETE FROM sessions WHERE token=?", t)
        else:
            rest.append(t)
    r = JSONResponse({"ok": True})
    _save_accounts(r, request, rest, cur["id"] if cur else None)
    return r


# --- he olvidado mi usuario o mi contrasena ---------------------------------------
class RecoverReq(BaseModel):
    username: str = Field("", max_length=64)  # opcional: si no se recuerda, basta con el codigo
    code: str = Field(max_length=64)
    password: str = Field(max_length=256)


@app.post("/api/recover")
async def recover(b: RecoverReq, request: Request):
    """Con el codigo de recuperacion: dice el usuario, pone la contrasena nueva y da otro codigo."""
    ip = client_ip(request)
    wait = limits.recover.blocked(ip)
    if wait:
        raise HTTPException(429, f"Demasiados intentos fallidos. Espera {max(1, wait // 60)} min y vuelve a probar")
    if len(b.password) < 6:
        raise HTTPException(400, "La contraseña debe tener al menos 6 caracteres")
    u = db.user_by_recovery(b.code)
    name = b.username.strip()
    if not u or (name and name.lower() != u["username"].lower()):
        limits.recover.hit(ip)
        await asyncio.sleep(0.7)
        raise HTTPException(400, "El código de recuperación no es correcto")
    limits.recover.reset(ip)
    db.run("UPDATE users SET pw_hash=? WHERE id=?", db.hash_pw(b.password), u["id"])
    db.run("DELETE FROM sessions WHERE user_id=?", u["id"])  # fuera de todas partes
    limits.login_ok(ip, u["username"])
    return {"ok": True, "username": u["username"], "status": u["status"],
            "recovery_code": db.new_recovery(u["id"])}


class RecoveryNew(BaseModel):
    password: str = Field(max_length=256)


@app.post("/api/recovery")
def recovery_new(b: RecoveryNew, u=Depends(current_user)):
    """Codigo de recuperacion nuevo (en «Código de recuperación»); el anterior deja de valer."""
    if not db.check_pw(b.password, u["pw_hash"]):
        raise HTTPException(400, "La contraseña actual no es correcta")
    return {"ok": True, "recovery_code": db.new_recovery(u["id"])}


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
            "public_url_custom": db.setting("public_url") or PUBLIC_URL, "brand": brand(),
            "avatar": u["avatar"], "has_recovery": bool(u["recovery"])}


@app.get("/api/novedades")
def novedades(lang: str = "es", u=Depends(current_user)):
    """Lista de cambios de la web (app/NOVEDADES.md o NOVEDADES.en.md), para el aviso que sale
    una vez después de actualizar y para «Novedades» en el menú de usuario."""
    out, cur = [], None
    f = Path(__file__).parent / ("NOVEDADES.en.md" if lang == "en" else "NOVEDADES.md")
    try:
        lines = f.read_text(encoding="utf-8").splitlines()
    except OSError:
        lines = []
    for line in lines:
        if line.startswith("## "):
            cur = {"version": line[3:].strip(), "items": []}
            out.append(cur)
        elif cur is not None and line.startswith("- "):
            cur["items"].append(line[2:].strip())
        elif cur is not None and line.startswith("  ") and cur["items"]:
            cur["items"][-1] += " " + line.strip()
    return {"version": VERSION, "novedades": out}


class AvatarIn(BaseModel):
    data: str | None = Field(None, max_length=300_000)


@app.put("/api/me/avatar")
def set_avatar(b: AvatarIn, u=Depends(current_user)):
    """Foto de perfil o logo de la marca del usuario (data URL pequeña). null la quita."""
    d = (b.data or "").strip() or None
    if d and not PHOTO_RE.match(d):
        raise HTTPException(400, "Tiene que ser una imagen PNG, JPG o WebP")
    db.run("UPDATE users SET avatar=? WHERE id=?", d, u["id"])
    return {"avatar": d}


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


PHOTO_RE = re.compile(r"^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$")
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


PAGE_KINDS = ("pet", "menu", "hotel", "office", "shop", "eventpage", "home")  # tipos cuya página pinta el servidor


def _check(b: QRIn, qid: int | None = None) -> tuple[str | None, str | None]:
    blob = json.dumps(b.design) + json.dumps(b.fields)
    if len(blob) > MAX_JSON:
        raise HTTPException(413, "El diseño es demasiado grande")
    for k in ("photo", "logo"):  # fotos de la ficha de mascota y logo de la carta
        img = b.fields.get(k) or ""
        if b.kind in PAGE_KINDS and img and not (PHOTO_RE.match(img) and len(img) <= 400_000):
            b.fields[k] = ""
    if not b.dynamic:
        return None, None
    target = (b.target or "").strip()
    if b.kind in PAGE_KINDS:
        target = b.kind + ":"  # la ficha / la carta la pinta el servidor en /r/{code}
    elif not TARGET_RE.match(target):
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
    db.run("DELETE FROM share_images WHERE qr_id=?", qid)
    db.run("DELETE FROM qrs WHERE id=?", qid)
    return {"ok": True}


# --- compartir con un enlace publico -----------------------------------------------
@app.post("/api/qrs/{qid}/share")
def share_on(qid: int, request: Request, u=Depends(current_user)):
    r = _own(qid, u)
    if not r["share"]:
        db.run("UPDATE qrs SET share=? WHERE id=?", secrets.token_urlsafe(12), qid)
    return _row(db.q1("SELECT * FROM qrs WHERE id=?", qid), public_base(request))


MAX_SHARE_PNG = 900_000


@app.put("/api/qrs/{qid}/image")
async def share_image(qid: int, request: Request, u=Depends(current_user)):
    """Imagen PNG del QR, para que el enlace compartido salga con su foto en WhatsApp/Telegram."""
    _own(qid, u)
    data = await request.body()
    if len(data) > MAX_SHARE_PNG:
        raise HTTPException(413, "La imagen es demasiado grande")
    if not (data.startswith(b"\x89PNG\r\n\x1a\n") or data.startswith(b"\xff\xd8\xff")):
        raise HTTPException(400, "Tiene que ser una imagen PNG o JPG")
    db.run("INSERT INTO share_images(qr_id,png,updated) VALUES(?,?,?) "
           "ON CONFLICT(qr_id) DO UPDATE SET png=excluded.png, updated=excluded.updated", qid, data, time.time())
    return {"ok": True}


@app.delete("/api/qrs/{qid}/share")
def share_off(qid: int, request: Request, u=Depends(current_user)):
    _own(qid, u)
    db.run("UPDATE qrs SET share=NULL WHERE id=?", qid)
    return _row(db.q1("SELECT * FROM qrs WHERE id=?", qid), public_base(request))


@app.get("/api/share/{token}")
def share_get(token: str):
    r = db.q1("SELECT q.*, u.username, u.avatar FROM qrs q JOIN users u ON u.id=q.user_id WHERE q.share=?", token)
    if not r or len(token) < 10:
        raise HTTPException(404, "Este enlace ya no existe")
    design = json.loads(r["design"] or "{}")
    logo = design.get("logo") or {}
    if logo.get("id") is not None:  # el logo va dentro para que se vea igual
        lg = db.q1("SELECT data FROM logos WHERE id=? AND user_id=?", logo["id"], r["user_id"])
        logo["src"], logo["id"] = (lg["data"] if lg else None), None
    return {"name": r["name"], "kind": r["kind"], "content": r["content"], "design": design,
            "owner": r["username"], "owner_avatar": r["avatar"], "dynamic": bool(r["dynamic"]), "updated": r["updated"], "brand": brand()}


def _img_response(qid: int | None):
    img = db.q1("SELECT png, updated FROM share_images WHERE qr_id=?", qid) if qid else None
    if not img:
        return FileResponse(STATIC / "icons" / "og.jpg", media_type="image/jpeg")
    mime = "image/jpeg" if img["png"][:3] == b"\xff\xd8\xff" else "image/png"
    return Response(img["png"], media_type=mime, headers={"Cache-Control": "public, max-age=300"})


@app.get("/s/{token}/qr.png")
def share_png(token: str):
    r = db.q1("SELECT q.id FROM qrs q WHERE q.share=?", token) if len(token) >= 10 else None
    return _img_response(r["id"] if r else None)


def _og(title: str, desc: str, url: str, img: str, w: int = 1200, h: int = 630) -> str:
    """Etiquetas para la vista previa al pegar el enlace en WhatsApp, Telegram, correo..."""
    t, d = escape(title), escape(desc)
    sec = f'<meta property="og:image:secure_url" content="{img}">' if img.startswith("https://") else ""
    return (f'<meta property="og:type" content="website"><meta property="og:site_name" content="{escape(brand()["name"])}">'
            f'<meta property="og:title" content="{t}"><meta property="og:description" content="{d}">'
            f'<meta name="description" content="{d}">'
            f'<meta property="og:image" content="{img}">{sec}'
            f'<meta property="og:image:width" content="{w}"><meta property="og:image:height" content="{h}">'
            f'<meta property="og:image:alt" content="{t}"><meta property="og:url" content="{url}">'
            f'<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="{img}">')


def _card_v(qid: int) -> int:
    """Cambia cada vez que se sube una imagen nueva, para que WhatsApp no use la vieja."""
    c = db.q1("SELECT updated FROM share_images WHERE qr_id=?", qid)
    return int(c["updated"]) if c else 0


@app.get("/s/{token}")
def share_page(token: str, request: Request):
    html = (STATIC / "share.html").read_text(encoding="utf-8")
    r = db.q1("SELECT q.id, q.name, q.updated FROM qrs q WHERE q.share=?", token) if len(token) >= 10 else None
    if r:
        # vista previa al pegar el enlace en WhatsApp, Telegram, correo...
        base = public_base(request)
        name = escape(r["name"] or "Código QR")
        img = f"{base}/s/{escape(token)}/qr.png?v={_card_v(r['id'])}"
        meta = _og(r["name"] or "Código QR", "Código QR compartido. Ábrelo para verlo y descargarlo en PNG, SVG o PDF.",
                   f"{base}/s/{escape(token)}", img)
        html = html.replace("<title>Código QR compartido · QRPanel</title>", f"<title>{name} · Código QR</title>{meta}", 1)
    return HTMLResponse(html, headers={"Cache-Control": "no-cache"})


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
        "tables": _group("SELECT tag k, COUNT(*) n FROM scans WHERE qr_id=? AND tag IS NOT NULL "
                         "GROUP BY tag ORDER BY n DESC LIMIT 60", qid),
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
        "SELECT u.id, u.username, u.is_admin, u.status, u.created, u.avatar, "
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
    # el administrador le pasa el codigo a la persona junto con su contrasena
    return {"ok": True, "recovery_code": db.new_recovery(db.q1("SELECT id FROM users WHERE username=?", name)["id"])}


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


def _tel(p: str) -> str:
    return re.sub(r"[^0-9+]", "", p or "")[:20]


def _pet_page(r) -> HTMLResponse:
    f = json.loads(r["fields"] or "{}")
    e = lambda k: escape(str(f.get(k) or "").strip())
    name = e("name") or "Mascota"
    species = {"perro": "Perro", "gato": "Gato", "conejo": "Conejo", "pajaro": "Pájaro", "hamster": "Hámster", "tortuga": "Tortuga", "caballo": "Caballo", "huron": "Hurón"}.get(f.get("species") or "perro", "")
    phone, phone2 = _tel(f.get("phone")), _tel(f.get("phone2"))
    wa = re.sub(r"[^0-9]", "", phone)
    found = quote(f"¡Hola! He encontrado a {f.get('name') or 'tu mascota'} gracias a su QR.")
    photo = f.get("photo") or ""
    photo_html = (f'<img class="photo" src="{escape(photo)}" alt="Foto de {name}">' if PHOTO_RE.match(photo)
                  else '<div class="photo none">🐾</div>')
    f["sex"] = {"macho": "Macho", "hembra": "Hembra"}.get(f.get("sex"), "")
    rows = [(lbl, e(k)) for k, lbl in (("breed", "Raza"), ("color", "Color / señas"), ("sex", "Sexo"), ("age", "Edad"),
                                         ("chip", "Microchip"), ("vet", "Veterinario"), ("zone", "Vive en"))]
    info = "".join(f"<dt>{lbl}</dt><dd>{v}</dd>" for lbl, v in rows if v)
    blocks = ""
    if f.get("health"):
        blocks += f'<section class="health"><h2>⚕️ Salud</h2><p>{e("health")}</p></section>'
    if f.get("notes"):
        blocks += f'<section><h2>Cómo es</h2><p>{e("notes")}</p></section>'
    btns = ""
    if phone:
        btns += f'<a class="b call" href="tel:{escape(phone)}">📞 Llamar a {e("owner") or "su familia"}</a>'
    if wa:
        btns += f'<a class="b wa" href="https://wa.me/{wa}?text={found}">💬 Mandar un WhatsApp</a>'
        btns += f'<button class="b loc" type="button" id="loc" data-wa="{wa}" data-name="{name}">📍 Enviar dónde estoy</button>'
    if phone2:
        btns += f'<a class="b alt" href="tel:{escape(phone2)}">📞 Otro teléfono</a>'
    if f.get("email"):
        btns += f'<a class="b alt" href="mailto:{e("email")}?subject={found}">✉️ Mandar un email</a>'
    lost = f'<div class="lost">¡Me he perdido! Ayúdame a volver a casa</div>' if f.get("lost") else ""
    reward = f'<div class="reward">🎁 {e("reward")}</div>' if f.get("reward") else ""
    html = f"""<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>{name} · ¿Me has encontrado?</title><link rel="stylesheet" href="/static/pet.css?v=2"></head><body>
<main>{lost}{photo_html}<h1>Hola, soy {name}</h1><p class="sub">{species}{" · " if species and f.get("breed") else ""}{e("breed")}</p>
<p class="lead">Si me has encontrado, por favor avisa a mi familia. ¡Gracias!</p>{reward}
<div class="btns">{btns}</div>{f'<dl>{info}</dl>' if info else ""}{blocks}
<p class="foot">Ficha hecha con QRPanel</p></main>
<script src="/static/js/pet.js?v=3"></script></body></html>"""
    return HTMLResponse(html, headers={"Cache-Control": "no-store", "X-Robots-Tag": "noindex"})


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


# Los robots que leen un enlace para hacer la vista previa (WhatsApp, Telegram...). No cuentan
# como lectura (ni gastan las lecturas de un QR que caduca) y reciben una pagina con la imagen.
PREVIEW_BOT = re.compile(r"whatsapp|telegrambot|facebookexternalhit|facebot|meta-externalagent|twitterbot|slackbot|"
                         r"discordbot|linkedinbot|skypeuripreview|redditbot|pinterest|embedly|vkshare|viber|"
                         r"mattermost|rocket\.chat|signal|bitlybot|iframely|google-pagerenderer|applebot", re.I)


def _preview(r, request: Request) -> HTMLResponse:
    base = public_base(request)
    url = f"{base}/r/{escape(r['code'])}"
    v = _card_v(r["id"])
    if r["pin"]:
        title, desc = "Código QR protegido", "Hace falta un PIN para abrirlo."
    elif r["kind"] == "menu":
        f = json.loads(r["fields"] or "{}")
        title = f"{(f.get('name') or 'Nuestra carta').strip()} · Carta"
        t = _table(request)
        desc = f"Mesa {t}. Abre el enlace para ver la carta." if t else "Abre el enlace para ver la carta, el horario y cómo llegar."
    elif r["kind"] in ("hotel", "office"):
        f = json.loads(r["fields"] or "{}")
        title = (f.get("name") or ("Bienvenido" if r["kind"] == "hotel" else "Recepción")).strip()
        t = _table(request)
        desc = (f"Habitación {t}. " if t and r["kind"] == "hotel" else "") + (
            "WiFi, horarios, servicios y contacto con recepción." if r["kind"] == "hotel" else "Cómo llegar, horario, contactos y aviso de llegada.")
    elif r["kind"] in ("shop", "eventpage", "home"):
        f = json.loads(r["fields"] or "{}")
        title = (f.get("name") or "").strip() or {"shop": "Producto", "eventpage": "Evento", "home": "Inmueble"}[r["kind"]]
        if r["kind"] == "shop":
            pr = _euro(f.get("offer") or f.get("price"))
            desc = (f"{pr} · " if pr else "") + (str(f.get("brand") or "").strip() or "Abre el enlace para ver la ficha del producto.")
        elif r["kind"] == "eventpage":
            desc = " · ".join(x for x in (_when(f.get("start")), str(f.get("venue") or "").strip()) if x) or "Abre el enlace para ver el programa."
        else:
            bits = [OPS.get(f.get("op") or "venta", ""), _euro(f.get("price")), f.get("m2") and f"{f['m2']} m²", f.get("rooms") and f"{f['rooms']} hab.", f.get("address")]
            desc = " · ".join(str(b).strip() for b in bits if b)
    elif r["kind"] == "pet":
        f = json.loads(r["fields"] or "{}")
        nm = (f.get("name") or "").strip()
        title = f"Hola, soy {nm}" if nm else "Placa de mascota"
        desc = "¡Me he perdido! Abre el enlace para avisar a mi familia." if f.get("lost") else "Si me encuentras, abre el enlace para avisar a mi familia."
    else:
        title, desc = r["name"] or "Código QR", "Abre el enlace para ir a su destino."
    img = f"{url}/qr.png?v={v}"
    head = f'<!doctype html><html lang="es"><head><meta charset="utf-8"><title>{escape(title)}</title>{_og(title, desc, url, img)}</head>'
    return HTMLResponse(head + f'<body><a href="{url}">{escape(title)}</a></body></html>', headers={"Cache-Control": "no-store"})


@app.get("/r/{code}/qr.png")
def go_png(code: str):
    r = db.q1("SELECT id FROM qrs WHERE code=? AND dynamic=1", code)
    return _img_response(r["id"] if r else None)


@app.get("/r/{code}")
def go(code: str, request: Request):
    r, page = _open(code)
    if page:
        return page
    if PREVIEW_BOT.search(request.headers.get("user-agent", "")):
        return _preview(r, request)
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


TAG_RE = re.compile(r"^[A-Za-z0-9 _.-]{1,16}$")


def _table(request: Request) -> str | None:
    """La mesa (u otra etiqueta) que lleva el QR en ?m=, por ejemplo /r/carta?m=5."""
    t = (request.query_params.get("m") or "").strip()
    return t if TAG_RE.match(t) else None


ALLERGENS = [  # (palabras con las que se reconoce, emoji, nombre)
    (("gluten", "trigo"), "🌾", "Gluten"), (("crustaceo", "crustáceo", "marisco"), "🦐", "Crustáceos"),
    (("huevo",), "🥚", "Huevo"), (("pescado",), "🐟", "Pescado"), (("cacahuete", "maní"), "🥜", "Cacahuetes"),
    (("soja",), "🫘", "Soja"), (("leche", "lact", "lácte"), "🥛", "Lácteos"),
    (("frutos secos", "fruto seco", "cáscara", "cascara", "nuez", "almendra", "avellana"), "🌰", "Frutos secos"),
    (("apio",), "🥬", "Apio"), (("mostaza",), "🟡", "Mostaza"), (("sésamo", "sesamo"), "⚪", "Sésamo"),
    (("sulfito",), "🍷", "Sulfitos"), (("altramuz",), "🌼", "Altramuces"), (("molusco",), "🦪", "Moluscos"),
    (("vegano", "vegana"), "🌱", "Vegano"), (("vegetariano", "vegetariana"), "🥕", "Vegetariano"),
    (("picante",), "🌶️", "Picante"), (("sin gluten",), "✅", "Sin gluten"),
]


def _allergen(word: str) -> str:
    w = word.strip().lower()
    if not w:
        return ""
    if "sin gluten" in w:
        return '<span class="al ok">✅ Sin gluten</span>'
    for keys, emo, name in ALLERGENS:
        if any(k in w for k in keys):
            return f'<span class="al">{emo} {escape(name)}</span>'
    return f'<span class="al">{escape(word.strip())}</span>'


def _parse_menu(text: str) -> list[dict]:
    """Carta escrita así:  «# Sección», «Plato | precio | alérgenos» y, debajo, su descripción."""
    secs: list[dict] = []
    for raw in (text or "").splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith("#"):
            secs.append({"name": line.lstrip("#").strip(), "items": []})
            continue
        if not secs:
            secs.append({"name": "", "items": []})
        if "|" in line or not secs[-1]["items"]:
            parts = [p.strip() for p in line.lstrip("-•*").split("|")]
            secs[-1]["items"].append({"name": parts[0], "price": parts[1] if len(parts) > 1 else "",
                                      "al": [a for a in re.split(r"[,;/]", parts[2]) if a.strip()] if len(parts) > 2 else [],
                                      "desc": ""})
        else:
            it = secs[-1]["items"][-1]
            it["desc"] = (it["desc"] + " " + line).strip()
    return [s for s in secs if s["items"] or s["name"]]


def _menu_page(r, table: str | None = None) -> HTMLResponse:
    f = json.loads(r["fields"] or "{}")
    e = lambda k: escape(str(f.get(k) or "").strip())
    name = e("name") or "Nuestra carta"
    logo = f.get("logo") or ""
    logo_html = f'<img class="logo" src="{escape(logo)}" alt="">' if PHOTO_RE.match(logo) else ""
    secs = _parse_menu(f.get("carta") or "")
    nav = "".join(f'<a href="#s{i}">{escape(s["name"])}</a>' for i, s in enumerate(secs) if s["name"])
    body = ""
    for i, s in enumerate(secs):
        items = ""
        for it in s["items"]:
            price = escape(it["price"])
            if price and re.fullmatch(r"[\d.,]+", price):
                price += " €"
            al = "".join(_allergen(a) for a in it["al"])
            items += (f'<li><div class="it"><b>{escape(it["name"])}</b><i></i><span class="pr">{price}</span></div>'
                      f'{f"<p>{escape(it[chr(100) + chr(101) + chr(115) + chr(99)])}</p>" if it["desc"] else ""}'
                      f'{f"<div class=als>{al}</div>" if al else ""}</li>')
        body += f'<section id="s{i}">{f"<h2>{escape(s[chr(110) + chr(97) + chr(109) + chr(101)])}</h2>" if s["name"] else ""}<ul>{items}</ul></section>'
    if not body:
        body = '<p class="empty">La carta estará aquí muy pronto.</p>'
    phone = _tel(f.get("phone"))
    btns = ""
    if phone:
        btns += f'<a class="b" href="tel:{escape(phone)}">📞 Llamar</a>'
    if f.get("address"):
        btns += f'<a class="b" href="https://maps.google.com/?q={quote(str(f["address"]))}" target="_blank" rel="noopener">📍 Cómo llegar</a>'
    ig = str(f.get("instagram") or "").strip().lstrip("@")
    if ig:
        url = ig if ig.startswith("http") else f"https://instagram.com/{quote(ig)}"
        btns += f'<a class="b" href="{escape(url)}" target="_blank" rel="noopener">📸 Instagram</a>'
    web = str(f.get("web") or "").strip()
    if web:
        url = web if re.match(r"^https?://", web) else "https://" + web
        btns += f'<a class="b" href="{escape(url)}" target="_blank" rel="noopener">🌐 Web</a>'
    info = ""
    if f.get("hours"):
        info += f'<section class="box"><h2>🕒 Horario</h2><p>{e("hours")}</p></section>'
    if f.get("wifi_ssid"):
        pw = e("wifi_pass")
        info += (f'<section class="box"><h2>📶 WiFi</h2><p>Red: <b>{e("wifi_ssid")}</b>'
                 f'{f"<br>Contraseña: <b class=pw>{pw}</b> <button type=button class=copy data-copy=" + chr(34) + pw + chr(34) + ">Copiar</button>" if pw else ""}</p></section>')
    if f.get("address"):
        info += f'<section class="box"><h2>📍 Dónde estamos</h2><p>{e("address")}</p></section>'
    note = f'<p class="note">{e("notes")}</p>' if f.get("notes") else ""
    mesa = f'<div class="mesa">🍽️ Estás en la <b>mesa {escape(table)}</b></div>' if table else ""
    html = f"""<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{name} · Carta</title><link rel="stylesheet" href="/static/menu.css?v=3"></head><body>
<header>{logo_html}<h1>{name}</h1>{f'<p class="tag">{e("tagline")}</p>' if f.get("tagline") else ""}{mesa}
{f'<div class="btns">{btns}</div>' if btns else ""}</header>
{f'<nav>{nav}</nav>' if nav else ""}
<main>{body}{note}{info}<p class="foot">Carta hecha con QRPanel</p></main>
<script src="/static/js/place.js?v=3"></script>
</body></html>"""
    return HTMLResponse(html, headers={"Cache-Control": "no-store"})


def _link_bits(text: str) -> str:
    """Un trozo de contacto: los teléfonos y emails se pueden pulsar."""
    t = text.strip()
    if re.fullmatch(r"[\w.+-]+@[\w-]+(\.[\w-]+)+", t):
        return f'<a href="mailto:{escape(t)}">{escape(t)}</a>'
    if re.fullmatch(r"\+?[\d ()-]{6,20}", t):
        return f'<a href="tel:{escape(_tel(t))}">{escape(t)}</a>'
    return escape(t)


def _place_page(r, tag: str | None = None) -> HTMLResponse:
    """Página de bienvenida de un hotel o de la recepción de una oficina."""
    kind = r["kind"]
    hotel = kind == "hotel"
    f = json.loads(r["fields"] or "{}")
    e = lambda k: escape(str(f.get(k) or "").strip())
    name = e("name") or ("Bienvenido" if hotel else "Recepción")
    logo = f.get("logo") or ""
    logo_html = f'<img class="logo" src="{escape(logo)}" alt="">' if PHOTO_RE.match(logo) else ""
    phone, wa = _tel(f.get("phone")), _tel(f.get("whatsapp"))
    btns = ""
    if phone:
        btns += f'<a class="b" href="tel:{escape(phone)}">📞 {"Recepción" if hotel else "Llamar"}</a>'
    if wa:
        btns += f'<a class="b" href="https://wa.me/{escape(wa.lstrip("+"))}" target="_blank" rel="noopener">💬 WhatsApp</a>'
    if f.get("address"):
        btns += f'<a class="b" href="https://maps.google.com/?q={quote(str(f["address"]))}" target="_blank" rel="noopener">📍 Cómo llegar</a>'
    web = str(f.get("web") or "").strip()
    if web:
        url = web if re.match(r"^https?://", web) else "https://" + web
        btns += f'<a class="b" href="{escape(url)}" target="_blank" rel="noopener">🌐 Web</a>'
    box = lambda title, html: f'<section class="box"><h2>{title}</h2>{html}</section>'
    out = ""
    if f.get("wifi_ssid"):
        pw = e("wifi_pass")
        out += box("📶 WiFi", f'<p>Red: <b>{e("wifi_ssid")}</b>' + (
            f'<br>Contraseña: <b class="pw">{pw}</b> <button type="button" class="copy" data-copy="{pw}">Copiar</button>' if pw else "") + "</p>")
    if hotel:
        times = "".join(f'<div><span>{lab}</span><b>{e(k)}</b></div>' for k, lab in
                        (("checkin", "Entrada"), ("checkout", "Salida"), ("breakfast", "Desayuno")) if f.get(k))
        if times:
            out += box("🕒 Horarios", f'<div class="kv">{times}</div>')
        for i, sec in enumerate(_parse_menu(f.get("services") or "")):
            items = "".join(f'<li><div class="it"><b>{escape(it["name"])}</b><i></i><span class="pr">{escape(it["price"])}</span></div>'
                            + (f'<p>{escape(it["desc"])}</p>' if it["desc"] else "") + "</li>" for it in sec["items"])
            out += f'<section><h2>{escape(sec["name"] or "Servicios")}</h2><ul>{items}</ul></section>'
        if f.get("rules"):
            out += box("📋 Normas de la casa", f'<p>{e("rules")}</p>')
    else:
        if f.get("how"):
            out += box("🧭 Cómo llegar", f'<p>{e("how")}</p>')
        if f.get("hours"):
            out += box("🕒 Horario", f'<p>{e("hours")}</p>')
        mode = f.get("checkin", "both")
        mail = str(f.get("email") or "").strip()
        can_wa = wa and mode in ("whatsapp", "both")
        can_mail = re.fullmatch(r"[\w.+-]+@[\w-]+(\.[\w-]+)+", mail) and mode in ("email", "both")
        if can_wa or can_mail:
            out += box("👋 Avisa de que has llegado", f"""<form class="visit" data-wa="{escape(wa.lstrip('+')) if can_wa else ''}" data-mail="{escape(mail) if can_mail else ''}" data-place="{name}" data-tag="{escape(tag or '')}">
<input name="who" maxlength="60" placeholder="Tu nombre" required autocomplete="name">
<input name="org" maxlength="60" placeholder="Empresa (opcional)" autocomplete="organization">
<input name="see" maxlength="60" placeholder="¿A quién vienes a ver?">
<div class="row">{'<button type="submit" name="via" value="wa">💬 Avisar por WhatsApp</button>' if can_wa else ''}{'<button type="submit" name="via" value="mail">✉️ Avisar por email</button>' if can_mail else ''}</div>
<p class="hint">Se abre tu WhatsApp o tu correo con el mensaje ya escrito: solo tienes que enviarlo.</p></form>""")
        rows = ""
        for line in str(f.get("contacts") or "").splitlines():
            parts = [p for p in (x.strip() for x in line.split("|")) if p]
            if parts:
                rows += f'<li><div class="it"><b>{escape(parts[0])}</b></div>' + (
                    f'<p>{" · ".join(_link_bits(p) for p in parts[1:])}</p>' if len(parts) > 1 else "") + "</li>"
        if rows:
            out += f'<section><h2>Contactos</h2><ul>{rows}</ul></section>'
    if f.get("address"):
        out += box("📍 Dirección", f'<p>{e("address")}</p>')
    note = f'<p class="note">{e("notes")}</p>' if f.get("notes") else ""
    where = ""
    if tag:
        where = f'<div class="mesa">🛏️ Estás en la <b>habitación {escape(tag)}</b></div>' if hotel else f'<div class="mesa">📍 Estás en: <b>{escape(tag)}</b></div>'
    html = f"""<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{name}</title><link rel="stylesheet" href="/static/menu.css?v=3"></head><body class="{kind}">
<header>{logo_html}<h1>{name}</h1>{f'<p class="tag">{e("tagline")}</p>' if f.get("tagline") else ""}{where}
{f'<div class="btns">{btns}</div>' if btns else ""}</header>
<main>{out or '<p class="empty">Muy pronto tendrás aquí toda la información.</p>'}{note}<p class="foot">Hecho con QRPanel</p></main>
<script src="/static/js/place.js?v=3"></script>
</body></html>"""
    return HTMLResponse(html, headers={"Cache-Control": "no-store"})


MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
DAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
OPS = {"venta": "Se vende", "alquiler": "Se alquila", "traspaso": "Se traspasa", "vendido": "Vendido"}


def _euro(v) -> str:
    v = str(v or "").strip()
    return v + " €" if v and re.fullmatch(r"[\d.,]+", v) else v


def _dt(v):
    import datetime as _d
    try:
        return _d.datetime.strptime(str(v or "")[:16], "%Y-%m-%dT%H:%M")
    except ValueError:
        return None


def _when(v) -> str:
    d = _dt(v)
    return f"{DAYS[d.weekday()]} {d.day} de {MONTHS[d.month - 1]} de {d.year}, {d:%H:%M}" if d else ""


def _rows(text: str, euro: bool = False) -> str:
    """Secciones «# Nombre» y líneas «Nombre | valor» como en la carta."""
    out = ""
    for sec in _parse_menu(text or ""):
        items = "".join(f'<li><div class="it"><b>{escape(it["name"])}</b><i></i><span class="pr">{escape(_euro(it["price"]) if euro else it["price"])}</span></div>'
                        + (f'<p>{escape(it["desc"])}</p>' if it["desc"] else "") + "</li>" for it in sec["items"])
        out += (f'<section>{f"<h2>{escape(sec[chr(110) + chr(97) + chr(109) + chr(101)])}</h2>" if sec["name"] else ""}<ul>{items}</ul></section>')
    return out


def _card_page(r, tag: str | None = None) -> HTMLResponse:
    """Ficha de producto, evento con programa o inmueble."""
    kind = r["kind"]
    f = json.loads(r["fields"] or "{}")
    e = lambda k: escape(str(f.get(k) or "").strip())
    name = e("name") or {"shop": "Producto", "eventpage": "Evento", "home": "Inmueble"}[kind]
    photo = f.get("photo") or ""
    hero = f'<img class="hero" src="{escape(photo)}" alt="">' if PHOTO_RE.match(photo) else ""
    phone, wa = _tel(f.get("phone")), _tel(f.get("whatsapp"))
    box = lambda title, html: f'<section class="box"><h2>{title}</h2>{html}</section>'
    link = lambda u: u if re.match(r"^https?://", u) else "https://" + u
    btns, top, out = "", "", ""
    if kind == "shop":
        pr, of = _euro(f.get("price")), _euro(f.get("offer"))
        if of and pr:
            top = f'<div class="price"><s>{escape(pr)}</s> <b>{escape(of)}</b></div>'
        elif of or pr:
            top = f'<div class="price"><b>{escape(of or pr)}</b></div>'
        if f.get("buy"):
            btns += f'<a class="b main" href="{escape(link(str(f["buy"]).strip()))}" target="_blank" rel="noopener">🛒 Comprar</a>'
        ask = f"Hola, me interesa «{str(f.get('name') or '').strip()}»" + (f" (expositor {tag})" if tag else "") + ". ¿Me das más información?"
        if wa:
            btns += f'<a class="b" href="https://wa.me/{escape(wa.lstrip("+"))}?text={quote(ask)}" target="_blank" rel="noopener">💬 Preguntar</a>'
        if phone:
            btns += f'<a class="b" href="tel:{escape(phone)}">📞 Llamar</a>'
        if f.get("desc"):
            out += f'<p class="lead">{e("desc")}</p>'
        out += _rows(f.get("specs") or "")
        if f.get("hours"):
            out += box("🕒 Horario de la tienda", f'<p>{e("hours")}</p>')
        ig = str(f.get("instagram") or "").strip().lstrip("@")
        if ig:
            btns += f'<a class="b" href="{escape(ig if ig.startswith("http") else "https://instagram.com/" + quote(ig))}" target="_blank" rel="noopener">📸 Instagram</a>'
    elif kind == "eventpage":
        d = _dt(f.get("start"))
        when = _when(f.get("start"))
        end = _dt(f.get("end"))
        if end and d and end.date() == d.date():
            when += f" a {end:%H:%M}"
        elif end:
            when += f" — {_when(f.get('end'))}"
        top = (f'<div class="when">📅 {escape(when)}</div>' if when else "") + (
            f'<div class="count" data-start="{escape(str(f.get("start"))[:16])}"></div>' if d else "")
        if f.get("tickets"):
            btns += f'<a class="b main" href="{escape(link(str(f["tickets"]).strip()))}" target="_blank" rel="noopener">🎟️ Entradas</a>'
        if d:
            btns += f'<a class="b" href="/r/{escape(r["code"])}/evento.ics">🗓️ Añadir al calendario</a>'
        if wa:
            btns += f'<a class="b" href="https://wa.me/{escape(wa.lstrip("+"))}" target="_blank" rel="noopener">💬 WhatsApp</a>'
        if f.get("price"):
            out += box("💶 Precio", f'<p>{e("price")}</p>')
        prog = _rows(f.get("program") or "")
        if prog:
            out += '<h2 class="sec">Programa</h2>' + prog
        if f.get("venue") or f.get("address"):
            out += box("📍 Dónde", f'<p>{"<b>" + e("venue") + "</b><br>" if f.get("venue") else ""}{e("address")}</p>')
        if f.get("dress"):
            out += box("ℹ️ A tener en cuenta", f'<p>{e("dress")}</p>')
        if f.get("wifi_ssid"):
            pw = e("wifi_pass")
            out += box("📶 WiFi", f'<p>Red: <b>{e("wifi_ssid")}</b>' + (
                f'<br>Contraseña: <b class="pw">{pw}</b> <button type="button" class="copy" data-copy="{pw}">Copiar</button>' if pw else "") + "</p>")
    else:  # inmueble
        op = f.get("op") or "venta"
        top = f'<div class="badge {escape(op)}">{escape(OPS.get(op, ""))}</div>' + (
            f'<div class="price"><b>{escape(_euro(f.get("price")))}</b></div>' if f.get("price") and op != "vendido" else "")
        facts = "".join(f'<div><b{" class=long" if len(str(f.get(k))) > 6 else ""}>{e(k)}</b><span>{lab}</span></div>' for k, lab in
                        (("m2", "m²"), ("rooms", "habitaciones"), ("baths", "baños"), ("floor", "planta")) if f.get(k))
        if facts:
            out += f'<div class="facts">{facts}</div>'
        if f.get("desc"):
            out += f'<p class="lead">{e("desc")}</p>'
        feats = [x.strip(" -•*") for x in str(f.get("features") or "").splitlines() if x.strip(" -•*")]
        if feats:
            out += '<section><h2>Características</h2><ul class="checks">' + "".join(f"<li>✓ {escape(x)}</li>" for x in feats) + "</ul></section>"
        ref = str(f.get("ref") or "").strip()
        ask = f"Hola, me interesa el inmueble «{str(f.get('name') or '').strip()}»" + (f" (ref. {ref})" if ref else "") + ". ¿Podemos concertar una visita?"
        if op != "vendido":
            if wa:
                btns += f'<a class="b main" href="https://wa.me/{escape(wa.lstrip("+"))}?text={quote(ask)}" target="_blank" rel="noopener">💬 Pedir visita</a>'
            if phone:
                btns += f'<a class="b" href="tel:{escape(phone)}">📞 Llamar</a>'
            mail = str(f.get("email") or "").strip()
            if re.fullmatch(r"[\w.+-]+@[\w-]+(\.[\w-]+)+", mail):
                btns += f'<a class="b" href="mailto:{escape(mail)}?subject={quote("Visita " + (ref or str(f.get("name") or "")))}&body={quote(ask)}">✉️ Email</a>'
        if f.get("tour"):
            btns += f'<a class="b" href="{escape(link(str(f["tour"]).strip()))}" target="_blank" rel="noopener">📷 Más fotos</a>'
        if f.get("agent") or ref:
            out += box("🏢 Contacto", f'<p>{e("agent")}{"<br>" if f.get("agent") and ref else ""}{"Referencia: <b>" + escape(ref) + "</b>" if ref else ""}</p>')
    if f.get("address") and kind != "eventpage":
        btns += f'<a class="b" href="https://maps.google.com/?q={quote(str(f["address"]))}" target="_blank" rel="noopener">📍 Cómo llegar</a>'
        out += box("📍 Dirección" if kind == "shop" else "📍 Zona", f'<p>{e("address")}</p>')
    elif kind == "eventpage" and (f.get("address") or f.get("venue")):
        btns += f'<a class="b" href="https://maps.google.com/?q={quote(str(f.get("address") or f.get("venue")))}" target="_blank" rel="noopener">📍 Cómo llegar</a>'
    web = str(f.get("web") or "").strip()
    if web:
        btns += f'<a class="b" href="{escape(link(web))}" target="_blank" rel="noopener">🌐 Web</a>'
    sub = e("brand") if kind == "shop" else e("tagline") if kind == "eventpage" else ""
    note = f'<p class="note">{e("notes")}</p>' if f.get("notes") else ""
    html = f"""<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{name}</title><link rel="stylesheet" href="/static/menu.css?v=3"></head><body class="{kind}">
<header class="card-h">{hero}<h1>{name}</h1>{f'<p class="tag">{sub}</p>' if sub else ""}{top}
{f'<div class="btns">{btns}</div>' if btns else ""}</header>
<main>{out}{note}<p class="foot">Hecho con QRPanel</p></main>
<script src="/static/js/place.js?v=3"></script>
</body></html>"""
    return HTMLResponse(html, headers={"Cache-Control": "no-store"})


@app.get("/r/{code}/evento.ics")
def go_ics(code: str):
    r, page = _open(code)
    if page or r["pin"] or r["kind"] != "eventpage":
        raise HTTPException(404, "No hay evento")
    f = json.loads(r["fields"] or "{}")
    d, end = _dt(f.get("start")), _dt(f.get("end"))
    if not d:
        raise HTTPException(404, "El evento no tiene fecha")
    import datetime as _d
    end = end or d + _d.timedelta(hours=2)
    esc_ = lambda v: str(v or "").replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")
    loc = ", ".join(str(x).strip() for x in (f.get("venue"), f.get("address")) if x)
    ics = "\r\n".join(x for x in ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//QRPanel//ES", "BEGIN:VEVENT",
                                   f"UID:{r['code']}@qrpanel", f"DTSTAMP:{time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())}",
                                   f"DTSTART:{d:%Y%m%dT%H%M00}", f"DTEND:{end:%Y%m%dT%H%M00}", f"SUMMARY:{esc_(f.get('name'))}",
                                   loc and f"LOCATION:{esc_(loc)}", f.get("tagline") and f"DESCRIPTION:{esc_(f.get('tagline'))}",
                                   "END:VEVENT", "END:VCALENDAR"] if x) + "\r\n"
    return Response(ics, media_type="text/calendar; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="{re.sub(r"[^A-Za-z0-9_-]", "", r["code"])}.ics"'})


def _scan(r, request: Request, status: int = 302):
    now = time.time()
    ua = request.headers.get("user-agent", "")[:400]
    device, os_, br = _ua_info(ua)
    day = time.strftime("%Y-%m-%d", time.localtime(now))
    visitor = hashlib.sha256(f"{client_ip(request)}|{ua}|{day}".encode()).hexdigest()[:16]
    tag = _table(request)
    db.run("INSERT INTO scans(qr_id,at,day,device,os,browser,visitor,tag) VALUES(?,?,?,?,?,?,?,?)",
           r["id"], now, day, device, os_, br, visitor, tag)
    db.run("UPDATE qrs SET scans=scans+1, last_scan=? WHERE id=?", now, r["id"])
    if r["kind"] == "pet":
        return _pet_page(r)
    if r["kind"] == "menu":
        return _menu_page(r, tag)
    if r["kind"] in ("hotel", "office"):
        return _place_page(r, tag)
    if r["kind"] in ("shop", "eventpage", "home"):
        return _card_page(r, tag)
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
