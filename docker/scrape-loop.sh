#!/bin/bash
set -e

db="${DATABASE_PATH:-/app/data/flights.db}"
mkdir -p "$(dirname "$db")"
interval="${SCRAPE_INTERVAL_SECONDS:-900}"

echo "Collect loop: every ${interval}s (DATABASE_PATH=$db)"

while true; do
  npm run migrate
  if npm run collect; then
    echo "Collect OK at $(date -Iseconds)"
  else
    echo "Collect failed at $(date -Iseconds) — retrying after sleep" >&2
  fi
  sleep "$interval"
done
