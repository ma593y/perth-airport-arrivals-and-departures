import { createHash } from "node:crypto";
import type { FlightInsert, FlightRow } from "./schema.js";
import type { ApiFlight, FlightNature, FlightResult } from "../schemas/airport-api.js";
import {
  boardDateFromFlightKey,
  boardTimeToAwstIso,
} from "../config/dates.js";

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

export function flightResultToInsert(
  flight: FlightResult,
  nature: FlightNature,
  updatedAt: string,
): FlightInsert | null {
  const boardDate = boardDateFromFlightKey(flight.FlightKey);
  if (!boardDate) return null;

  const scheduledAt = boardTimeToAwstIso(boardDate, flight.ScheduledTime);
  const estimatedAt = boardTimeToAwstIso(boardDate, flight.EstimatedTime);

  return {
    flightKey: flight.FlightKey,
    nature,
    airlineLogo: flight.AirlineLogo,
    airlineName: flight.AirlineName,
    flightNumber: flight.FlightNumber,
    portName: flight.PortName,
    flightNature: flight.Nature,
    terminal: flight.Terminal,
    estimatedTime: flight.EstimatedTime,
    scheduledTime: flight.ScheduledTime,
    status: flight.Status,
    remark: flight.Remark,
    url: flight.Url,
    codeShares: JSON.stringify(flight.CodeShares),
    contentHash: flightHash(flight),
    updatedAt,
    boardDate,
    scheduledAt,
    estimatedAt,
  };
}

export function flightRowToApi(
  row: FlightRow,
  direction: "departures" | "arrivals",
  routeType: "domestic" | "international" | "unknown",
): ApiFlight {
  let codeShares: string[] = [];
  try {
    codeShares = JSON.parse(row.codeShares) as string[];
  } catch {
    codeShares = [];
  }

  return {
    AirlineLogo: row.airlineLogo,
    AirlineName: row.airlineName,
    FlightNumber: row.flightNumber,
    PortName: row.portName,
    Nature: row.flightNature,
    Terminal: row.terminal,
    EstimatedTime: row.estimatedTime,
    ScheduledTime: row.scheduledTime,
    Status: row.status,
    Remark: row.remark,
    Url: row.url,
    FlightKey: row.flightKey,
    CodeShares: codeShares,
    _boardDate: row.boardDate,
    _scheduledAt: row.scheduledAt,
    _estimatedAt: row.estimatedAt,
    updatedAt: row.updatedAt,
    _direction: direction,
    _routeType: routeType,
  };
}
