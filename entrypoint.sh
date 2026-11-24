#!/bin/sh
# Si el contenedor arranca como root (por ejemplo en CasaOS), deja la carpeta de datos
# a nombre de PUID:PGID y sigue como ese usuario normal. Si ya arranca como usuario
# normal (docker-compose.yaml con "user:"), no cambia nada.
set -e
if [ "$(id -u)" = "0" ]; then
  PUID="${PUID:-1000}"
  PGID="${PGID:-1000}"
  mkdir -p "$QR_DATA"
  if [ "$(stat -c %u:%g "$QR_DATA")" != "$PUID:$PGID" ]; then
    chown -R "$PUID:$PGID" "$QR_DATA"
  fi
  exec setpriv --reuid="$PUID" --regid="$PGID" --clear-groups "$@"
fi
exec "$@"
