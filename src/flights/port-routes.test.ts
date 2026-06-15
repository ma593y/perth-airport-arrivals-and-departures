import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { FlightResult } from "../schemas/airport-api.js";
import type { ScrapeAllResult } from "../ingest/perth-airport.js";
import {
  inferPortRouteType,
  intlPortsFromFlightResults,
  loadPortRoutes,
  lookupPortRouteType,
  resetPortRoutesCache,
  syncPortRoutesFromScrape,
} from "./port-routes.js";

function flight(overrides: Partial<FlightResult> = {}): FlightResult {
  return {
    AirlineLogo: "/Domestic/Qantas.png",
    AirlineName: "Qantas",
    FlightNumber: "QF400",
    PortName: "Melbourne",
    Nature: "Departure",
    Terminal: "T3",
    EstimatedTime: "14:30",
    ScheduledTime: "14:00",
    Status: null,
    Remark: "On-time",
    Url: "/flights/qf400",
    FlightKey: "qf40020260616d",
    CodeShares: [],
    ...overrides,
  };
}

function scrapeResult(
  flights: FlightResult[],
  fetchNextDay = true,
): ScrapeAllResult {
  const payload = { LastUpdated: "/Date(0)/", Results: flights };
  return {
    date: "6/16/2026",
    fetchNextDay,
    departures: { nature: "Departures", data: payload, lastUpdated: null },
    arrivals: { nature: "Arrivals", data: { LastUpdated: "/Date(0)/", Results: [] }, lastUpdated: null },
    nextDayDepartures: fetchNextDay
      ? { nature: "Departures", data: payload, lastUpdated: null }
      : undefined,
    nextDayArrivals: fetchNextDay
      ? { nature: "Arrivals", data: { LastUpdated: "/Date(0)/", Results: [] }, lastUpdated: null }
      : undefined,
  };
}

describe("intlPortsFromFlightResults", () => {
  it("collects ports with international logos", () => {
    const ports = intlPortsFromFlightResults([
      flight({ PortName: "Singapore", AirlineLogo: "/International/SQ.png" }),
      flight({ PortName: "Melbourne", AirlineLogo: "/Domestic/QF.png" }),
    ]);
    assert.equal(ports.has("Singapore"), true);
    assert.equal(ports.has("Melbourne"), false);
  });
});

describe("inferPortRouteType", () => {
  it("prefers international logo", () => {
    const result = inferPortRouteType(
      "Singapore",
      [flight({ PortName: "Singapore", AirlineLogo: "/International/SQ.png" })],
      new Set(),
    );
    assert.equal(result.routeType, "international");
    assert.equal(result.inferredFrom, "logo-international");
  });

  it("uses batch intl port when only domestic logos", () => {
    const result = inferPortRouteType(
      "Singapore",
      [flight({ PortName: "Singapore", FlightNumber: "QF71" })],
      new Set(["Singapore"]),
    );
    assert.equal(result.routeType, "international");
    assert.equal(result.inferredFrom, "batch-intl-port");
  });
});

describe("syncPortRoutesFromScrape", () => {
  let tmpDir: string;
  let prevRoutesPath: string | undefined;
  let prevSeedPath: string | undefined;
  let prevDbPath: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "port-routes-test-"));
    prevRoutesPath = process.env.PORT_ROUTES_PATH;
    prevSeedPath = process.env.PORT_ROUTES_SEED_PATH;
    prevDbPath = process.env.DATABASE_PATH;
    process.env.DATABASE_PATH = path.join(tmpDir, "flights.db");
    process.env.PORT_ROUTES_PATH = path.join(tmpDir, "port-routes.json");
    process.env.PORT_ROUTES_SEED_PATH = path.join(tmpDir, "seed.json");
    resetPortRoutesCache();
  });

  afterEach(() => {
    if (prevRoutesPath === undefined) {
      delete process.env.PORT_ROUTES_PATH;
    } else {
      process.env.PORT_ROUTES_PATH = prevRoutesPath;
    }
    if (prevSeedPath === undefined) {
      delete process.env.PORT_ROUTES_SEED_PATH;
    } else {
      process.env.PORT_ROUTES_SEED_PATH = prevSeedPath;
    }
    if (prevDbPath === undefined) {
      delete process.env.DATABASE_PATH;
    } else {
      process.env.DATABASE_PATH = prevDbPath;
    }
    resetPortRoutesCache();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns null when fetchNextDay is false", () => {
    const result = syncPortRoutesFromScrape(
      scrapeResult([flight({ PortName: "New Port" })], false),
    );
    assert.equal(result, null);
  });

  it("appends new ports without overwriting existing", () => {
    fs.writeFileSync(
      process.env.PORT_ROUTES_SEED_PATH!,
      JSON.stringify({
        version: 1,
        updatedAt: "2026-06-16T00:00:00.000Z",
        ports: {
          Melbourne: {
            routeType: "domestic",
            verified: true,
            verifiedAt: "2026-06-16",
          },
        },
      }),
    );

    const summary = syncPortRoutesFromScrape(
      scrapeResult([
        flight({ PortName: "Melbourne" }),
        flight({
          PortName: "Singapore",
          AirlineLogo: "/International/SQ.png",
          FlightNumber: "SQ216",
        }),
      ]),
    );

    assert.equal(summary?.added, 1);
    assert.equal(summary?.skippedExisting, 1);

    const file = loadPortRoutes();
    assert.equal(file.ports.Melbourne.verified, true);
    assert.equal(file.ports.Singapore.routeType, "international");
    assert.equal(file.ports.Singapore.verified, false);
    assert.equal(file.ports.Singapore.inferredFrom, "logo-international");
  });

  it("loads from seed when writable file is missing", () => {
    fs.writeFileSync(
      process.env.PORT_ROUTES_SEED_PATH!,
      JSON.stringify({
        version: 1,
        updatedAt: "2026-06-16T00:00:00.000Z",
        ports: {
          Singapore: { routeType: "international", verified: true },
        },
      }),
    );

    assert.equal(lookupPortRouteType("Singapore"), "international");
  });
});
