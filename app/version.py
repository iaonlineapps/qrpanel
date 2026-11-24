"""Version de QRPanel que se ve en la web (Ajustes > Acerca de).

Se toma de la variable QRPANEL_VERSION (la pone la imagen Docker publicada) o, si no,
del archivo app/VERSION. Al sacar una version nueva, sube el ultimo numero: 1.0.1, 1.0.2...
"""
import os
from pathlib import Path


def _read() -> str:
    v = os.environ.get("QRPANEL_VERSION", "").strip().lstrip("vV")
    if v and v[0].isdigit():
        return v
    try:
        return (Path(__file__).parent / "VERSION").read_text().strip() or "?"
    except OSError:
        return "?"


VERSION = _read()
