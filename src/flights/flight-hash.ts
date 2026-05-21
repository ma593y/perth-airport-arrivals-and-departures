import { createHash } from "node:crypto";
import type { FlightResult } from "../schemas/airport-api.js";

/** Canonical API payload for change detection (no derived/metadata fields). */
function canonicalFlightPayload(flight: FlightResult): Record<string, unknown> {
  return {
    AirlineLogo: flight.AirlineLogo,
    AirlineName: flight.AirlineName,
    FlightNumber: flight.FlightNumber,
    PortName: flight.PortName,
    Nature: flight.Nature,
    Terminal: flight.Terminal,
    EstimatedTime: flight.EstimatedTime,
    ScheduledTime: flight.ScheduledTime,
    Status: flight.Status,
    Remark: flight.Remark,
    Url: flight.Url,
    FlightKey: flight.FlightKey,
    CodeShares: [...flight.CodeShares].sort(),
  };
}

export function flightHash(flight: FlightResult): string {
  const json = JSON.stringify(canonicalFlightPayload(flight));
  return createHash("sha256").update(json, "utf8").digest("hex");
}
