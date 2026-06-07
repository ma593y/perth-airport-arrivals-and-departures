import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import { runMigrations } from "../../scripts/migrate.js";
import { closeDb } from "../db/client.js";
import type { FlightResult, FlightResultsResponse } from "../schemas/airport-api.js";
import { mergeFlightStore } from "./flight-store.js";

function sampleFlight(overrides: Partial<FlightResult> = {}): FlightResult {
  return {
    AirlineLogo: "/Domestic/Qantas.png",
    AirlineName: "Qantas",
    FlightNumber: "QF400",
    PortName: "Melbourne",
    Nature: "International",
    Terminal: "T1",
    EstimatedTime: "14:30",
    ScheduledTime: "14:00",
    Status: null,
    Remark: "On-time",
    Url: "/flights/qf400",
    FlightKey: "qf40020260523d",
    CodeShares: [],
    ...overrides,
  };
}

function payload(results: FlightResult[]): { data: FlightResultsResponse } {
  return {
    data: {
      LastUpdated: "/Date(1766587419126)/",
      Results: results,
    },
  };
}

const fixedNow = new Date("2026-05-23T04:00:00.000Z");

let tmpDir = "";

before(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "perth-flights-test-"));
});

after(() => {
  closeDb();
  rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  closeDb();
  process.env.DATABASE_PATH = join(tmpDir, `test-${process.hrtime.bigint()}.db`);
  runMigrations();
});

describe("mergeFlightStore", () => {
  it("inserts new flights", async () => {
    const result = await mergeFlightStore(
      "Departures",
      [payload([sampleFlight()])],
      {
        allowedBoardDates: ["2026-05-22", "2026-05-23"],
        now: fixedNow,
      },
    );
    assert.equal(result.changed, 1);
    assert.equal(result.unchanged, 0);
    assert.equal(result.flightCount, 1);
  });

  it("skips unchanged rows on second merge", async () => {
    const options = {
      allowedBoardDates: ["2026-05-22", "2026-05-23"],
      now: fixedNow,
    };
    const p = [payload([sampleFlight()])];
    await mergeFlightStore("Departures", p, options);
    const second = await mergeFlightStore("Departures", p, options);
    assert.equal(second.changed, 0);
    assert.equal(second.unchanged, 1);
  });

  it("prunes board dates outside retention", async () => {
    const options = {
      allowedBoardDates: ["2026-05-23"],
      now: fixedNow,
    };
    await mergeFlightStore(
      "Departures",
      [
        payload([
          sampleFlight({ FlightKey: "qf40020260522d", FlightNumber: "QF401" }),
          sampleFlight(),
        ]),
      ],
      { ...options, allowedBoardDates: ["2026-05-22", "2026-05-23"] },
    );
    const pruned = await mergeFlightStore("Departures", [payload([sampleFlight()])], options);
    assert.equal(pruned.prunedCount, 1);
    assert.equal(pruned.flightCount, 1);
  });
});
