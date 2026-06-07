# Contributing

This project is **not accepting contributions**.

- **No pull requests** — changes are not reviewed or merged into this repository.
- **Forking is welcome** — use the code under the [MIT License](LICENSE) and maintain your own copy.
- **No support obligation** — there is no SLA for issues or questions.

## If you run your own instance

You are an **operator**, not a contributor.

- Default collect interval is **1 minute** (`SCRAPE_INTERVAL_SECONDS=60`). Do not increase scrape frequency without a strong reason.
- Do not add circumvention beyond the existing Playwright flow (CSRF token + in-page `fetch`).
- Comply with Perth Airport’s website terms and use data at your own risk.

## Local quality checks (for your fork)

```bash
npm run typecheck
npm run test
```
