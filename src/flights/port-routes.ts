import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { databasePath, projectRoot } from "../lib/paths.js";
import { logger } from "../lib/logger.js";
import type { FlightResult } from "../schemas/airport-api.js";
import type { ScrapeAllResult } from "../ingest/perth-airport.js";

export const routeTypeSchema = z.enum(["domestic", "international"]);

export const portRouteEntrySchema = z.object({
  routeType: routeTypeSchema,
  verified: z.boolean(),
  verifiedAt: z.string().optional(),
  firstSeen: z.string().optional(),
  inferredFrom: z.string().optional(),
  sampleFlight: z.string().optional(),
  notes: z.string().optional(),
});

export const portRoutesFileSchema = z.object({
  version: z.literal(1),
  updatedAt: z.string(),
  ports: z.record(portRouteEntrySchema),
});

export type PortRouteEntry = z.infer<typeof portRouteEntrySchema>;
export type PortRoutesFile = z.infer<typeof portRoutesFileSchema>;
export type RouteType = z.infer<typeof routeTypeSchema>;

const PORT_ROUTES_FILENAME = "port-routes.json";
const DOCKER_SEED_FILENAME = "port-routes.seed.json";

/** Writable registry next to SQLite (volume in Docker). */
export function portRoutesWritablePath(): string {
  if (process.env.PORT_ROUTES_PATH) {
    return process.env.PORT_ROUTES_PATH;
  }
  return path.join(path.dirname(databasePath()), PORT_ROUTES_FILENAME);
}

/** Baked seed in the image; local dev falls back to repo data/port-routes.json. */
export function portRoutesSeedPath(): string {
  if (process.env.PORT_ROUTES_SEED_PATH) {
    return process.env.PORT_ROUTES_SEED_PATH;
  }
  const dockerSeed = path.join(projectRoot, DOCKER_SEED_FILENAME);
  if (fs.existsSync(dockerSeed)) {
    return dockerSeed;
  }
  return path.join(projectRoot, "data", PORT_ROUTES_FILENAME);
}

type CacheState = {
  mtimeMs: number;
  sourcePath: string;
  file: PortRoutesFile;
};

let cache: CacheState | null = null;

export function resetPortRoutesCache(): void {
  cache = null;
}

function readJsonFile(filePath: string): PortRoutesFile | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return portRoutesFileSchema.parse(JSON.parse(raw) as unknown);
  } catch (err) {
    logger.warn("portRoutes", "load.parse_failed", {
      path: filePath,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

function resolveReadPath(): { filePath: string; file: PortRoutesFile } {
  const writable = portRoutesWritablePath();
  const writableFile = readJsonFile(writable);
  if (writableFile) {
    return { filePath: writable, file: writableFile };
  }

  const seed = portRoutesSeedPath();
  const seedFile = readJsonFile(seed);
  if (seedFile) {
    return { filePath: seed, file: seedFile };
  }

  const empty: PortRoutesFile = {
    version: 1,
    updatedAt: new Date().toISOString(),
    ports: {},
  };
  return { filePath: writable, file: empty };
}

/** Load registry with mtime cache (writable path, then seed fallback). */
export function loadPortRoutes(): PortRoutesFile {
  const writable = portRoutesWritablePath();
  let mtimeMs = 0;
  let sourcePath = writable;

  if (fs.existsSync(writable)) {
    mtimeMs = fs.statSync(writable).mtimeMs;
  } else {
    const seed = portRoutesSeedPath();
    if (fs.existsSync(seed)) {
      sourcePath = seed;
      mtimeMs = fs.statSync(seed).mtimeMs;
    }
  }

  if (cache && cache.mtimeMs === mtimeMs && cache.sourcePath === sourcePath) {
    return cache.file;
  }

  const resolved = resolveReadPath();
  cache = {
    mtimeMs,
    sourcePath: resolved.filePath,
    file: resolved.file,
  };
  return resolved.file;
}

export function lookupPortRouteType(
  portName: string | null | undefined,
): RouteType | null {
  if (!portName || portName.trim() === "") {
    return null;
  }
  const entry = loadPortRoutes().ports[portName];
  return entry?.routeType ?? null;
}

export function intlPortsFromFlightResults(flights: FlightResult[]): Set<string> {
  const ports = new Set<string>();
  for (const f of flights) {
    const logo = f.AirlineLogo ?? "";
    if (logo.includes("/International/") && f.PortName) {
      ports.add(f.PortName);
    }
  }
  return ports;
}

export function collectFlightResultsFromScrape(
  result: ScrapeAllResult,
): FlightResult[] {
  const flights: FlightResult[] = [];
  const push = (data: { Results: FlightResult[] } | undefined) => {
    if (data) {
      flights.push(...data.Results);
    }
  };
  push(result.departures.data);
  push(result.arrivals.data);
  push(result.nextDayDepartures?.data);
  push(result.nextDayArrivals?.data);
  return flights;
}

export type InferSource =
  | "logo-international"
  | "batch-intl-port"
  | "logo-domestic"
  | "default";

export function inferPortRouteType(
  portName: string,
  flightsForPort: FlightResult[],
  intlPorts: Set<string>,
): { routeType: RouteType; inferredFrom: InferSource; sampleFlight: string } {
  const sampleFlight = flightsForPort[0]?.FlightNumber ?? "";

  for (const f of flightsForPort) {
    const logo = f.AirlineLogo ?? "";
    if (logo.includes("/International/")) {
      return {
        routeType: "international",
        inferredFrom: "logo-international",
        sampleFlight: f.FlightNumber,
      };
    }
  }

  if (intlPorts.has(portName)) {
    return {
      routeType: "international",
      inferredFrom: "batch-intl-port",
      sampleFlight,
    };
  }

  for (const f of flightsForPort) {
    const logo = f.AirlineLogo ?? "";
    if (logo.includes("/Domestic/")) {
      return {
        routeType: "domestic",
        inferredFrom: "logo-domestic",
        sampleFlight: f.FlightNumber,
      };
    }
  }

  return {
    routeType: "domestic",
    inferredFrom: "default",
    sampleFlight,
  };
}

function loadForSync(): PortRoutesFile {
  const writable = readJsonFile(portRoutesWritablePath());
  if (writable) {
    return writable;
  }
  const seed = readJsonFile(portRoutesSeedPath());
  if (seed) {
    return seed;
  }
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    ports: {},
  };
}

function writePortRoutes(file: PortRoutesFile): void {
  const target = portRoutesWritablePath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(file, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, target);
  resetPortRoutesCache();
}

export type SyncPortRoutesResult = {
  added: number;
  skippedExisting: number;
  totalPorts: number;
};

export function syncPortRoutesFromScrape(
  result: ScrapeAllResult,
): SyncPortRoutesResult | null {
  if (!result.fetchNextDay) {
    return null;
  }

  const allFlights = collectFlightResultsFromScrape(result);
  const intlPorts = intlPortsFromFlightResults(allFlights);
  const portNames = new Set<string>();
  const flightsByPort = new Map<string, FlightResult[]>();

  for (const f of allFlights) {
    if (!f.PortName) continue;
    portNames.add(f.PortName);
    const list = flightsByPort.get(f.PortName) ?? [];
    list.push(f);
    flightsByPort.set(f.PortName, list);
  }

  const file = loadForSync();
  let added = 0;
  let skippedExisting = 0;
  const today = new Date().toISOString().slice(0, 10);

  for (const portName of [...portNames].sort()) {
    if (file.ports[portName]) {
      skippedExisting += 1;
      continue;
    }

    const flightsForPort = flightsByPort.get(portName) ?? [];
    const inferred = inferPortRouteType(portName, flightsForPort, intlPorts);

    file.ports[portName] = {
      routeType: inferred.routeType,
      verified: false,
      firstSeen: today,
      inferredFrom: inferred.inferredFrom,
      sampleFlight: inferred.sampleFlight || undefined,
    };
    added += 1;
  }

  if (added > 0) {
    file.updatedAt = new Date().toISOString();
    writePortRoutes(file);
  }

  const summary: SyncPortRoutesResult = {
    added,
    skippedExisting,
    totalPorts: Object.keys(file.ports).length,
  };

  logger.info("portRoutes", "sync.complete", summary);
  return summary;
}
