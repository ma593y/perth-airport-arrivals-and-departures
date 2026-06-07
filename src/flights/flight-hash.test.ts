import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FlightResult } from "../schemas/airport-api.js";
import { flightHash } from "../db/flight-row.js";

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
    CodeShares: ["QF401"],
    ...overrides,
  };
}

describe("flightHash", () => {
  it("is stable for the same payload", () => {
    const flight = sampleFlight();
    assert.equal(flightHash(flight), flightHash({ ...flight }));
  });

  it("ignores CodeShares order", () => {
    const a = sampleFlight({ CodeShares: ["QF401", "QF402"] });
    const b = sampleFlight({ CodeShares: ["QF402", "QF401"] });
    assert.equal(flightHash(a), flightHash(b));
  });

  it("changes when remark changes", () => {
    const a = sampleFlight();
    const b = sampleFlight({ Remark: "Delayed" });
    assert.notEqual(flightHash(a), flightHash(b));
  });
});
