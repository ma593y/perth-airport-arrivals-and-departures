import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  boardDateFromFlightKey,
  boardTimeToAwstIso,
  minutesUntilMidnightAwst,
  shouldFetchNextDayAwst,
  todayAwstYyyyMmDd,
  tomorrowAwstYyyyMmDd,
  yesterdayAwstYyyyMmDd,
} from "./dates.js";

describe("boardDateFromFlightKey", () => {
  it("parses departure key", () => {
    assert.equal(boardDateFromFlightKey("qf40020260523d"), "2026-05-23");
  });

  it("parses arrival key", () => {
    assert.equal(boardDateFromFlightKey("va942920260521a"), "2026-05-21");
  });

  it("returns null for invalid key", () => {
    assert.equal(boardDateFromFlightKey("invalid"), null);
  });
});

describe("boardTimeToAwstIso", () => {
  it("combines date and 24h time with AWST offset", () => {
    assert.equal(
      boardTimeToAwstIso("2026-05-23", "14:05"),
      "2026-05-23T14:05:00+08:00",
    );
  });

  it("returns null for empty time", () => {
    assert.equal(boardTimeToAwstIso("2026-05-23", ""), null);
  });
});

describe("AWST calendar helpers", () => {
  const noonAwst = new Date("2026-05-23T04:00:00.000Z");

  it("todayAwstYyyyMmDd", () => {
    assert.equal(todayAwstYyyyMmDd(noonAwst), "2026-05-23");
  });

  it("yesterday and tomorrow relative to today", () => {
    assert.equal(yesterdayAwstYyyyMmDd(noonAwst), "2026-05-22");
    assert.equal(tomorrowAwstYyyyMmDd(noonAwst), "2026-05-24");
  });
});

describe("shouldFetchNextDayAwst", () => {
  it("is true within hours before midnight", () => {
    const lateEveningAwst = new Date("2026-05-23T15:30:00.000Z");
    assert.equal(shouldFetchNextDayAwst(3, lateEveningAwst), true);
  });

  it("is false midday", () => {
    const midday = new Date("2026-05-23T04:00:00.000Z");
    assert.equal(shouldFetchNextDayAwst(3, midday), false);
  });
});

describe("minutesUntilMidnightAwst", () => {
  it("is non-negative", () => {
    assert.ok(minutesUntilMidnightAwst(new Date()) >= 0);
    assert.ok(minutesUntilMidnightAwst(new Date()) <= 24 * 60);
  });
});
