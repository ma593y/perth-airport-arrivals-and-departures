import { and, eq, gte, or, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { flightRowToApi } from "../db/flight-row.js";
import { flights } from "../db/schema.js";
import { loadStoreMetaSync } from "../db/store-meta.js";
import {
  applyClientFilters,
  attachRouteTypes,
  sortFlights,
  type BoardDirection,
} from "../flights/flight-filters.js";
import type { ApiFlight, FlightNature } from "../schemas/airport-api.js";
import type { FlightsQuery } from "./schemas.js";
import { MAX_FLIGHTS } from "./schemas.js";

const MS_PER_HOUR = 3600000;

export function natureFromDirection(direction: BoardDirection): FlightNature {
  return direction === "departures" ? "Departures" : "Arrivals";
}

export function getMetaForDirection(direction: BoardDirection) {
  const nature = natureFromDirection(direction);
  const meta = loadStoreMetaSync(nature);
  if (!meta) return null;
  return meta;
}

export function queryFlights(params: FlightsQuery): {
  meta: NonNullable<ReturnType<typeof getMetaForDirection>>;
  flights: ApiFlight[];
} | null {
  const direction = params.direction;
  const nature = natureFromDirection(direction);
  const meta = loadStoreMetaSync(nature);
  if (!meta) return null;

  const cutoffMs = Date.now() - params.hours * MS_PER_HOUR;
  const cutoffIso = new Date(cutoffMs).toISOString();

  const conditions = [eq(flights.nature, nature)];

  if (params.boardDate !== "") {
    conditions.push(eq(flights.boardDate, params.boardDate));
  }

  conditions.push(
    or(
      gte(flights.estimatedAt, cutoffIso),
      and(
        sql`${flights.estimatedAt} IS NULL`,
        gte(flights.scheduledAt, cutoffIso),
      ),
    )!,
  );

  const rows = getDb()
    .select()
    .from(flights)
    .where(and(...conditions))
    .limit(MAX_FLIGHTS)
    .all();

  const apiFlights = attachRouteTypes(
    rows.map((row) => flightRowToApi(row, direction, "unknown")),
    direction,
  );

  const filtered = applyClientFilters(apiFlights, direction, {
    domInt: params.domInt,
    terminalGroup: params.terminalGroup,
    hideCompleted: params.hideCompleted,
  });

  return {
    meta,
    flights: sortFlights(filtered),
  };
}
