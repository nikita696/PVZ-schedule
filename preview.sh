#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-4173}"

cleanup() {
  if [[ -n "${HTTP_PID:-}" ]]; then
    kill "$HTTP_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

python -m http.server "$PORT" >/tmp/pvz-preview-http.log 2>&1 &
HTTP_PID=$!

echo "Локальный сервер запущен на http://localhost:${PORT}"
echo "Запускаю временный публичный туннель..."

npx localtunnel --port "$PORT"
