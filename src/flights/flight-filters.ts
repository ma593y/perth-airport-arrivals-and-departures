import { boardTimeToAwstIso } from "../config/dates.js";
import type { ApiFlight } from "../schemas/airport-api.js";

export type BoardDirection = "departures" | "arrivals";

const TERMINAL_GROUP_T1T2 = new Set(["T1", "T2"]);
const TERMINAL_GROUP_T3T4 = new Set(["T3", "T4"]);

function terminalKey(terminal: string | null | undefined): string {
  if (terminal == null || terminal === "") return "";
  return terminal;
}

export function terminalGroup(
  terminal: string | null | undefined,
): "t1t2" | "t3t4" | "others" {
  const t = terminalKey(terminal);
  if (TERMINAL_GROUP_T1T2.has(t)) return "t1t2";
  if (TERMINAL_GROUP_T3T4.has(t)) return "t3t4";
  return "others";
}

export function intlPortsFromFlights(flights: ApiFlight[]): Set<string> {
  const ports = new Set<string>();
  for (const f of flights) {
    const logo = f.AirlineLogo ?? "";
    if (logo.includes("/International/") && f.PortName) {
      ports.add(f.PortName);
    }
  }
  return ports;
}

export function deriveRouteType(
  flight: ApiFlight,
  intlPorts: Set<string>,
): "domestic" | "international" | "unknown" {
  const logo = flight.AirlineLogo ?? "";
  if (logo.includes("/International/")) return "international";
  if (logo.includes("/Domestic/")) return "domestic";
  if (flight.PortName && intlPorts.has(flight.PortName)) return "international";
  return "unknown";
}

export function attachRouteTypes(
  flights: ApiFlight[],
  direction: BoardDirection,
): ApiFlight[] {
  const intlPorts = intlPortsFromFlights(flights);
  return flights.map((f) => ({
    ...f,
    _direction: direction,
    _routeType: deriveRouteType(f, intlPorts),
  }));
}

function remarkKey(remark: string): string {
  return remark ?? "";
}

export function isCompleted(
  flight: ApiFlight,
  direction: BoardDirection,
): boolean {
  const r = remarkKey(flight.Remark);
  if (r === "Cancelled") return true;
  if (direction === "departures" && r === "Departed") return true;
  if (direction === "arrivals" && r === "Landed") return true;
  return false;
}

export function sortInstant(iso: string | null | undefined): number {
  if (!iso || typeof iso !== "string") return Number.POSITIVE_INFINITY;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
}

/** Effective board time for filters: estimated, then scheduled (matches table main line). */
export function boardInstantMs(flight: ApiFlight): number {
  let ms = sortInstant(flight._estimatedAt);
  if (ms !== Number.POSITIVE_INFINITY) return ms;

  const boardDate = flight._boardDate ?? "";
  if (boardDate) {
    const fromEst = boardTimeToAwstIso(boardDate, flight.EstimatedTime);
    ms = sortInstant(fromEst);
    if (ms !== Number.POSITIVE_INFINITY) return ms;
  }

  ms = sortInstant(flight._scheduledAt);
  if (ms !== Number.POSITIVE_INFINITY) return ms;

  if (boardDate) {
    const fromSched = boardTimeToAwstIso(boardDate, flight.ScheduledTime);
    ms = sortInstant(fromSched);
    if (ms !== Number.POSITIVE_INFINITY) return ms;
  }

  return Number.NEGATIVE_INFINITY;
}

export type FlightListFilters = {
  domInt: "" | "domestic" | "international";
  terminalGroup: "" | "t1t2" | "t3t4" | "others";
  hideCompleted: boolean;
};

export function applyClientFilters(
  flights: ApiFlight[],
  direction: BoardDirection,
  filters: FlightListFilters,
): ApiFlight[] {
  return flights.filter((f) => {
    if (filters.hideCompleted && isCompleted(f, direction)) return false;
    if (
      filters.terminalGroup !== "" &&
      terminalGroup(f.Terminal) !== filters.terminalGroup
    ) {
      return false;
    }
    if (filters.domInt !== "" && f._routeType !== filters.domInt) return false;
    return true;
  });
}

export function sortFlights(flights: ApiFlight[]): ApiFlight[] {
  const sorted = [...flights];
  sorted.sort((a, b) => {
    let cmp = sortInstant(a._estimatedAt) - sortInstant(b._estimatedAt);
    if (cmp !== 0) return cmp;
    cmp = sortInstant(a._scheduledAt) - sortInstant(b._scheduledAt);
    if (cmp !== 0) return cmp;
    return (a.FlightNumber ?? "").localeCompare(b.FlightNumber ?? "");
  });
  return sorted;
}
