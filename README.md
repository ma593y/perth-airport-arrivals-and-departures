# Perth Airport Arrivals & Departures

Unofficial live flight board for Perth Airport (PER), built for **rideshare drivers** who need a rolling view of arrivals and departures—not a static passenger lookup.

Use **last/next hour windows**, **terminal groups** (T1+T2 vs T3+T4), and **hide landed/departed** to plan pickups and drop-offs. Run it on your PC with Docker, or tunnel to your phone with ngrok.

**[Legal / data source](#legal--data-source)** · [MIT License](LICENSE)

## Why this exists

The official Perth Airport app and website work well for passengers checking a single flight. For rideshare work you often need a **time-bounded board**: what landed or departed in the last hour, what is coming in the next few hours, split by domestic/international and by terminal area—without scrolling through a full day.

This board optimizes for that workflow:

- **Last 1h + next 6h** by default (configurable up to 24h each way)
- **Terminal groups** aligned with common PER pickup zones (T1+T2, T3+T4)
- **Hide Landed / Hide Departed** to focus on active movements
- **Mobile-friendly** filters and optional ngrok access from your phone

It is **not** a commercial product and **not** affiliated with Perth Airport. It is open source for download, fork, and personal/self-hosted use.

## Not accepting contributions

This repository is published for **learning and self-hosting**. You may fork and modify it under the [MIT License](LICENSE).

- **No pull requests** — patches are not reviewed or merged here.
- **No support SLA** — use issues only if you choose; there is no obligation to respond.
- **Fork freely** — run your own copy; you are responsible for compliance when operating a collector (see [Legal / data source](#legal--data-source)).

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
| Database | SQLite with WAL; single writer (scrape loop), readers (API) |
| API | Read-only Hono: `/api/health`, `/api/meta`, `/api/flights` |
| Hardening | Rate limit, CORS, security headers, ETag on API responses |
| Docker | Single `app` container: API + scrape loop (default every 1 minute) |

## Quick start (local)

**Node.js 22 LTS** required (`node -v` → `v22.x`).

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
docker compose up -d
```

Open **http://localhost:3000/**

After changing `public/`, `src/`, `scripts/`, `Dockerfile`, or `docker-compose.yml`:

```bash
docker compose build
docker compose up -d --force-recreate
```

Logs: `docker compose logs -f app`

## Legal / data source

This project is **not affiliated with Perth Airport**. Flight data is obtained by automated access to the [official flights page](https://www.perthairport.com.au/flights/departures-and-arrivals). That access may be restricted by site terms; **each operator** of a collector instance is responsible for compliance.

Data is provided **as-is** with no warranty of accuracy or timeliness—always confirm at the [official flight board](https://www.perthairport.com.au/flights/departures-and-arrivals) before travel or pickup decisions.

The [MIT License](LICENSE) applies to **this software** only. It does not grant rights to redistribute Perth Airport flight data or override their terms.

## License

Licensed under the [MIT License](LICENSE).

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Docker: empty board | Wait for first collect or check `docker compose logs -f app` for `Collect OK` |
| No data / 404 from API | Run `npm run collect` after `npm run migrate` |
| Node 24 on Windows | Use Docker or install Node 22 LTS |
| Port in use | `PORT=3001 npm run dev` (or set `PORT` in `.env` for Docker) |
| Playwright browser missing | `npx playwright install chromium` |
| Collect failures | Check `docker compose logs -f app` for error output |
