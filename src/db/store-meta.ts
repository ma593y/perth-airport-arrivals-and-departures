import { eq } from "drizzle-orm";
import { parseMsDate } from "../config/dates.js";
import type { FlightNature } from "../schemas/airport-api.js";
import { getDb } from "./client.js";
import { storeMeta } from "./schema.js";

export type StoreMetaDto = {
  boardDate: string;
  retainedBoardDates: string[];
  apiDateAwst: string;
  lastScrapeAt: string;
  lastApiUpdated: string;
  scrapeRevision: string;
  flightCount: number;
  nextDayPrefetch: boolean;
  nextDayHoursBeforeMidnight: number;
};

export function rowToStoreMetaDto(row: typeof storeMeta.$inferSelect): StoreMetaDto {
  let retainedBoardDates: string[] = [];
  try {
    retainedBoardDates = JSON.parse(row.retainedBoardDates) as string[];
  } catch {
    retainedBoardDates = [];
  }

  return {
    boardDate: row.boardDate,
    retainedBoardDates,
    apiDateAwst: row.apiDateAwst,
    lastScrapeAt: row.lastScrapeAt,
    lastApiUpdated: row.lastApiUpdated,
    scrapeRevision: row.scrapeRevision,
    flightCount: row.flightCount,
    nextDayPrefetch: row.nextDayPrefetch,
    nextDayHoursBeforeMidnight: row.nextDayHoursBeforeMidnight,
  };
}

export function loadStoreMetaSync(nature: FlightNature): StoreMetaDto | null {
  const row = getDb()
    .select()
    .from(storeMeta)
    .where(eq(storeMeta.nature, nature))
    .get();
  return row ? rowToStoreMetaDto(row) : null;
}

export function lastApiUpdatedMs(lastApiUpdated: string): number | null {
  const d = parseMsDate(lastApiUpdated);
  return d ? d.getTime() : null;
}
