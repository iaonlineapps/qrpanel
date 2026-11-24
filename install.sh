#!/usr/bin/env bash
# Instala o actualiza QRPanel.
# Uso: ./install.sh   (desde la carpeta donde descargaste QRPanel)
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: Docker no está instalado. Instálalo con: curl -fsSL https://get.docker.com | sh" >&2
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  sed -i "s/^PUID=.*/PUID=$(id -u)/; s/^PGID=.*/PGID=$(id -g)/" .env
  echo "He creado el archivo .env con tu usuario (PUID=$(id -u), PGID=$(id -g))."
  echo "Ábrelo (nano .env), elige dónde guardar los datos en DATA_DIR y, si tienes dominio,"
  echo "pon tu dirección pública en PUBLIC_URL. Luego vuelve a ejecutar ./install.sh"
  exit 0
fi
set -a; . ./.env; set +a
DATA_DIR="${DATA_DIR:-./data}"

PARENT=$(dirname "$DATA_DIR")
if [ ! -d "$PARENT" ]; then
  echo "ERROR: la carpeta $PARENT no existe. ¿Está montado el disco? Revisa DATA_DIR en .env" >&2
  exit 1
fi

sudo mkdir -p "$DATA_DIR/config"
sudo chown -R "${PUID:-1000}:${PGID:-1000}" "$DATA_DIR"

docker compose up -d --build
docker image prune -f >/dev/null 2>&1 || true

IP=$(hostname -I | awk '{print $1}')
echo
echo "QRPanel funcionando en:  http://${IP}:${PORT:-8091}"
echo "Datos guardados en:      ${DATA_DIR}"
