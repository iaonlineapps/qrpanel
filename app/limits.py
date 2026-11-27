"""Limite de intentos fallidos (inicio de sesion y registro), en memoria."""
import threading, time


class Limiter:
    def __init__(self, max_hits: int, window: float, block: float):
        self.max_hits, self.window, self.block = max_hits, window, block
        self._hits, self._blocked, self._lock = {}, {}, threading.Lock()

    def blocked(self, key) -> int:
        """Segundos que faltan para poder volver a intentarlo (0 = puede)."""
        with self._lock:
            until = self._blocked.get(key, 0)
            if until <= time.time():
                self._blocked.pop(key, None)
                return 0
            return int(until - time.time()) + 1

    def hit(self, key):
        now = time.time()
        with self._lock:
            if len(self._hits) > 10000:  # que no crezca sin limite
                self._hits = {k: v for k, v in self._hits.items() if v and v[-1] > now - self.window}
            lst = [t for t in self._hits.get(key, []) if t > now - self.window]
            lst.append(now)
            self._hits[key] = lst
            if len(lst) >= self.max_hits:
                self._blocked[key] = now + self.block
                self._hits.pop(key, None)

    def reset(self, key):
        with self._lock:
            self._hits.pop(key, None)
            self._blocked.pop(key, None)


# 5 fallos seguidos desde la misma IP con el mismo usuario: 15 minutos de espera.
by_ip_user = Limiter(5, 900, 900)
# 30 fallos con el mismo usuario desde cualquier sitio: 15 minutos (por si cambian de IP).
by_user = Limiter(30, 900, 900)
# PIN de un QR: 5 fallos desde la misma IP en 10 minutos -> 15 minutos de espera;
# 50 fallos con el mismo QR desde cualquier sitio -> 30 minutos (contra ataques repartidos).
pin_ip = Limiter(5, 600, 900)
pin_qr = Limiter(50, 3600, 1800)
# Codigo de recuperacion: 5 fallos desde la misma IP en 15 minutos -> 30 minutos de espera.
recover = Limiter(5, 900, 1800)
# Registro: como mucho 5 cuentas nuevas por IP y hora.
register = Limiter(5, 3600, 3600)


def login_blocked(ip: str, username: str) -> int:
    u = username.lower()
    return max(by_ip_user.blocked((ip, u)), by_user.blocked(u))


def login_failed(ip: str, username: str):
    u = username.lower()
    by_ip_user.hit((ip, u))
    by_user.hit(u)


def login_ok(ip: str, username: str):
    by_ip_user.reset((ip, username.lower()))
