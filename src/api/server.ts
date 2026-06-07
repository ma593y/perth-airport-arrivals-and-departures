import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { publicDir } from "../lib/paths.js";
import { getMetaForDirection, queryFlights } from "./queries.js";
import { flightsQuerySchema, metaQuerySchema } from "./schemas.js";

const port = Number(process.env.PORT ?? 3000);
const RATE_LIMIT_MAX = 120;
const RATE_LIMIT_WINDOW_MS = 60_000;

const app = new Hono();

function corsOrigin(): string | string[] {
  const raw = process.env.CORS_ORIGIN?.trim();
  if (!raw || raw === "*") return "*";
  return raw;
}

app.use(
  "*",
  cors({
    origin: corsOrigin(),
    allowMethods: ["GET", "HEAD", "OPTIONS"],
  }),
);

app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header(
    "Content-Security-Policy",
    "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; script-src 'self'",
  );
});

const rateBuckets = new Map<string, { count: number; reset: number }>();

app.use("/api/*", async (c, next) => {
  const forwarded = c.req.header("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip") ??
    "unknown";
  const now = Date.now();
  let bucket = rateBuckets.get(ip);
  if (!bucket || now >= bucket.reset) {
    bucket = { count: 0, reset: now + RATE_LIMIT_WINDOW_MS };
    rateBuckets.set(ip, bucket);
  }
  bucket.count += 1;
  if (bucket.count > RATE_LIMIT_MAX) {
    return c.json({ error: "Too many requests" }, 429);
  }
  await next();
});

app.get("/api/health", (c) => {
  const arrivals = getMetaForDirection("arrivals");
  const departures = getMetaForDirection("departures");
  const stamps = [arrivals?.lastScrapeAt, departures?.lastScrapeAt].filter(
    (s): s is string => typeof s === "string" && s.length > 0,
  );
  const lastScrapeAt =
    stamps.length > 0
      ? stamps.reduce((a, b) => (a > b ? a : b))
      : null;
  return c.json({ ok: true, lastScrapeAt });
});

app.get("/api/meta", (c) => {
  const parsed = metaQuerySchema.safeParse({
    direction: c.req.query("direction"),
  });
  if (!parsed.success) {
    return c.json({ error: "Invalid query", details: parsed.error.flatten() }, 400);
  }

  const meta = getMetaForDirection(parsed.data.direction);
  if (!meta) {
    return c.json(
      {
        error: `No data for ${parsed.data.direction}. Run npm run collect first.`,
      },
      404,
    );
  }

  return c.json(meta, 200, {
    ETag: `"${meta.scrapeRevision}"`,
    "Cache-Control": "no-cache",
  });
});

app.get("/api/flights", (c) => {
  const parsed = flightsQuerySchema.safeParse({
    direction: c.req.query("direction"),
    domInt: c.req.query("domInt") ?? "",
    terminalGroup: c.req.query("terminalGroup") ?? "",
    lastHours: c.req.query("lastHours") ?? c.req.query("hours"),
    nextHours: c.req.query("nextHours"),
    boardDate: c.req.query("boardDate") ?? "",
    hideCompleted: c.req.query("hideCompleted"),
  });

  if (!parsed.success) {
    return c.json({ error: "Invalid query", details: parsed.error.flatten() }, 400);
  }

  const result = queryFlights(parsed.data);
  if (!result) {
    return c.json(
      {
        error: `No data for ${parsed.data.direction}. Run npm run collect first.`,
      },
      404,
    );
  }

  return c.json(result, 200, {
    ETag: `"${result.meta.scrapeRevision}"`,
    "Cache-Control": "no-cache",
  });
});

app.use(
  "/*",
  serveStatic({
    root: publicDir,
    rewriteRequestPath: (p) => (p === "/" ? "/index.html" : p),
  }),
);

console.log(`Flight board: http://localhost:${port}/`);
console.log(`Database: ${process.env.DATABASE_PATH ?? "(default data/flights.db)"}`);

serve({ fetch: app.fetch, port });
