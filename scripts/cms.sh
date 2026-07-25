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

# Print the PIDs listening on $PORT, one per line.
#
# lsof alone is not reliable here: when Next binds the IPv6 wildcard (*:3000)
# it can report nothing at all, which silently turns `stop`/`restart` into
# no-ops and leaves a stale server serving the old build. Fall back to ss and
# then fuser so a single tool's blind spot can't strand an orphan.
port_pids() {
  local pids=""

  pids=$(lsof -ti TCP:"$PORT" 2>/dev/null || true)
  if [[ -z "$pids" ]] && command -v ss >/dev/null 2>&1; then
    pids=$(ss -lptnH "sport = :$PORT" 2>/dev/null | grep -oP 'pid=\K[0-9]+' || true)
  fi
  if [[ -z "$pids" ]] && command -v fuser >/dev/null 2>&1; then
    pids=$(fuser "$PORT"/tcp 2>/dev/null | tr -s ' ' '\n' || true)
  fi

  echo "$pids" | tr ' ' '\n' | grep -E '^[0-9]+$' | sort -u || true
}

is_running() {
  # First: trust the PID file if it points to a live process
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
    # Stale PID file
    rm -f "$PID_FILE"
  fi
  # Fallback: detect by port. Catches processes started outside this script
  # (e.g. orphaned from a previous boot or manual `next start`).
  local port_pid
  port_pid=$(port_pids | head -1)
  if [[ -n "$port_pid" ]]; then
    log "Found existing CMS process on port $PORT (PID $port_pid), adopting it"
    echo "$port_pid" > "$PID_FILE"
    return 0
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
  log "Regenerating Payload import map..."
  cd "$CMS_DIR"
  npx cross-env NODE_OPTIONS="--no-deprecation" payload generate:importmap 2>&1 | tee -a "$ROOT/.cms-build.log"
  # Wipe webpack's persistent cache. If left in place, webpack may skip emitting
  # chunks it thinks are unchanged — leaving the new build's HTML referencing
  # chunk filenames that don't exist on disk (causing ChunkLoadError in the admin).
  log "Clearing webpack cache..."
  rm -rf "$CMS_DIR/node_modules/.cache"
  log "Building CMS..."
  npx cross-env NODE_OPTIONS="--max-old-space-size=4096" next build 2>&1 | tee -a "$ROOT/.cms-build.log"
  log "Build complete"
}

do_start() {
  if is_running; then
    log "CMS already running (PID $(cat "$PID_FILE"))"
    return 0
  fi

  # Verify port is actually free before starting
  if ! port_free; then
    log "Port $PORT is still in use — killing stray process..."
    kill_port
    if ! port_free; then
      log "ERROR: Port $PORT still busy after kill. Aborting."
      return 1
    fi
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

kill_port() {
  # Kill any process still holding the CMS port. `next start` runs behind an npx
  # wrapper, so killing the recorded PID often leaves the real listener alive —
  # this is what actually frees the port.
  local pids
  pids=$(port_pids | tr '\n' ' ')
  if [[ -n "${pids// /}" ]]; then
    log "Killing stray process(es) on port $PORT: $pids"
    # shellcheck disable=SC2086
    kill -9 $pids 2>/dev/null || true

    # Poll until the socket is actually released. A fixed sleep races the
    # kernel: `next start` would occasionally bind before the old socket was
    # freed and die with EADDRINUSE.
    local waited=0
    while (( waited < 10 )) && [[ -n "$(port_pids)" ]]; do
      sleep 1
      waited=$((waited + 1))
    done
    if [[ -n "$(port_pids)" ]]; then
      log "WARNING: port $PORT still held after ${waited}s"
    fi
  fi
}

port_free() {
  [[ -z "$(port_pids)" ]]
}

do_stop() {
  local pid=""

  if [[ -f "$PID_FILE" ]]; then
    pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      log "Stopping CMS (PID $pid)..."
      kill "$pid" 2>/dev/null || true
      # Wait for graceful shutdown
      local waited=0
      while (( waited < 15 )) && kill -0 "$pid" 2>/dev/null; do
        sleep 1
        waited=$((waited + 1))
      done
      if kill -0 "$pid" 2>/dev/null; then
        log "Force killing CMS (PID $pid)..."
        kill -9 "$pid" 2>/dev/null || true
      fi
    else
      log "Stale PID file (PID $pid already gone)"
    fi
    rm -f "$PID_FILE"
  else
    log "No PID file found"
  fi

  # Always clean up anything still on the port (orphan workers, etc.)
  kill_port

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
  restart)
    do_stop
    # Delete build artifacts so do_start always does a clean build on restart.
    # This prevents stale chunk errors when the previous build was partial/corrupted.
    log "Cleaning stale build artifacts..."
    rm -rf "$CMS_DIR/.next"
    do_start
    ;;
  status)  do_status ;;
  build)   do_build ;;
  logs)    tail -f "$LOG_FILE" ;;
  ensure)  do_ensure ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|build|logs|ensure}"
    exit 1
    ;;
esac
