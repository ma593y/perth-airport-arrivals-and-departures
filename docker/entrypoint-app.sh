#!/bin/sh
set -e

db="${DATABASE_PATH:-/app/data/flights.db}"
db_dir="$(dirname "$db")"
mkdir -p "$db_dir"
if [ ! -f "$db_dir/port-routes.json" ] && [ -f /app/port-routes.seed.json ]; then
  cp /app/port-routes.seed.json "$db_dir/port-routes.json"
fi
interval="${SCRAPE_INTERVAL_SECONDS:-60}"
port="${PORT:-3000}"

npm run migrate

npm run start &
api_pid=$!

cleanup() {
  kill "$api_pid" 2>/dev/null || true
  wait "$api_pid" 2>/dev/null || true
}
trap cleanup TERM INT

while true; do
  npm run collect || true
  sleep "$interval"
done
