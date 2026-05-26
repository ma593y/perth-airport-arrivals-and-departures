# Learning guide

A suggested path through the codebase for developers studying how a scrape → store → API → UI pipeline fits together. No prior knowledge of this repo required.

## What you will learn

- Driving a **real browser** to reuse the site’s own API (CSRF, cookies, Cloudflare session)
- **Validating** external JSON with Zod
- **Incremental writes** with content hashing
- **SQLite** as a small read-heavy cache with one writer
- A **read-only HTTP API** and a **vanilla** front end that polls for freshness

## Study path

### 1. Scrape flow (start here)

| File | Focus on |
|------|----------|
| [`src/ingest/perth-airport.ts`](../src/ingest/perth-airport.ts) | `FLIGHTS_URL`, page load, CSRF token, `page.evaluate` POST to `GetFlightResults` |
| [`src/schemas/airport-api.ts`](../src/schemas/airport-api.ts) | Shape of airport JSON; `flightResultsResponseSchema` |
| [`scripts/collect.ts`](../scripts/collect.ts) | Orchestration: scrape → merge per nature → logging |

**Questions to answer:** Why fetch inside the browser instead of `fetch` from Node? What happens if CSRF is missing?

### 2. Merge and retention

| File | Focus on |
|------|----------|
| [`src/flights/flight-hash.ts`](../src/flights/flight-hash.ts) | Canonical JSON for SHA-256 hash |
| [`src/flights/flight-store.ts`](../src/flights/flight-store.ts) | Upsert only when hash changes; prune by `allowedBoardDates` |
| [`src/config/dates.ts`](../src/config/dates.ts) | AWST board dates, cutoffs for API queries |
| [`src/config/config.ts`](../src/config/config.ts) | Tomorrow prefetch window |

**Questions to answer:** Why hash rows instead of blind upsert? How is “today” defined?

### 3. Filters and sorting

| File | Focus on |
|------|----------|
| [`src/flights/flight-filters.ts`](../src/flights/flight-filters.ts) | Terminal groups, domestic/intl derivation, `hideCompleted`, sort keys |
| [`src/api/queries.ts`](../src/api/queries.ts) | SQL time window + `applyClientFilters` |
| [`src/flights/flight-filters.test.ts`](../src/flights/flight-filters.test.ts) | Examples of filter behavior |

**Questions to answer:** What runs in SQL vs in JavaScript? How is “completed” defined for arrivals vs departures?

### 4. API layer

| File | Focus on |
|------|----------|
| [`src/api/server.ts`](../src/api/server.ts) | Routes, rate limit, CORS, CSP, static files |
| [`src/api/schemas.ts`](../src/api/schemas.ts) | Query param coercion (e.g. `lastHours`, `hideCompleted`) |
| [`src/db/schema.ts`](../src/db/schema.ts) | Tables `flights` and `store_meta` |

Read [api.md](api.md) alongside `server.ts`.

### 5. UI and UX

| File | Focus on |
|------|----------|
| [`public/index.html`](../public/index.html) | Filter controls (rideshare-oriented defaults) |
| [`public/app.js`](../public/app.js) | `filterQueryParams`, `localStorage` per direction, meta poll, `scrapeRevision` refresh, now-divider, hour striping |
| [`public/styles.css`](../public/styles.css) | Mobile filter drawer, status colors |

**Questions to answer:** When does the table refetch without a full page reload? How are filters persisted across arrivals/departures?

### 6. Operations

| File | Focus on |
|------|----------|
| [`docker-compose.yml`](../docker-compose.yml) | `api`, `collector`, `scheduler` profiles |
| [`docker/scrape-loop.sh`](../docker/scrape-loop.sh) | Scheduler interval |
| [scraping-and-failures.md](scraping-and-failures.md) | Production failure modes |

## Exercises (optional)

1. Add a query param or filter and thread it from `schemas.ts` → `queries.ts` → `app.js`.
2. Log hash skip vs upsert counts from `flight-store.ts` during collect.
3. Trace one flight from airport JSON → DB row → API response → table row HTML.

## Tests

```bash
npm run test
```

Tests live next to modules (`src/config/dates.test.ts`, `src/flights/*.test.ts`).

## Related docs

- [project-structure.md](project-structure.md) — directory map
- [architecture.md](architecture.md) — diagrams and stack
- [setup.md](setup.md) — run it locally
