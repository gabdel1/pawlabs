#!/usr/bin/env bash
set -euo pipefail

#
# CMS Supervisor — manages the Payload CMS (Next.js) process.
#
# Usage:
#   ./scripts/cms.sh start     Start CMS in background (build first if needed)
#   ./scripts/cms.sh stop      Stop the background CMS
#   ./scripts/cms.sh restart   Stop + start
#   ./scripts/cms.sh status    Check if CMS is running and healthy
#   ./scripts/cms.sh build     Build the CMS (next build)
#   ./scripts/cms.sh logs      Tail the CMS log file
#   ./scripts/cms.sh ensure    Start only if not already running (idempotent)
#

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CMS_DIR="$ROOT/cms"
PID_FILE="$ROOT/.cms.pid"
LOG_FILE="$ROOT/.cms.log"
PORT="${CMS_PORT:-3000}"
HEALTH_URL="http://127.0.0.1:$PORT/api/media?limit=1"

log() { echo "[cms] $*"; }

is_running() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
    # Stale PID file
    rm -f "$PID_FILE"
  fi
  return 1
}

wait_healthy() {
  local max_wait=${1:-60}
  local waited=0
  log "Waiting for CMS to become healthy (max ${max_wait}s)..."
  while (( waited < max_wait )); do
    if curl -sf --max-time 3 "$HEALTH_URL" >/dev/null 2>&1; then
      log "CMS is healthy (took ${waited}s)"
      return 0
    fi
    sleep 2
    waited=$((waited + 2))
  done
  log "CMS did not become healthy within ${max_wait}s"
  return 1
}

needs_build() {
  # Needs build if .next/BUILD_ID doesn't exist or is older than source
  if [[ ! -f "$CMS_DIR/.next/BUILD_ID" ]]; then
    return 0
  fi
  # Check if any source file is newer than BUILD_ID
  local newest_src
  newest_src=$(find "$CMS_DIR/src" -type f -newer "$CMS_DIR/.next/BUILD_ID" 2>/dev/null | head -1)
  if [[ -n "$newest_src" ]]; then
    return 0
  fi
  return 1
}

do_build() {
  log "Building CMS..."
  cd "$CMS_DIR"
  npx cross-env NODE_OPTIONS="--max-old-space-size=1536" next build 2>&1 | tee "$ROOT/.cms-build.log"
  log "Build complete"
}

do_start() {
  if is_running; then
    log "CMS already running (PID $(cat "$PID_FILE"))"
    return 0
  fi

  # Build if needed
  if needs_build; then
    do_build
  fi

  log "Starting CMS on port $PORT..."
  cd "$CMS_DIR"
  nohup npx cross-env NODE_OPTIONS="--no-deprecation" next start -p "$PORT" \
    >> "$LOG_FILE" 2>&1 &
  local pid=$!
  echo "$pid" > "$PID_FILE"
  log "CMS started (PID $pid)"
  log "Logs: $LOG_FILE"

  # Wait for it to be healthy
  if ! wait_healthy 90; then
    log "WARNING: CMS may not be fully ready yet. Check logs: tail -f $LOG_FILE"
    return 1
  fi
}

do_stop() {
  if ! is_running; then
    log "CMS is not running"
    return 0
  fi
  local pid
  pid=$(cat "$PID_FILE")
  log "Stopping CMS (PID $pid)..."
  kill "$pid" 2>/dev/null || true
  # Wait for graceful shutdown
  local waited=0
  while (( waited < 15 )) && kill -0 "$pid" 2>/dev/null; do
    sleep 1
    waited=$((waited + 1))
  done
  if kill -0 "$pid" 2>/dev/null; then
    log "Force killing CMS..."
    kill -9 "$pid" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
  log "CMS stopped"
}

do_status() {
  if is_running; then
    local pid
    pid=$(cat "$PID_FILE")
    log "CMS is running (PID $pid)"
    if curl -sf --max-time 3 "$HEALTH_URL" >/dev/null 2>&1; then
      log "Health check: OK"
    else
      log "Health check: FAILING (API not responding)"
    fi
  else
    log "CMS is not running"
    return 1
  fi
}

do_ensure() {
  # Idempotent start: only start if not running + healthy
  if is_running; then
    if curl -sf --max-time 3 "$HEALTH_URL" >/dev/null 2>&1; then
      log "CMS already running and healthy"
      return 0
    fi
    log "CMS running but unhealthy, restarting..."
    do_stop
  fi
  do_start
}

case "${1:-}" in
  start)   do_start ;;
  stop)    do_stop ;;
  restart) do_stop; do_start ;;
  status)  do_status ;;
  build)   do_build ;;
  logs)    tail -f "$LOG_FILE" ;;
  ensure)  do_ensure ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|build|logs|ensure}"
    exit 1
    ;;
esac
