# Legal notice and operator responsibilities

This document expands the [README legal section](../README.md#legal--data-source) for anyone who **runs** a collector or hosts a copy of the board—not for casual readers only.

*This is not legal advice. Consult a qualified professional for your situation.*

## Non-affiliation

- This project is **not affiliated with**, endorsed by, or sponsored by **Perth Airport** or any airline.
- Do not use Perth Airport logos or branding in a way that implies official status.
- Describe the project as an **unofficial** flight board.

## Data source

Flight information is obtained by **automated access** to the [official Perth Airport departures and arrivals page](https://www.perthairport.com.au/flights/departures-and-arrivals), using the same in-page request mechanism the public site uses (see [`src/ingest/perth-airport.ts`](../src/ingest/perth-airport.ts)).

That access may be restricted or prohibited by the airport’s **terms of use**, **robots** guidance, or other policies. **You** are responsible for reading and complying with those terms when you operate a collector.

## Software vs data

| | Covered by MIT License? | Notes |
|---|-------------------------|--------|
| **This repository’s source code** | Yes | See [LICENSE](../LICENSE) |
| **Perth Airport flight data** | No | MIT does not grant rights to copy or redistribute their data |
| **Your obligations** | N/A | Compliance with airport terms is on each operator |

Forking the code is allowed under MIT. Redisplaying scraped flight data is a separate question governed by the airport’s terms and applicable law.

## Accuracy and reliance

- Data may be **delayed, incomplete, or wrong**.
- The board is for **personal planning** (e.g. rideshare pickups)—not for aviation, safety, or commercial scheduling decisions.
- Users must **confirm** times on the [official flight board](https://www.perthairport.com.au/flights/departures-and-arrivals) before acting.

## Operator duties (self-host / fork)

If you run `npm run collect`, Docker `scheduler`, or equivalent:

1. **Scrape politely** — default interval is **5 minutes** (`SCRAPE_INTERVAL_SECONDS=300`). Do not increase frequency without strong justification.
2. **No extra circumvention** — do not bypass Cloudflare or access controls beyond the existing Playwright flow documented in the repo.
3. **One writer** — do not run overlapping collects against the same database (see [docker.md](docker.md)).
4. **Secure exposure** — the API has **no login**. Do not leave public tunnels (e.g. ngrok) open when unused. See [running-locally-docker-ngrok.md](running-locally-docker-ngrok.md).
5. **Personal / self-host** — this project is not positioned as a commercial data service.

## Contributions

This upstream repository does **not** accept pull requests. If you fork, **you** are the operator of your deployment and responsible for how it is used.

## Related docs

- [CONTRIBUTING.md](../CONTRIBUTING.md) — no contributions; fork policy
- [scraping-and-failures.md](scraping-and-failures.md) — technical collect issues
