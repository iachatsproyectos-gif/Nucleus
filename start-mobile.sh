#!/usr/bin/env bash
# Inicia Nucleus accesible desde el celular (mientras la PC esté encendida).
set -euo pipefail
cd "$(dirname "$0")"
PORT="${NUCLEUS_PORT:-8888}"
BIN="./.bin/cloudflared"

if ! command -v python3 >/dev/null; then
  echo "Se necesita python3." >&2
  exit 1
fi

if [[ ! -x "$BIN" ]]; then
  echo "Descargando cloudflared..."
  mkdir -p .bin
  curl -fsSL -o .bin/cloudflared.tgz \
    "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.tgz"
  tar -xzf .bin/cloudflared.tgz -C .bin
  mv .bin/cloudflared-linux-amd64 .bin/cloudflared 2>/dev/null || true
  chmod +x .bin/cloudflared
  rm -f .bin/cloudflared.tgz
fi

pkill -f "http.server $PORT" 2>/dev/null || true
pkill -f "cloudflared tunnel --url http://127.0.0.1:$PORT" 2>/dev/null || true
sleep 1

python3 -m http.server "$PORT" --bind 127.0.0.1 &
SERVER_PID=$!
sleep 1

if ! curl -sf "http://127.0.0.1:$PORT/" >/dev/null; then
  kill "$SERVER_PID" 2>/dev/null || true
  echo "No se pudo iniciar el servidor local en el puerto $PORT." >&2
  exit 1
fi

echo "Servidor local: http://127.0.0.1:$PORT (PID $SERVER_PID)"
echo "Creando túnel público..."
"$BIN" tunnel --url "http://127.0.0.1:$PORT" 2>&1 | tee .tunnel.log
