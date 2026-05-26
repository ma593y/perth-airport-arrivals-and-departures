# Workflows

Common tasks for maintaining or extending this repository (maintainer / fork owner).

## Change the UI (`public/`)

1. Edit HTML/CSS/JS.
2. Local check: `npm run dev` (no Docker rebuild needed).
3. Docker: rebuild image and recreate containers:

```bash
docker compose build
docker compose --profile scheduler up -d --force-recreate
```

Hard-refresh the browser.

## Change server or collect code (`src/`, `scripts/`)

1. Edit TypeScript.
2. Run:

```bash
npm run typecheck
npm run test
```

3. Local: restart `npm run dev`; re-run `npm run collect` if ingest changed.
4. Docker: same rebuild command as UI changes.

## Change database schema

1. Edit [`src/db/schema.ts`](../src/db/schema.ts).
2. `npm run db:generate` — produces SQL under `drizzle/`.
3. `npm run migrate` — apply locally.
4. Run collect to repopulate if needed.
5. Commit migration files; rebuild Docker image.

## Airport JSON shape changed

1. Capture a failing response (collect logs or manual fetch).
2. Update [`src/schemas/airport-api.ts`](../src/schemas/airport-api.ts).
3. Adjust [`src/db/flight-row.ts`](../src/db/flight-row.ts) if stored columns change.
4. `npm run typecheck` && `npm run test`.
5. Rebuild Docker; run collect.

See [scraping-and-failures.md](scraping-and-failures.md).

## Debug collect

```bash
npm run collect
```

Or Docker:

```bash
docker compose --profile collect run --rm collector
docker compose logs -f scheduler
```

Errors are formatted by [`src/lib/format-error.ts`](../src/lib/format-error.ts).

## Open-source doc updates

When changing behavior, update:

- [README.md](../README.md) — user-facing summary
- Relevant guide under `docs/`
- [CONTRIBUTING.md](../CONTRIBUTING.md) — only if operator policy changes

## Related docs

- [docker.md](docker.md) — Compose rebuild rules
- [learning.md](learning.md) — codebase orientation
- [legal-and-operators.md](legal-and-operators.md) — scrape policy
