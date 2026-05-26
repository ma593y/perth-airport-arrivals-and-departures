# Docker

Run the API, one-shot collect, and periodic scheduler with Docker Compose. All services share one SQLite volume.

## Prerequisites

- Docker Desktop or Docker Engine + Compose v2
- BuildKit enabled (default on Docker Desktop) for faster rebuilds

## Services

| Service | Profile | Keeps running? | Role |
|---------|---------|----------------|------|
| `api` | (default) | Yes | Serves UI + `/api/*`; **read-only** DB |
| `collector` | `collect` | No | One scrape, then exits |
| `scheduler` | `scheduler` | Yes | Scrape every `SCRAPE_INTERVAL_SECONDS` (default 300) |

Defined in [docker-compose.yml](../docker-compose.yml).

## First-time setup

```bash
docker compose build
docker compose --profile collect run --rm collector
docker compose --profile scheduler up -d
```

Open **http://localhost:3000/**

- `build` — image includes Node 22, app code, Playwright Chromium
- `collector` — initial data load into volume `flight-data`
- `scheduler` — starts `api` + `scheduler` (recommended daily use)

## Everyday use

```bash
docker compose --profile scheduler up -d
```

API-only (board will not auto-update until you collect manually):

```bash
docker compose up -d api
```

## After code changes

The image **copies** `public/`, `src/`, and `scripts/` at build time. Restarting containers alone does **not** pick up disk edits.

```bash
docker compose build
docker compose --profile scheduler up -d --force-recreate
```

Hard-refresh the browser if the UI looks cached.

**API only** (no scheduler):

```bash
docker compose build api
docker compose up -d --force-recreate api
```

Rebuilds after `public/` or `src/` edits are usually fast (Playwright layer cached unless `package-lock.json` or `Dockerfile` changes).

## Useful commands

| Command | Description |
|---------|-------------|
| `docker compose build` | Build image `perth-airport-arrivals-and-departures:latest` |
| `docker compose up -d api` | API only |
| `docker compose --profile collect run --rm collector` | One-off collect |
| `docker compose --profile scheduler up -d` | API + scheduler |
| `docker compose logs -f api` | API logs |
| `docker compose logs -f scheduler` | Collect loop logs (`Collect OK` on success) |
| `docker compose down` | Stop containers (volume keeps DB) |
| `docker compose ps` | Running services |

## Environment variables

Set in `.env` or shell; Compose passes them through:

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3000` | Host port mapped to API |
| `DATABASE_PATH` | `/app/data/flights.db` in containers | SQLite path (set in compose) |
| `SCRAPE_INTERVAL_SECONDS` | `300` | Scheduler interval |
| `SCRAPE_NEXT_DAY_HOURS_BEFORE_MIDNIGHT` | `3` | Tomorrow prefetch window |
| `CORS_ORIGIN` | `*` | API CORS (set ngrok URL when tunneling) |
| `TZ` | `Australia/Perth` | Container timezone |

## Single writer rule

- **Do not** run `collector` while `scheduler` is mid-scrape.
- **Do** run `api` + `scheduler` together for normal operation.
- Only **one** collect process should write to `flights.db` at a time.

## Empty or stale board

| Symptom | Action |
|---------|--------|
| Empty board | `docker compose --profile collect run --rm collector` or wait for scheduler’s first run |
| Stale data | Confirm scheduler is up: `docker compose --profile scheduler up -d` |
| Old UI after git pull | Rebuild and `--force-recreate` (see above) |

## Mobile access

Docker exposes port 3000 on the host. Use [running-locally-docker-ngrok.md](running-locally-docker-ngrok.md) to tunnel from your phone.

## Related docs

- [setup.md](setup.md) — local dev without Docker
- [architecture.md](architecture.md) — data flow
- [scraping-and-failures.md](scraping-and-failures.md) — collect errors
