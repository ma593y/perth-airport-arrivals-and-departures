# Documentation

Guides for running, studying, and operating this unofficial Perth Airport flight board.

## Recommended reading order

### Rideshare driver (use the board)

1. [../README.md](../README.md) — what it does and quick start
2. [setup.md](setup.md) or [docker.md](docker.md) — get it running
3. [running-locally-docker-ngrok.md](running-locally-docker-ngrok.md) — open the board on your phone

### Learner (study the code)

1. [architecture.md](architecture.md) — stack and data flow
2. [project-structure.md](project-structure.md) — where files live
3. [learning.md](learning.md) — file-by-file study path
4. [api.md](api.md) — HTTP API shapes

### Operator (self-host a collector)

1. [legal-and-operators.md](legal-and-operators.md) — compliance and responsibilities
2. [docker.md](docker.md) — Compose services and rebuild rules
3. [scraping-and-failures.md](scraping-and-failures.md) — when collect fails

### Maintainer (change the project)

1. [workflows.md](workflows.md) — edit → test → Docker rebuild
2. [scraping-and-failures.md](scraping-and-failures.md) — debug ingest

## All guides

| Guide | Description |
|-------|-------------|
| [setup.md](setup.md) | Local development (Node 22, Playwright, migrate, collect, dev) |
| [docker.md](docker.md) | Docker Compose services, profiles, env vars, rebuild |
| [running-locally-docker-ngrok.md](running-locally-docker-ngrok.md) | Mobile access via ngrok |
| [architecture.md](architecture.md) | Technology stack and system design |
| [project-structure.md](project-structure.md) | Repository layout |
| [api.md](api.md) | REST API reference |
| [workflows.md](workflows.md) | Development workflows |
| [learning.md](learning.md) | How to read the codebase |
| [legal-and-operators.md](legal-and-operators.md) | Legal notice and operator duties |
| [scraping-and-failures.md](scraping-and-failures.md) | Collect errors and recovery |
