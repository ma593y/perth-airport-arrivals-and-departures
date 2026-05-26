# Contributing

This project is **not accepting contributions**.

- **No pull requests** — changes are not reviewed or merged into this repository.
- **Forking is welcome** — use the code under the [MIT License](LICENSE) and maintain your own copy.
- **No support obligation** — there is no SLA for issues or questions.

## If you want to learn from the code

- [docs/learning.md](docs/learning.md) — suggested reading order through scrape, store, API, and UI
- [docs/project-structure.md](docs/project-structure.md) — annotated directory layout
- [docs/architecture.md](docs/architecture.md) — stack and data flow

## If you run your own instance

You are an **operator**, not a contributor. See [docs/legal-and-operators.md](docs/legal-and-operators.md).

- Default collect interval is **5 minutes** (`SCRAPE_INTERVAL_SECONDS=300`). Do not increase scrape frequency without a strong reason.
- Do not add circumvention beyond the existing Playwright flow (CSRF token + in-page `fetch`).
- Comply with Perth Airport’s website terms and use data at your own risk.

## Local quality checks (for your fork)

```bash
npm run typecheck
npm run test
```
