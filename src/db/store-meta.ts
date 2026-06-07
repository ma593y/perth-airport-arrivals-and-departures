import { eq } from "drizzle-orm";
import type { FlightNature } from "../schemas/airport-api.js";
import { getDb } from "./client.js";
import { storeMeta } from "./schema.js";

export type StoreMetaDto = {
  boardDate: string;
  retainedBoardDates: string[];
  lastScrapeAt: string;
  scrapeRevision: string;
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
    lastScrapeAt: row.lastScrapeAt,
    scrapeRevision: row.scrapeRevision,
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
