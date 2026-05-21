import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { publicDir } from "../lib/paths.js";
import { getMetaForDirection, queryFlights } from "./queries.js";
import {
  flightsQuerySchema,
  flightsResponseSchema,
  metaQuerySchema,
  storeMetaResponseSchema,
} from "./schemas.js";

const port = Number(process.env.PORT ?? 3000);

const app = new Hono();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "HEAD", "OPTIONS"],
  }),
);

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

  const body = storeMetaResponseSchema.parse(meta);
  return c.json(body, 200, {
    ETag: `"${body.scrapeRevision}"`,
    "Cache-Control": "no-cache",
  });
});

app.get("/api/flights", (c) => {
  const parsed = flightsQuerySchema.safeParse({
    direction: c.req.query("direction"),
    domInt: c.req.query("domInt") ?? "",
    terminalGroup: c.req.query("terminalGroup") ?? "",
    hours: c.req.query("hours"),
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

  const body = flightsResponseSchema.parse(result);
  return c.json(body, 200, {
    ETag: `"${body.meta.scrapeRevision}"`,
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
