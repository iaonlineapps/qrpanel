FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 QR_DATA=/data
# Version que se ve en la web; la imagen publicada la recibe de la etiqueta (v1.2.3)
ARG QRPANEL_VERSION=
ENV QRPANEL_VERSION=${QRPANEL_VERSION}
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY entrypoint.sh /entrypoint.sh
# el contenedor corre como usuario normal: el codigo tiene que ser legible
# aunque se haya copiado con permisos restrictivos (por ejemplo desde Windows)
RUN chmod -R a+rX /app && chmod 755 /entrypoint.sh

EXPOSE 8091
HEALTHCHECK --interval=60s --timeout=5s --retries=3 \
  CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8091/api/info')" || exit 1
ENTRYPOINT ["/entrypoint.sh"]
# Un solo proceso: suficiente para una Raspberry Pi y necesario para SQLite
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8091", "--proxy-headers", "--forwarded-allow-ips", "*", "--no-access-log"]
