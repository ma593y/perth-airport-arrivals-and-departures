# Local development setup

Run the flight board on your machine without Docker.

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| **Node.js 22 LTS** | `node -v` should show `v22.x`. Node 24 on Windows often breaks `better-sqlite3` prebuilds—use 22 or Docker. |
| **npm** | Comes with Node |
| **Chromium (Playwright)** | Installed via `npx playwright install chromium` |

Optional: copy [`.env.example`](../.env.example) to `.env` if you need custom `PORT` or `DATABASE_PATH`.

## Install

```bash
npm install
npx playwright install chromium
```

## Database

Apply migrations (creates `data/flights.db` if missing):

```bash
npm run migrate
```

## First data load

Scrape Perth Airport and merge into SQLite:

```bash
npm run collect
```

Expect Playwright to launch headless Chromium. On success, logs show `Collect OK` and row counts.

## Run the board

```bash
npm run dev
```

Open **http://localhost:3000/**

The API and UI share one process (`src/api/server.ts`). The UI does **not** scrape; it only reads the database. Re-run `npm run collect` periodically to refresh data, or use [Docker scheduler](docker.md) for automatic updates.

## npm scripts

| Command | Description |
|---------|-------------|
| `npm run collect` | Fetch boards and merge into SQLite |
| `npm run migrate` | Apply SQLite migrations |
| `npm run dev` | API + flight board (port 3000) |
| `npm run start` | Same as `dev` |
| `npm run db:generate` | Generate Drizzle migrations from schema changes |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Unit tests (`node:test`) |

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_PATH` | `data/flights.db` | SQLite file path |
| `PORT` | `3000` | HTTP port |
| `SCRAPE_NEXT_DAY_HOURS_BEFORE_MIDNIGHT` | `3` | Hours before AWST midnight to prefetch tomorrow |
| `CORS_ORIGIN` | `*` | Allowed browser origin for API |

Collect interval (`SCRAPE_INTERVAL_SECONDS`) applies to Docker scheduler only.

## Windows notes

- Prefer **Node 22 LTS** over Node 24.
- If native modules fail, use [Docker](docker.md) instead.
- Port in use: `PORT=3001 npm run dev`

## Quality checks

```bash
npm run typecheck
npm run test
```

## Next steps

- [docker.md](docker.md) — production-like setup with auto-refresh
- [running-locally-docker-ngrok.md](running-locally-docker-ngrok.md) — phone access
- [scraping-and-failures.md](scraping-and-failures.md) — when collect fails
