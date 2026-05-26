# Project structure

Annotated layout of the repository. Paths are relative to the repo root.

```
perth-airport-arrivals-and-departures/
├── public/                 # Static flight board UI (served by Hono)
│   ├── index.html          # Filters, table, footer disclaimer
│   ├── app.js              # API client, filters, rendering, localStorage
│   └── styles.css          # Board styling (mobile filter drawer, status colors)
├── src/
│   ├── api/
│   │   ├── server.ts       # Hono app: static files, /api/*, rate limit, CORS, CSP
│   │   ├── queries.ts      # SQL flight queries + filter pipeline
│   │   └── schemas.ts      # Zod query/response schemas for API
│   ├── config/
│   │   ├── config.ts       # Prefetch window env parsing
│   │   └── dates.ts        # AWST date/time helpers
│   ├── db/
│   │   ├── schema.ts       # Drizzle table definitions (flights, store_meta)
│   │   ├── client.ts       # SQLite connection (WAL)
│   │   ├── flight-row.ts   # Row ↔ API flight mapping
│   │   ├── store-meta.ts   # Read store metadata
│   │   └── paths.ts        # DATABASE_PATH resolution
│   ├── flights/
│   │   ├── flight-store.ts # Merge scrape results into DB (hash, prune)
│   │   ├── flight-hash.ts  # Canonical payload hashing
│   │   └── flight-filters.ts # Terminal groups, route type, sort, completed
│   ├── ingest/
│   │   └── perth-airport.ts # Playwright scrape + in-page fetch
│   ├── schemas/
│   │   └── airport-api.ts  # Zod schemas for Perth Airport JSON
│   └── lib/
│       ├── format-error.ts # Collect error formatting
│       ├── paths.ts        # public/ directory path
│       └── log-path.ts     # Repo-relative paths in logs
├── scripts/
│   ├── collect.ts          # CLI entry: scrape → merge → log summary
│   └── migrate.ts          # Apply Drizzle migrations
├── docker/
│   ├── entrypoint-api.sh   # Start API server
│   ├── entrypoint-collect.sh # One-shot collect
│   └── scrape-loop.sh      # Scheduler sleep loop
├── drizzle/                # SQL migrations (generated/applied)
├── docs/                   # Documentation (this folder)
├── docker-compose.yml      # api, collector, scheduler services
├── Dockerfile              # Node 22 image with Playwright Chromium
├── package.json            # Scripts and dependencies
├── drizzle.config.ts       # Drizzle kit config
├── LICENSE                 # MIT
├── README.md               # Project landing page
└── CONTRIBUTING.md         # No contributions; fork and operator notes
```

## Key entry points

| Task | Entry |
|------|--------|
| Run API + UI locally | `npm run dev` → `src/api/server.ts` |
| One collect | `npm run collect` → `scripts/collect.ts` |
| Migrations | `npm run migrate` → `scripts/migrate.ts` |
| Tests | `npm run test` → `src/**/*.test.ts` |

## Data file (not in git)

| Path | Purpose |
|------|---------|
| `data/flights.db` | SQLite database (created by migrate + collect) |

Listed in `.gitignore`. In Docker, stored on the `flight-data` volume at `/app/data/flights.db`.

## Related docs

- [architecture.md](architecture.md) — how components connect
- [learning.md](learning.md) — what to read in each folder
