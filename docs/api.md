# HTTP API

Read-only JSON API served by Hono alongside the static UI. Implementation: [`src/api/server.ts`](../src/api/server.ts). Schemas: [`src/api/schemas.ts`](../src/api/schemas.ts).

Base URL: `http://localhost:3000` (or your host / ngrok origin).

## Security

- **No authentication** — designed for local or personal tunnel use.
- **Rate limit:** 120 requests per minute per IP on `/api/*` (429 when exceeded).
- **Headers:** `X-Content-Type-Options`, `X-Frame-Options`, Content-Security-Policy.
- **CORS:** `CORS_ORIGIN` env (default `*`).

Do not expose on the public internet without understanding the risk. See [running-locally-docker-ngrok.md](running-locally-docker-ngrok.md#security-when-using-ngrok).

## Endpoints

### `GET /api/health`

Uptime check for monitoring.

**Response:**

```json
{
  "ok": true,
  "lastScrapeAt": "2026-05-27T12:34:56.789Z"
}
```

`lastScrapeAt` is the newer of arrivals/departures meta timestamps, or `null` if no data.

---

### `GET /api/meta`

Metadata for one board direction.

**Query parameters:**

| Param | Required | Values |
|-------|----------|--------|
| `direction` | yes | `arrivals` \| `departures` |

**Example:**

```
GET /api/meta?direction=arrivals
```

**Response fields** (see `storeMetaResponseSchema`):

| Field | Description |
|-------|-------------|
| `boardDate` | Primary board date (AWST `YYYY-MM-DD`) |
| `retainedBoardDates` | Dates still in DB (for date filter dropdown) |
| `apiDateAwst` | Date string from last API payload |
| `lastScrapeAt` | ISO timestamp of last successful collect for this nature |
| `lastApiUpdated` | LastUpdated from airport API when available |
| `scrapeRevision` | Changes when collect writes; UI uses for refresh |
| `flightCount` | Rows stored for this nature |
| `nextDayPrefetch` | Whether tomorrow is in retention |
| `nextDayHoursBeforeMidnight` | Prefetch window setting |

**Errors:** `400` invalid query; `404` no data for direction (run collect first).

**Caching:** `ETag` header set from `scrapeRevision`.

---

### `GET /api/flights`

Filtered flight list with meta.

**Query parameters:**

| Param | Default | Values |
|-------|---------|--------|
| `direction` | (required) | `arrivals` \| `departures` |
| `domInt` | `""` | `""` \| `domestic` \| `international` |
| `terminalGroup` | `""` | `""` \| `t1t2` \| `t3t4` \| `others` |
| `lastHours` | `1` | `1` \| `2` \| `4` \| `6` \| `12` \| `24` |
| `nextHours` | `6` | `1` \| `2` \| `4` \| `6` \| `12` \| `24` |
| `boardDate` | `""` | `YYYY-MM-DD` or empty (all retained dates) |
| `hideCompleted` | `false` | `true` \| `false` (also `1` / `0`) |

`hours` is accepted as an alias for `lastHours`.

**Example (default rideshare-style window):**

```
GET /api/flights?direction=arrivals&lastHours=1&nextHours=6&hideCompleted=true
```

**Example (T1+T2 domestic departures):**

```
GET /api/flights?direction=departures&terminalGroup=t1t2&domInt=domestic&lastHours=2&nextHours=4
```

**Response:**

```json
{
  "meta": { "...": "same as /api/meta" },
  "flights": [ "... array of flight objects ..." ]
}
```

Flight objects extend the airport API shape with derived fields such as `_scheduledAt`, `_estimatedAt`, `_routeType`, `_boardDate`. See [`src/schemas/airport-api.ts`](../src/schemas/airport-api.ts).

**Limits:** SQL query capped at `MAX_FLIGHTS` (500) per request.

**Errors:** `400` invalid query; `404` no store meta for direction.

**Caching:** `ETag` from `meta.scrapeRevision`.

## Static UI

| Path | Description |
|------|-------------|
| `/` | Flight board (`public/index.html`) |
| `/app.js`, `/styles.css` | Assets |

The UI uses relative `/api/*` URLs so the same origin works behind ngrok.

## Related docs

- [architecture.md](architecture.md) — query pipeline in `src/api/queries.ts`
- [learning.md](learning.md) — how filters map to `src/flights/flight-filters.ts`
