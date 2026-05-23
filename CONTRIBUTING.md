# Contributing

Thanks for your interest in this project.

## Setup

- **Node.js 22 LTS** (`node -v` should show `v22.x`)
- `npm install`
- `npx playwright install chromium` (for collect)
- `npm run migrate`

## Before opening a PR

```bash
npm run typecheck
npm run test
```

CI runs the same checks on push and pull requests to `main`.

## Docker

After changing `public/`, `src/`, `scripts/`, `Dockerfile`, or `docker-compose.yml`:

```bash
docker compose build
docker compose --profile scheduler up -d --force-recreate
```

## Scraping policy

- Default collect interval is **5 minutes** (`SCRAPE_INTERVAL_SECONDS=300`). Do not increase scrape frequency without discussion.
- Do not add circumvention beyond the existing Playwright flow (CSRF token + in-page `fetch`).
- Automated access to Perth Airport’s website may be restricted by their terms. Contributors and operators are responsible for compliance. See README **Legal / data source**.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
