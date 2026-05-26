import { and, eq, gte, lte, sql } from "drizzle-orm";
import { cutoffAwstIso, horizonAwstIso } from "../config/dates.js";
import { getDb } from "../db/client.js";
import { flightRowToApi } from "../db/flight-row.js";
import { flights } from "../db/schema.js";
import { loadStoreMetaSync } from "../db/store-meta.js";
import {
  applyClientFilters,
  attachRouteTypes,
  boardInstantMs,
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

  const cutoffMs = Date.now() - params.lastHours * MS_PER_HOUR;
  const cutoffIso = cutoffAwstIso(params.lastHours);
  const horizonMs = Date.now() + params.nextHours * MS_PER_HOUR;
  const horizonIso = horizonAwstIso(params.nextHours);

  const conditions = [eq(flights.nature, nature)];

  if (params.boardDate !== "") {
    conditions.push(eq(flights.boardDate, params.boardDate));
  }

  conditions.push(
    gte(
      sql`coalesce(${flights.estimatedAt}, ${flights.scheduledAt})`,
      cutoffIso,
    ),
  );
  conditions.push(
    lte(
      sql`coalesce(${flights.estimatedAt}, ${flights.scheduledAt})`,
      horizonIso,
    ),
  );

  const rows = getDb()
    .select()
    .from(flights)
    .where(and(...conditions))
    .limit(MAX_FLIGHTS)
    .all();

  // SQL cutoff uses AWST ISO strings; JS filter uses epoch ms for rows where
  // scheduled/estimated fields did not round-trip cleanly into SQL comparison.
  const apiFlights = attachRouteTypes(
    rows
      .map((row) => flightRowToApi(row, direction, "unknown"))
      .filter(
        (f) =>
          boardInstantMs(f) >= cutoffMs && boardInstantMs(f) <= horizonMs,
      ),
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
