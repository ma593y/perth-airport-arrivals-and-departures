import { and, eq, notInArray, sql } from "drizzle-orm";
import { nextDayHoursBeforeMidnight } from "../config/config.js";
import { getDb, getSqlite } from "../db/client.js";
import { databasePath } from "../db/paths.js";
import { flightResultToInsert } from "../db/flight-row.js";
import { flights, storeMeta } from "../db/schema.js";
import { lastApiUpdatedMs } from "../db/store-meta.js";
import {
  boardDateFromFlightKey,
  todayAwstYyyyMmDd,
} from "../config/dates.js";
import type {
  FlightNature,
  FlightResultsResponse,
} from "../schemas/airport-api.js";

export type FlightStorePayload = {
  data: FlightResultsResponse;
  apiDateAwst: string;
};

export type MergeFlightStoreOptions = {
  allowedBoardDates: string[];
  fetchNextDay: boolean;
  now?: Date;
};

export type MergeFlightStoreResult = {
  path: string;
  changed: number;
  unchanged: number;
  skipped: number;
  prunedCount: number;
  flightCount: number;
};

const allowedDateSet = (dates: string[]) => new Set(dates);

export async function mergeFlightStore(
  nature: FlightNature,
  payloads: FlightStorePayload[],
  options: MergeFlightStoreOptions,
): Promise<MergeFlightStoreResult> {
  const now = options.now ?? new Date();
  const scrapedAt = now.toISOString();
  const boardDate = todayAwstYyyyMmDd(now);
  const allowed = allowedDateSet(options.allowedBoardDates);
  const primaryApiDateAwst = payloads[0]?.apiDateAwst ?? "";
  const lastApiUpdated = payloads[0]?.data.LastUpdated ?? "";
  const scrapeRevision = scrapedAt;

  const sqlite = getSqlite();
  const db = getDb();

  let changed = 0;
  let unchanged = 0;
  let skipped = 0;

  const mergeTx = sqlite.transaction(() => {
    for (const { data } of payloads) {
      for (const flight of data.Results) {
        const flightBoardDate = boardDateFromFlightKey(flight.FlightKey);
        if (!flightBoardDate) {
          console.warn(
            `[${nature}] Skipping invalid FlightKey: ${flight.FlightKey}`,
          );
          skipped += 1;
          continue;
        }
        if (!allowed.has(flightBoardDate)) {
          console.warn(
            `[${nature}] Skipping FlightKey with board date ${flightBoardDate} (retained: ${[...allowed].join(", ")}): ${flight.FlightKey}`,
          );
          skipped += 1;
          continue;
        }

        const insertRow = flightResultToInsert(flight, nature, scrapedAt);
        if (!insertRow) {
          skipped += 1;
          continue;
        }

        const existing = db
          .select({ contentHash: flights.contentHash })
          .from(flights)
          .where(eq(flights.flightKey, flight.FlightKey))
          .get();

        if (existing?.contentHash === insertRow.contentHash) {
          unchanged += 1;
          continue;
        }

        db.insert(flights)
          .values(insertRow)
          .onConflictDoUpdate({
            target: flights.flightKey,
            set: {
              nature: insertRow.nature,
              airlineLogo: insertRow.airlineLogo,
              airlineName: insertRow.airlineName,
              flightNumber: insertRow.flightNumber,
              portName: insertRow.portName,
              flightNature: insertRow.flightNature,
              terminal: insertRow.terminal,
              estimatedTime: insertRow.estimatedTime,
              scheduledTime: insertRow.scheduledTime,
              status: insertRow.status,
              remark: insertRow.remark,
              url: insertRow.url,
              codeShares: insertRow.codeShares,
              contentHash: insertRow.contentHash,
              updatedAt: insertRow.updatedAt,
              boardDate: insertRow.boardDate,
              scheduledAt: insertRow.scheduledAt,
              estimatedAt: insertRow.estimatedAt,
            },
          })
          .run();

        changed += 1;
      }
    }

    let prunedCount = 0;
    if (options.allowedBoardDates.length > 0) {
      const pruneResult = db
        .delete(flights)
        .where(
          and(
            eq(flights.nature, nature),
            notInArray(flights.boardDate, [...options.allowedBoardDates]),
          ),
        )
        .run();
      prunedCount = pruneResult.changes;
    }

    const countRow = db
      .select({ count: sql<number>`count(*)` })
      .from(flights)
      .where(eq(flights.nature, nature))
      .get();
    const flightCount = Number(countRow?.count ?? 0);

    db.insert(storeMeta)
      .values({
        nature,
        boardDate,
        retainedBoardDates: JSON.stringify(options.allowedBoardDates),
        apiDateAwst: primaryApiDateAwst,
        lastScrapeAt: scrapedAt,
        lastApiUpdated,
        lastApiUpdatedMs: lastApiUpdatedMs(lastApiUpdated),
        scrapeRevision,
        flightCount,
        nextDayPrefetch: options.fetchNextDay,
        nextDayHoursBeforeMidnight: nextDayHoursBeforeMidnight(),
      })
      .onConflictDoUpdate({
        target: storeMeta.nature,
        set: {
          boardDate,
          retainedBoardDates: JSON.stringify(options.allowedBoardDates),
          apiDateAwst: primaryApiDateAwst,
          lastScrapeAt: scrapedAt,
          lastApiUpdated,
          lastApiUpdatedMs: lastApiUpdatedMs(lastApiUpdated),
          scrapeRevision,
          flightCount,
          nextDayPrefetch: options.fetchNextDay,
          nextDayHoursBeforeMidnight: nextDayHoursBeforeMidnight(),
        },
      })
      .run();

    return { prunedCount, flightCount };
  });

  const { prunedCount, flightCount } = mergeTx();

  return {
    path: databasePath(),
    changed,
    unchanged,
    skipped,
    prunedCount,
    flightCount,
  };
}
