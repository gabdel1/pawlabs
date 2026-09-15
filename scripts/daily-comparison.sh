#!/usr/bin/env bash
#
# One comparison article a day.
#
#   1. Ask the CMS to pick the highest-value uncompared breed pair and write it.
#   2. Rebuild the static site so the article is actually visible.
#
# Driven by the pawlabs-daily-comparison systemd timer. Safe to run by hand.
#
# The rebuild goes into a staging directory and is swapped in only on success.
# `astro build` empties its output directory before it starts, so building
# straight into dist/ means a failure at 3am leaves the live site as a pile of
# missing files until someone notices.
#
# Exit codes: 0 ok · 1 generation failed · 2 build failed · 3 preconditions bad

set -uo pipefail

ROOT=/srv/pet
CMS_ENV="$ROOT/cms/.env"
API="http://127.0.0.1:3000/api/generate/comparison/daily"
LOG="$ROOT/.daily-comparison.log"
STATUS="${COMPARISON_STATUS:-published}"

log() { printf '%s  %s\n' "$(date -Is)" "$*" | tee -a "$LOG"; }

cd "$ROOT" || { log "FATAL: cannot cd to $ROOT"; exit 3; }

# ── Preconditions ────────────────────────────────────────────────────────
if [[ ! -r "$CMS_ENV" ]]; then
  log "FATAL: $CMS_ENV not readable"; exit 3
fi

KEY=$(grep -E '^GENERATE_API_KEY=' "$CMS_ENV" | cut -d= -f2- | tr -d '"'"'"' \r')
if [[ -z "$KEY" ]]; then
  log "FATAL: GENERATE_API_KEY missing from $CMS_ENV"; exit 3
fi

if ! systemctl is-active --quiet pawlabs-cms; then
  log "FATAL: pawlabs-cms is not running — cannot generate"; exit 3
fi

# ── 1. Generate ──────────────────────────────────────────────────────────
log "requesting today's comparison (status=$STATUS)"

RESPONSE=$(curl -sS -X POST "$API" \
  -H 'Content-Type: application/json' \
  -H "X-Api-Key: $KEY" \
  --max-time 180 \
  -d "{\"status\":\"$STATUS\"}" 2>&1)

if ! echo "$RESPONSE" | python3 -c 'import sys,json; json.load(sys.stdin)' 2>/dev/null; then
  log "FAILED: non-JSON response: ${RESPONSE:0:300}"; exit 1
fi

if echo "$RESPONSE" | python3 -c 'import sys,json; sys.exit(0 if json.load(sys.stdin).get("ok") else 1)'; then
  # Bind values first — nesting the same quote style inside an f-string
  # expression is a syntax error before Python 3.12.
  SUMMARY=$(echo "$RESPONSE" | python3 -c '
import sys, json
d = json.load(sys.stdin)
c = d["comparison"]
p = d["picked"]
title = c["title"]
slug = c["slug"]
style = p.get("style", "?")
names = " · ".join(b["name"] for b in p.get("breeds", []))
reason = p.get("reason") or "—"
took = d.get("elapsedSeconds", "?")
left = d.get("planRemaining", "?")
print(f"{title}  [{slug}]")
print(f"    style:  {style}")
print(f"    breeds: {names}")
print(f"    why:    {reason}")
print(f"    took:   {took}s · {left} left in plan")
')
  log "generated:"
  echo "$SUMMARY" | tee -a "$LOG"
else
  ERR=$(echo "$RESPONSE" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("error","unknown"))')
  log "FAILED: $ERR"
  # Nothing new to publish is not an error worth alerting on.
  [[ "$ERR" == *"already been compared"* ]] && exit 0
  exit 1
fi

# ── 2. Rebuild the static site (staged, then swapped) ────────────────────
log "syncing media"
npm run media:sync --silent >>"$LOG" 2>&1 || log "WARN: media sync reported a problem, continuing"

STAGING="$ROOT/dist-next"
PREVIOUS="$ROOT/dist-prev"
rm -rf "$STAGING" "$PREVIOUS"

log "building into $STAGING"
if ! npx astro build --outDir "$STAGING" >>"$LOG" 2>&1; then
  log "FAILED: build errored — live site left untouched"
  rm -rf "$STAGING"
  exit 2
fi

if [[ ! -f "$STAGING/index.html" ]] || [[ ! -f "$STAGING/sitemap-index.xml" ]]; then
  log "FAILED: build output looks incomplete — live site left untouched"
  rm -rf "$STAGING"
  exit 2
fi

PAGES=$(find "$STAGING" -name index.html | wc -l)
log "build produced $PAGES pages — swapping in"

mv "$ROOT/dist" "$PREVIOUS" && mv "$STAGING" "$ROOT/dist"
rm -rf "$PREVIOUS"

log "done — https://pawlabs.org/compare"
exit 0
