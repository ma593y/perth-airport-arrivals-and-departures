import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ApiFlight } from "../schemas/airport-api.js";
import {
  applyClientFilters,
  attachRouteTypes,
  isCompleted,
  terminalGroup,
} from "./flight-filters.js";

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
  it("derives international from logo path", () => {
    const flights = attachRouteTypes(
      [
        apiFlight({
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
});
