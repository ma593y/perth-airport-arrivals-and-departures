#!/bin/sh
set -e

db="${DATABASE_PATH:-/app/data/flights.db}"
mkdir -p "$(dirname "$db")"

echo "Running migrations..."
npm run migrate

echo "Running collect..."
exec npm run collect
