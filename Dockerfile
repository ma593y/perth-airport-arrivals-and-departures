# syntax=docker/dockerfile:1
# Node 22 LTS: prebuilt better-sqlite3; Playwright installs Chromium + OS deps
FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV DATABASE_PATH=/app/data/flights.db
ENV PORT=3000

COPY package.json package-lock.json ./
# Install all deps (tsx, playwright are devDependencies but required at runtime)
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Chromium + Debian libraries required by Playwright (before COPY so UI edits stay cached).
# Browsers must land in the image layer (not a cache mount — mounts are not exported to the final image).
RUN npx playwright install --with-deps chromium

COPY . .

ENV NODE_ENV=production

RUN sed -i 's/\r$//' docker/*.sh \
  && chmod +x docker/entrypoint-api.sh docker/entrypoint-collect.sh docker/scrape-loop.sh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["docker/entrypoint-api.sh"]
