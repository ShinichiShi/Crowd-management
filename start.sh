#!/usr/bin/env bash
# One command to run everything after a fresh clone (Linux / macOS / WSL / Git-Bash):
#
#   ./start.sh                 first run installs Python + Node dependencies, then starts API and web app
#   ./start.sh --seed          also create 4 demo temples with 2 days of history (needs results/ from the repo)
#   ./start.sh --prod          production build of the web app instead of the dev server
#   ./start.sh --install-only  prepare environments and exit
#
# Options: --seed  --reset-demo  --prod  --no-frontend  --install-only  -h
# Environment: BACKEND_PORT (8000)  FRONTEND_PORT (3000)  HOST (127.0.0.1; use 0.0.0.0 to share on your network,
#              then also set NEXT_PUBLIC_API_URL=http://<this-machine>:8000)
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
ROOT="$(pwd)"

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
HOST="${HOST:-127.0.0.1}"
API_URL="${NEXT_PUBLIC_API_URL:-http://127.0.0.1:${BACKEND_PORT}}"
MODE=dev; SEED=0; RESET=0; INSTALL_ONLY=0; FRONTEND=1

for arg in "$@"; do
  case "$arg" in
    --prod) MODE=prod ;;
    --seed) SEED=1 ;;
    --reset-demo) SEED=1; RESET=1 ;;
    --no-frontend) FRONTEND=0 ;;
    --install-only) INSTALL_ONLY=1 ;;
    -h|--help) sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $arg (try --help)"; exit 2 ;;
  esac
done

log()  { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------- prerequisites
PY="$(command -v python3 || command -v python || true)"
[ -n "$PY" ] || die "Python 3.10+ is required (https://www.python.org/downloads/)."
"$PY" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' || die "Python 3.10+ is required (found $("$PY" --version 2>&1))."
if [ "$FRONTEND" = 1 ]; then
  command -v node >/dev/null 2>&1 || die "Node.js 18+ is required (https://nodejs.org/)."
  command -v npm  >/dev/null 2>&1 || die "npm is required (it ships with Node.js)."
  [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 18 ] || die "Node.js 18+ is required (found $(node --version))."
fi

port_busy() { "$PY" - "$1" <<'EOF'
import socket, sys
s = socket.socket(); s.settimeout(0.5)
sys.exit(0 if s.connect_ex(("127.0.0.1", int(sys.argv[1]))) == 0 else 1)
EOF
}
url_ok() { "$PY" -c 'import sys, urllib.request; urllib.request.urlopen(sys.argv[1], timeout=3)' "$1" >/dev/null 2>&1; }
hash_of() { if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi; }

# ---------------------------------------------------------------- backend environment
log "Backend: Python environment"
cd "$ROOT/backend"
[ -d .venv ] || "$PY" -m venv .venv
# shellcheck disable=SC1091
if [ -f .venv/bin/activate ]; then . .venv/bin/activate; else . .venv/Scripts/activate; fi
STAMP=".venv/.requirements.sha"
WANT="$(hash_of requirements.txt)"
if [ ! -f "$STAMP" ] || [ "$(cat "$STAMP")" != "$WANT" ]; then
  log "Installing Python packages (first run takes a few minutes)"
  python -m pip install --upgrade pip -q
  if command -v nvidia-smi >/dev/null 2>&1; then
    pip install -q -r requirements.txt
  else
    # no NVIDIA GPU: the CPU-only PyTorch build is ~200 MB instead of ~800 MB
    TORCH="$(grep -E '^torch==' requirements.txt | head -1)"; TV="$(grep -E '^torchvision==' requirements.txt | head -1)"
    pip install -q "$TORCH" "$TV" --index-url https://download.pytorch.org/whl/cpu
    grep -v -E '^(torch|torchvision)==' requirements.txt > .venv/requirements.notorch.txt
    pip install -q -r .venv/requirements.notorch.txt
  fi
  echo "$WANT" > "$STAMP"
else
  log "Python packages already installed"
fi
for f in csrnet_model.pth lstm_model.pth; do
  [ -f "models/$f" ] || warn "backend/models/$f is missing - the API will run in demo-fallback mode (see backend/models/README.md)"
done

# ---------------------------------------------------------------- frontend environment
if [ "$FRONTEND" = 1 ]; then
  log "Frontend: Node packages"
  cd "$ROOT/client"
  if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
    npm install --no-audit --no-fund
  else
    log "Node packages already installed"
  fi
fi

if [ "$INSTALL_ONLY" = 1 ]; then log "Environments ready. Run ./start.sh to launch."; exit 0; fi

# ---------------------------------------------------------------- start
port_busy "$BACKEND_PORT" && die "Port $BACKEND_PORT is already in use (set BACKEND_PORT=... to use another)."
if [ "$FRONTEND" = 1 ]; then port_busy "$FRONTEND_PORT" && die "Port $FRONTEND_PORT is already in use (set FRONTEND_PORT=...)."; fi
mkdir -p "$ROOT/logs"
PIDS=()
stop_tree() { local p="$1" c; for c in $(pgrep -P "$p" 2>/dev/null || true); do stop_tree "$c"; done; kill "$p" 2>/dev/null || true; }
cleanup() { trap - INT TERM EXIT; echo; log "Stopping..."; for p in "${PIDS[@]:-}"; do [ -n "$p" ] && stop_tree "$p"; done; exit 0; }
trap cleanup INT TERM EXIT

log "Starting API on http://$HOST:$BACKEND_PORT (log: logs/backend.log)"
( cd "$ROOT/backend" && exec python -m uvicorn main:app --host "$HOST" --port "$BACKEND_PORT" ) > "$ROOT/logs/backend.log" 2>&1 &
PIDS+=($!)
for i in $(seq 1 120); do
  url_ok "http://127.0.0.1:$BACKEND_PORT/health" && break
  kill -0 "${PIDS[0]}" 2>/dev/null || { tail -20 "$ROOT/logs/backend.log"; die "The API stopped during startup (see logs/backend.log)."; }
  sleep 1
done
url_ok "http://127.0.0.1:$BACKEND_PORT/health" || die "The API did not answer within 2 minutes (see logs/backend.log)."
log "API is up: $("$PY" -c 'import sys, urllib.request; print(urllib.request.urlopen(sys.argv[1]).read().decode())' "http://127.0.0.1:$BACKEND_PORT/health")"

if [ "$SEED" = 1 ]; then
  log "Seeding demo temples"
  ( cd "$ROOT/backend" && python scripts/seed_demo.py $([ "$RESET" = 1 ] && echo --reset) )
fi

if [ "$FRONTEND" = 1 ]; then
  cd "$ROOT/client"
  if [ "$MODE" = prod ]; then
    log "Building the web app (production)"
    NEXT_PUBLIC_API_URL="$API_URL" npm run build > "$ROOT/logs/frontend-build.log" 2>&1 || { tail -30 "$ROOT/logs/frontend-build.log"; die "Build failed (logs/frontend-build.log)."; }
    CMD=(npm run start -- -p "$FRONTEND_PORT" -H "$HOST")
  else
    CMD=(npm run dev -- -p "$FRONTEND_PORT" -H "$HOST")
  fi
  log "Starting the web app on http://$HOST:$FRONTEND_PORT (log: logs/frontend.log)"
  ( cd "$ROOT/client" && NEXT_PUBLIC_API_URL="$API_URL" exec "${CMD[@]}" ) > "$ROOT/logs/frontend.log" 2>&1 &
  PIDS+=($!)
  for i in $(seq 1 120); do
    url_ok "http://127.0.0.1:$FRONTEND_PORT/" && break
    kill -0 "${PIDS[1]}" 2>/dev/null || { tail -20 "$ROOT/logs/frontend.log"; die "The web app stopped during startup (see logs/frontend.log)."; }
    sleep 1
  done
  url_ok "http://127.0.0.1:$FRONTEND_PORT/" || die "The web app did not answer within 2 minutes (see logs/frontend.log)."
fi

echo
printf '\033[1;32m  Ready\033[0m\n'
[ "$FRONTEND" = 1 ] && echo "  Web app : http://localhost:$FRONTEND_PORT   (dashboard, temples, alerts, analytics)"
echo "  API     : http://localhost:$BACKEND_PORT/docs"
echo "  Logs    : $ROOT/logs/"
echo "  Press Ctrl-C to stop everything."
echo
wait
