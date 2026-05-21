#!/bin/sh
set -e

db="${DATABASE_PATH:-/app/data/flights.db}"
mkdir -p "$(dirname "$db")"

echo "Running migrations..."
npm run migrate

echo "Starting API on port ${PORT:-3000}..."
exec npm run start
