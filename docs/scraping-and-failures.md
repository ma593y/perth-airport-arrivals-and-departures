# Scraping and collect failures

This app loads flight boards by driving the [official Perth Airport flights page](https://www.perthairport.com.au/flights/departures-and-arrivals) in headless Chromium, then POSTing to the same `GetFlightResults` endpoint the site uses.

**See also:** [architecture.md](architecture.md) (collect path) · [workflows.md](workflows.md) (debug and schema fixes) · [legal-and-operators.md](legal-and-operators.md) (scrape interval policy)

## What can go wrong

| Symptom | Likely cause | What to check |
|---------|----------------|---------------|
| Collect hangs then times out | Cloudflare challenge | Page title contains “Just a moment”; see scheduler logs |
| `JSON parse failed (response looks like HTML)` | Challenge or error page instead of JSON | Run `npm run collect` locally with visible browser debugging if needed |
| `Schema validation failed` | API JSON shape changed | Compare a captured response to `src/schemas/airport-api.ts`; update Zod schema |
| `CSRF token missing` | Page structure changed | Selector `input[name="__RequestVerificationToken"]` |
| Empty board after collect | No rows for retained dates | `allowedBoardDates` in collect logs; run collect during active flight hours |
| `database is locked` | Two writers at once | Do not run `collector` and `scheduler` collects overlapping |

## Logs

```bash
docker compose logs -f scheduler
# or
npm run collect
```

Successful scheduler output includes `Collect OK`. Failed runs print a formatted error from `src/lib/format-error.ts` with context (nature, date, URL).

## Recovery

1. `docker compose --profile collect run --rm collector` (one-off)
2. If schema changed: fix `src/schemas/airport-api.ts` and redeploy
3. If Cloudflare blocks the container IP: wait and retry; avoid increasing scrape frequency

## Related

- [README.md](../README.md) — overview and troubleshooting
- [docker.md](docker.md) — Compose services and single-writer rule
- [setup.md](setup.md) — local `npm run collect`
- [learning.md](learning.md) — `src/ingest/perth-airport.ts` walkthrough
- [running-locally-docker-ngrok.md](running-locally-docker-ngrok.md) — Docker + ngrok
