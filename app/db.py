import hashlib, hmac, os, secrets, sqlite3, threading, time
from .config import CONFIG, ADMIN_USER, ADMIN_PASSWORD, SESSION_DAYS

DB_PATH = CONFIG / "qrpanel.db"
_local = threading.local()

SCHEMA = """
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL COLLATE NOCASE,
  pw_hash TEXT NOT NULL, is_admin INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', created REAL);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER, expires REAL);
CREATE TABLE IF NOT EXISTS qrs(
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, name TEXT, kind TEXT,
  fields TEXT, content TEXT, design TEXT, folder TEXT DEFAULT '', favorite INTEGER DEFAULT 0,
  dynamic INTEGER DEFAULT 0, code TEXT UNIQUE, target TEXT, active INTEGER DEFAULT 1,
  expires REAL, max_scans INTEGER, scans INTEGER DEFAULT 0, last_scan REAL,
  created REAL, updated REAL);
CREATE INDEX IF NOT EXISTS qrs_user ON qrs(user_id, updated);
CREATE TABLE IF NOT EXISTS scans(
  id INTEGER PRIMARY KEY, qr_id INTEGER, at REAL, day TEXT, device TEXT, os TEXT,
  browser TEXT, visitor TEXT);
CREATE INDEX IF NOT EXISTS scans_qr_at ON scans(qr_id, at);
CREATE TABLE IF NOT EXISTS logos(
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, name TEXT, data TEXT, created REAL);
CREATE TABLE IF NOT EXISTS templates(
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, name TEXT, design TEXT, created REAL);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);
"""


def conn():
    c = getattr(_local, "c", None)
    if c is None:
        c = sqlite3.connect(DB_PATH, timeout=10, isolation_level=None)
        c.row_factory = sqlite3.Row
        c.execute("PRAGMA journal_mode=WAL")
        c.execute("PRAGMA foreign_keys=ON")
        _local.c = c
    return c


def q(sql, *args):
    return conn().execute(sql, args).fetchall()


def q1(sql, *args):
    return conn().execute(sql, args).fetchone()


def run(sql, *args):
    return conn().execute(sql, args)


# --- contrasenas -----------------------------------------------------------
ITER = 120_000


def hash_pw(pw: str) -> str:
    salt = os.urandom(16)
    h = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, ITER)
    return f"pbkdf2${ITER}${salt.hex()}${h.hex()}"


def check_pw(pw: str, stored: str) -> bool:
    try:
        _, it, salt, h = stored.split("$")
        calc = hashlib.pbkdf2_hmac("sha256", pw.encode(), bytes.fromhex(salt), int(it))
        return hmac.compare_digest(calc.hex(), h)
    except Exception:
        return False


def authenticate(username: str, password: str):
    u = q1("SELECT * FROM users WHERE username=?", username)
    if not u or not check_pw(password, u["pw_hash"]):
        return None
    return u


# --- sesiones ----------------------------------------------------------------
def new_session(user_id: int) -> str:
    tok = secrets.token_urlsafe(32)
    run("INSERT INTO sessions VALUES(?,?,?)", tok, user_id, time.time() + SESSION_DAYS * 86400)
    return tok


def session_user(tok: str):
    if not tok:
        return None
    return q1("SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id "
              "WHERE s.token=? AND s.expires>? AND u.status='approved'", tok, time.time())


# --- ajustes -----------------------------------------------------------------
def setting(key: str, default: str = "") -> str:
    r = q1("SELECT value FROM settings WHERE key=?", key)
    return r["value"] if r else default


def set_setting(key: str, value: str):
    run("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        key, value)


def init():
    conn().executescript(SCHEMA)
    cols = {r["name"] for r in q("PRAGMA table_info(qrs)")}
    if "pin" not in cols:  # PIN para abrir un QR dinamico (guardado con hash)
        run("ALTER TABLE qrs ADD COLUMN pin TEXT")
    if "share" not in cols:  # enlace publico para compartir un QR
        run("ALTER TABLE qrs ADD COLUMN share TEXT")
        run("CREATE UNIQUE INDEX IF NOT EXISTS qrs_share ON qrs(share)")
    run("DELETE FROM sessions WHERE expires<?", time.time())
    run("DELETE FROM scans WHERE at<?", time.time() - 730 * 86400)  # se guardan dos anos
    if ADMIN_USER and ADMIN_PASSWORD and not q1("SELECT id FROM users WHERE username=?", ADMIN_USER):
        run("INSERT INTO users(username,pw_hash,is_admin,status,created) VALUES(?,?,1,'approved',?)",
            ADMIN_USER, hash_pw(ADMIN_PASSWORD), time.time())
