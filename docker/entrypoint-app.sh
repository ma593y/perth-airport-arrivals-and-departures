#!/bin/sh
set -e

db="${DATABASE_PATH:-/app/data/flights.db}"
mkdir -p "$(dirname "$db")"
interval="${SCRAPE_INTERVAL_SECONDS:-60}"
port="${PORT:-3000}"

echo "Running migrations..."
npm run migrate

echo "Starting API on port ${port}..."
npm run start &
api_pid=$!

cleanup() {
  echo "Shutting down..."
  kill "$api_pid" 2>/dev/null || true
  wait "$api_pid" 2>/dev/null || true
}
trap cleanup TERM INT

echo "Collect loop: every ${interval}s (DATABASE_PATH=$db)"
while true; do
  if npm run collect; then
    echo "Collect OK at $(date -Iseconds)"
  else
    echo "Collect failed at $(date -Iseconds) — retrying after sleep" >&2
  fi
  sleep "$interval"
done
