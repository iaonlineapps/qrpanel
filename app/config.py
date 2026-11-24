import os
from pathlib import Path

DATA = Path(os.environ.get("QR_DATA", "/data"))
CONFIG = DATA / "config"        # base de datos (usuarios, QR, logos, escaneos)

ADMIN_USER = os.environ.get("ADMIN_USER", "").strip()
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
SESSION_DAYS = 30
# 0 = nadie puede registrarse solo (el administrador crea las cuentas en Usuarios)
ALLOW_REGISTER = os.environ.get("ALLOW_REGISTER", "1").strip().lower() not in ("0", "no", "false")
# Direccion publica para los QR dinamicos (https://qr.midominio.com). Vacia = la de la web.
PUBLIC_URL = os.environ.get("PUBLIC_URL", "").strip().rstrip("/")

CONFIG.mkdir(parents=True, exist_ok=True)
