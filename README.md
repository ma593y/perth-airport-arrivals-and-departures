# Perth Airport Arrivals & Departures

Unofficial live flight board for Perth Airport (PER), built for **rideshare drivers** who need a rolling view of arrivals and departures—not a static passenger lookup.

Use **last/next hour windows**, **terminal groups** (T1+T2 vs T3+T4), and **hide landed/departed** to plan pickups and drop-offs. Run it on your PC with Docker, or tunnel to your phone with ngrok. The project is also a **learning / self-host** codebase: fork it, study how scraping → SQLite → API → UI fits together, and run your own instance.

**[Legal / data source](#legal--data-source)** · [Documentation](docs/README.md) · [MIT License](LICENSE)

## Why this exists

The official Perth Airport app and website work well for passengers checking a single flight. For rideshare work you often need a **time-bounded board**: what landed or departed in the last hour, what is coming in the next few hours, split by domestic/international and by terminal area—without scrolling through a full day.

This board optimizes for that workflow:

- **Last 1h + next 6h** by default (configurable up to 24h each way)
- **Terminal groups** aligned with common PER pickup zones (T1+T2, T3+T4)
- **Hide Landed / Hide Departed** to focus on active movements
- **Mobile-friendly** filters and optional [ngrok](docs/running-locally-docker-ngrok.md) access from your phone

It is **not** a commercial product and **not** affiliated with Perth Airport. It is open source for download, fork, and personal/self-hosted use.

## Not accepting contributions

This repository is published for **learning and self-hosting**. You may fork and modify it under the [MIT License](LICENSE).

- **No pull requests** — patches are not reviewed or merged here.
- **No support SLA** — use issues only if you choose; there is no obligation to respond.
- **Fork freely** — run your own copy; you are responsible for compliance when operating a collector (see [Legal / data source](#legal--data-source) and [docs/legal-and-operators.md](docs/legal-and-operators.md)).

To study the code, start with [docs/learning.md](docs/learning.md).

## Features

### Flight board (rideshare-oriented)

| Feature | Detail |
|---------|--------|
| Arrivals / departures | Separate boards; **saved filters per direction** in `localStorage` |
| Time windows | **Last** 1–24h (default **1h**) + **Next** 1–24h (default **6h**) |
| Terminal groups | **T1+T2**, **T3+T4**, **Others** |
| Domestic / international | Filter by route type (derived from airline/port metadata) |
| International row highlight | Subtle styling for international flights (`row-international` in `public/styles.css`) |
| Board date | Today, yesterday, tomorrow labels from retained DB dates |
| Hide completed | Hide **Landed** (arrivals) or **Departed** (departures) |
| Now divider | Visual “current time” line when viewing today (or all dates) |
| Hour striping | Alternating hour-band accent on the time column |
| Rich rows | Estimated + scheduled times; status styling; terminal · route; flight + port |
| Live updates | Polls `/api/meta` every 60s; refetches when `scrapeRevision` changes |
| Mobile UX | Collapsible filter drawer; result count in header; all times **AWST** |

### Under the hood

| Feature | Detail |
|---------|--------|
| Collect | Playwright loads the official page; in-browser POST with CSRF (same flow as the site) |
| Validation | Zod schemas for airport JSON |
| Efficient writes | Content-hash compare; upsert only changed flights |
| Retention | Yesterday + today in SQLite; **tomorrow** during prefetch window before AWST midnight |
| Database | SQLite with WAL; **one writer** (collect/scheduler), many readers (API) |
| API | Read-only Hono: `/api/health`, `/api/meta`, `/api/flights` |
| Hardening | Rate limit, CORS, security headers, ETag on API responses |
| Docker | `api`, one-shot `collector`, periodic `scheduler` (default every 5 minutes) |
| Phone access | [Docker + ngrok guide](docs/running-locally-docker-ngrok.md) |

## Quick start (local)

**Node.js 22 LTS** required (`node -v` → `v22.x`). Full steps: [docs/setup.md](docs/setup.md).

```bash
npm install
npx playwright install chromium
npm run migrate
npm run collect
npm run dev
```

Open **http://localhost:3000/**

## Docker (recommended)

```bash
docker compose build
docker compose --profile collect run --rm collector
docker compose --profile scheduler up -d
```

Open **http://localhost:3000/**. For mobile access via ngrok, see [docs/running-locally-docker-ngrok.md](docs/running-locally-docker-ngrok.md). Service details: [docs/docker.md](docs/docker.md).

After changing `public/`, `src/`, `scripts/`, `Dockerfile`, or `docker-compose.yml`:

```bash
docker compose build
docker compose --profile scheduler up -d --force-recreate
```

## Documentation

| Guide | Contents |
|-------|----------|
| [docs/README.md](docs/README.md) | Documentation index and reading order |
| [docs/setup.md](docs/setup.md) | Local development setup |
| [docs/docker.md](docs/docker.md) | Compose services, profiles, rebuild workflow |
| [docs/running-locally-docker-ngrok.md](docs/running-locally-docker-ngrok.md) | Phone access with ngrok |
| [docs/architecture.md](docs/architecture.md) | Stack and data flow |
| [docs/project-structure.md](docs/project-structure.md) | Directory layout |
| [docs/api.md](docs/api.md) | HTTP API reference |
| [docs/workflows.md](docs/workflows.md) | Maintainer workflows |
| [docs/learning.md](docs/learning.md) | Code study path |
| [docs/legal-and-operators.md](docs/legal-and-operators.md) | Legal notice and operator duties |
| [docs/scraping-and-failures.md](docs/scraping-and-failures.md) | Collect failures and recovery |

## Legal / data source

This project is **not affiliated with Perth Airport**. Flight data is obtained by automated access to the [official flights page](https://www.perthairport.com.au/flights/departures-and-arrivals). That access may be restricted by site terms; **each operator** of a collector instance is responsible for compliance.

Data is provided **as-is** with no warranty of accuracy or timeliness—always confirm at the [official flight board](https://www.perthairport.com.au/flights/departures-and-arrivals) before travel or pickup decisions.

The [MIT License](LICENSE) applies to **this software** only. It does not grant rights to redistribute Perth Airport flight data or override their terms.

## License

Licensed under the [MIT License](LICENSE).

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Docker: empty board | `docker compose --profile collect run --rm collector` |
| No data / 404 from API | Run `npm run collect` after `npm run migrate` |
| Node 24 on Windows | Use Docker or install Node 22 LTS |
| Port in use | `PORT=3001 npm run dev` (or set `PORT` in `.env` for Docker) |
| Playwright browser missing | `npx playwright install chromium` |
| Collect failures | [docs/scraping-and-failures.md](docs/scraping-and-failures.md) |
