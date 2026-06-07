import {
  minutesUntilMidnightAwst,
  nextDayHoursBeforeMidnight,
  shouldFetchNextDayAwst,
  todayAwstYyyyMmDd,
  tomorrowAwstYyyyMmDd,
  yesterdayAwstYyyyMmDd,
} from "../src/config/dates.js";
import {
  mergeFlightStore,
  type FlightStorePayload,
  type MergeFlightStoreResult,
} from "../src/flights/flight-store.js";
import { logFatalError, runStep } from "../src/lib/format-error.js";
import { logger } from "../src/lib/logger.js";
import { formatRepoRelativePath } from "../src/lib/paths.js";
import { runWithId } from "../src/lib/run-context.js";
import { scrapeAllFlights } from "../src/ingest/perth-airport.js";
import { runMigrations } from "./migrate.js";

function buildAllowedBoardDates(fetchNextDay: boolean, now: Date): string[] {
  const dates = [yesterdayAwstYyyyMmDd(now), todayAwstYyyyMmDd(now)];
  if (fetchNextDay) {
    dates.push(tomorrowAwstYyyyMmDd(now));
  }
  return dates;
}

type ScrapeResult = Awaited<ReturnType<typeof scrapeAllFlights>>;

function naturePayloads(
  result: ScrapeResult,
  nature: "departures" | "arrivals",
): FlightStorePayload[] {
  const today =
    nature === "departures" ? result.departures.data : result.arrivals.data;
  const nextDay =
    nature === "departures"
      ? result.nextDayDepartures?.data
      : result.nextDayArrivals?.data;
  const payloads: FlightStorePayload[] = [{ data: today }];
  if (nextDay) {
    payloads.push({ data: nextDay });
  }
  return payloads;
}

function logSummary(
  result: ScrapeResult,
  departuresStore: MergeFlightStoreResult,
  arrivalsStore: MergeFlightStoreResult,
): void {
  logger.info("collect", "collect.summary", {
    dateAwst: result.date,
    fetchNextDay: result.fetchNextDay,
    nextDate: result.nextDate ?? null,
    departuresApiToday: result.departures.data.Results.length,
    departuresApiTomorrow: result.nextDayDepartures?.data.Results.length ?? null,
    departuresLastUpdated:
      result.departures.lastUpdated?.toISOString() ?? null,
    departuresChanged: departuresStore.changed,
    departuresUnchanged: departuresStore.unchanged,
    departuresSkipped: departuresStore.skipped,
    departuresPruned: departuresStore.prunedCount,
    departuresFlightCount: departuresStore.flightCount,
    departuresDatabase: formatRepoRelativePath(departuresStore.path),
    arrivalsApiToday: result.arrivals.data.Results.length,
    arrivalsApiTomorrow: result.nextDayArrivals?.data.Results.length ?? null,
    arrivalsLastUpdated: result.arrivals.lastUpdated?.toISOString() ?? null,
    arrivalsChanged: arrivalsStore.changed,
    arrivalsUnchanged: arrivalsStore.unchanged,
    arrivalsSkipped: arrivalsStore.skipped,
    arrivalsPruned: arrivalsStore.prunedCount,
    arrivalsFlightCount: arrivalsStore.flightCount,
    arrivalsDatabase: formatRepoRelativePath(arrivalsStore.path),
  });
}

async function main() {
  const start = Date.now();
  const now = new Date();
  const hours = nextDayHoursBeforeMidnight();
  const minutesLeft = Math.round(minutesUntilMidnightAwst(now));
  const willFetch = shouldFetchNextDayAwst(now);

  logger.info("collect", "collect.start", {
    prefetchHours: hours,
    minutesUntilMidnight: minutesLeft,
    willFetchNextDay: willFetch,
  });

  await runStep("apply database migrations", {}, async () => {
    runMigrations();
  });

  const result = await runStep("fetch flight boards from Perth Airport", {}, () =>
    scrapeAllFlights(now),
  );

  const mergeOptions = {
    allowedBoardDates: buildAllowedBoardDates(result.fetchNextDay, now),
    now,
  };

  const departuresStore = await runStep(
    "merge departures into database",
    { nature: "Departures" },
    () => mergeFlightStore("Departures", naturePayloads(result, "departures"), mergeOptions),
  );
  const arrivalsStore = await runStep(
    "merge arrivals into database",
    { nature: "Arrivals" },
    () => mergeFlightStore("Arrivals", naturePayloads(result, "arrivals"), mergeOptions),
  );

  logSummary(result, departuresStore, arrivalsStore);

  logger.info("collect", "collect.complete", {
    durationMs: Date.now() - start,
  });
}

runWithId(() => main()).catch((err: unknown) => {
  logFatalError("collect run", err);
  process.exit(1);
});
