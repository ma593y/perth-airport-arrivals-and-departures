import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { ApiFlight } from "../schemas/airport-api.js";
import {
  applyClientFilters,
  attachRouteTypes,
  isCompleted,
  terminalGroup,
} from "./flight-filters.js";
import { resetPortRoutesCache } from "./port-routes.js";

function apiFlight(overrides: Partial<ApiFlight> = {}): ApiFlight {
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
    _boardDate: "2026-05-23",
    _scheduledAt: "2026-05-23T14:00:00+08:00",
    _estimatedAt: "2026-05-23T14:30:00+08:00",
    updatedAt: "2026-05-23T06:00:00.000Z",
    _direction: "departures",
    _routeType: "domestic",
    ...overrides,
  };
}

describe("terminalGroup", () => {
  it("maps T1/T2 and T3/T4", () => {
    assert.equal(terminalGroup("T1"), "t1t2");
    assert.equal(terminalGroup("T4"), "t3t4");
    assert.equal(terminalGroup(""), "others");
  });
});

describe("isCompleted", () => {
  it("marks departed and landed", () => {
    assert.equal(
      isCompleted(apiFlight({ Remark: "Departed" }), "departures"),
      true,
    );
    assert.equal(
      isCompleted(apiFlight({ Remark: "Landed" }), "arrivals"),
      true,
    );
    assert.equal(
      isCompleted(apiFlight({ Remark: "On-time" }), "departures"),
      false,
    );
  });
});

describe("attachRouteTypes and applyClientFilters", () => {
  let tmpDir: string;
  let prevRoutesPath: string | undefined;
  let prevDbPath: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "flight-filters-test-"));
    prevRoutesPath = process.env.PORT_ROUTES_PATH;
    prevDbPath = process.env.DATABASE_PATH;
    process.env.DATABASE_PATH = path.join(tmpDir, "flights.db");
    process.env.PORT_ROUTES_PATH = path.join(tmpDir, "port-routes.json");
    fs.writeFileSync(process.env.PORT_ROUTES_PATH, JSON.stringify({
      version: 1,
      updatedAt: "2026-06-16T00:00:00.000Z",
      ports: {
        Singapore: { routeType: "international", verified: true },
        Melbourne: { routeType: "domestic", verified: true },
      },
    }));
    resetPortRoutesCache();
  });

  afterEach(() => {
    if (prevRoutesPath === undefined) {
      delete process.env.PORT_ROUTES_PATH;
    } else {
      process.env.PORT_ROUTES_PATH = prevRoutesPath;
    }
    if (prevDbPath === undefined) {
      delete process.env.DATABASE_PATH;
    } else {
      process.env.DATABASE_PATH = prevDbPath;
    }
    resetPortRoutesCache();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("derives international from logo path", () => {
    const flights = attachRouteTypes(
      [
        apiFlight({
          PortName: "Dubai",
          AirlineLogo: "/International/Emirates.png",
          _routeType: "unknown",
        }),
      ],
      "arrivals",
    );
    assert.equal(flights[0]._routeType, "international");
  });

  it("filters by domInt and hideCompleted", () => {
    const flights = attachRouteTypes(
      [
        apiFlight({ _routeType: "domestic", Remark: "Departed" }),
        apiFlight({
          FlightNumber: "EK420",
          PortName: "Dubai",
          _routeType: "international",
          AirlineLogo: "/International/Emirates.png",
        }),
      ],
      "departures",
    );
    const filtered = applyClientFilters(flights, "departures", {
      domInt: "international",
      terminalGroup: "",
      hideCompleted: true,
    });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].FlightNumber, "EK420");
  });

  it("uses port registry over domestic logo for international port", () => {
    const flights = attachRouteTypes(
      [
        apiFlight({
          FlightNumber: "QF71",
          PortName: "Singapore",
          AirlineLogo: "/Domestic/Qantas.png",
          _routeType: "unknown",
        }),
      ],
      "departures",
    );
    assert.equal(flights[0]._routeType, "international");
  });

  it("falls back to logo when port is not in registry", () => {
    const flights = attachRouteTypes(
      [
        apiFlight({
          PortName: "Dubai",
          AirlineLogo: "/International/Emirates.png",
          _routeType: "unknown",
        }),
      ],
      "arrivals",
    );
    assert.equal(flights[0]._routeType, "international");
  });
});
