import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { getDb, getSqlite } from "../db/client.js";
import { flightResultToInsert } from "../db/flight-row.js";
import { flights, storeMeta } from "../db/schema.js";
import { databasePath } from "../lib/paths.js";
import {
  boardDateFromFlightKey,
  todayAwstYyyyMmDd,
} from "../config/dates.js";
import { logger } from "../lib/logger.js";
import type {
  FlightNature,
  FlightResultsResponse,
} from "../schemas/airport-api.js";

export type FlightStorePayload = {
  data: FlightResultsResponse;
};

export type MergeFlightStoreOptions = {
  allowedBoardDates: string[];
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

const HASH_LOOKUP_CHUNK = 500;

type PendingRow = {
  insertRow: NonNullable<ReturnType<typeof flightResultToInsert>>;
};

function loadExistingHashes(
  db: ReturnType<typeof getDb>,
  nature: FlightNature,
  flightKeys: string[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (let i = 0; i < flightKeys.length; i += HASH_LOOKUP_CHUNK) {
    const chunk = flightKeys.slice(i, i + HASH_LOOKUP_CHUNK);
    if (chunk.length === 0) continue;
    const rows = db
      .select({
        flightKey: flights.flightKey,
        contentHash: flights.contentHash,
      })
      .from(flights)
      .where(and(eq(flights.nature, nature), inArray(flights.flightKey, chunk)))
      .all();
    for (const row of rows) {
      map.set(row.flightKey, row.contentHash);
    }
  }
  return map;
}

export async function mergeFlightStore(
  nature: FlightNature,
  payloads: FlightStorePayload[],
  options: MergeFlightStoreOptions,
): Promise<MergeFlightStoreResult> {
  const start = Date.now();
  const now = options.now ?? new Date();
  const scrapedAt = now.toISOString();
  const boardDate = todayAwstYyyyMmDd(now);
  const allowed = allowedDateSet(options.allowedBoardDates);
  const scrapeRevision = scrapedAt;

  logger.info("store", "merge.start", {
    nature,
    payloadCount: payloads.length,
    allowedBoardDates: options.allowedBoardDates.join(","),
  });

  const sqlite = getSqlite();
  const db = getDb();

  let changed = 0;
  let unchanged = 0;
  let skipped = 0;

  const mergeTx = sqlite.transaction(() => {
    const pending: PendingRow[] = [];

    for (const { data } of payloads) {
      for (const flight of data.Results) {
        const flightBoardDate = boardDateFromFlightKey(flight.FlightKey);
        if (!flightBoardDate) {
          logger.warn("store", "merge.skip", {
            nature,
            flightKey: flight.FlightKey,
            reason: "invalid FlightKey",
          });
          skipped += 1;
          continue;
        }
        if (!allowed.has(flightBoardDate)) {
          logger.warn("store", "merge.skip", {
            nature,
            flightKey: flight.FlightKey,
            boardDate: flightBoardDate,
            reason: "board date not retained",
          });
          skipped += 1;
          continue;
        }

        const insertRow = flightResultToInsert(flight, nature, scrapedAt);
        if (!insertRow) {
          skipped += 1;
          continue;
        }

        pending.push({ insertRow });
      }
    }

    const existingHashes = loadExistingHashes(
      db,
      nature,
      pending.map((p) => p.insertRow.flightKey),
    );

    for (const { insertRow } of pending) {
      const existingHash = existingHashes.get(insertRow.flightKey);
      if (existingHash === insertRow.contentHash) {
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
        lastScrapeAt: scrapedAt,
        scrapeRevision,
      })
      .onConflictDoUpdate({
        target: storeMeta.nature,
        set: {
          boardDate,
          retainedBoardDates: JSON.stringify(options.allowedBoardDates),
          lastScrapeAt: scrapedAt,
          scrapeRevision,
        },
      })
      .run();

    return { prunedCount, flightCount };
  });

  const { prunedCount, flightCount } = mergeTx();

  logger.info("store", "merge.complete", {
    nature,
    changed,
    unchanged,
    skipped,
    prunedCount,
    flightCount,
    durationMs: Date.now() - start,
  });

  return {
    path: databasePath(),
    changed,
    unchanged,
    skipped,
    prunedCount,
    flightCount,
  };
}
