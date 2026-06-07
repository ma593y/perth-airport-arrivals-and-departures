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
} from "../src/flights/flight-store.js";
import { logFatalError, runStep } from "../src/lib/format-error.js";
import { logger } from "../src/lib/logger.js";
import { runWithId } from "../src/lib/run-context.js";
import { scrapeAllFlights } from "../src/ingest/perth-airport.js";

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

  const result = await runStep("fetch flight boards from Perth Airport", {}, () =>
    scrapeAllFlights(now),
  );

  const mergeOptions = {
    allowedBoardDates: buildAllowedBoardDates(result.fetchNextDay, now),
    now,
  };

  await runStep(
    "merge departures into database",
    { nature: "Departures" },
    () => mergeFlightStore("Departures", naturePayloads(result, "departures"), mergeOptions),
  );
  await runStep(
    "merge arrivals into database",
    { nature: "Arrivals" },
    () => mergeFlightStore("Arrivals", naturePayloads(result, "arrivals"), mergeOptions),
  );

  logger.info("collect", "collect.complete", {
    durationMs: Date.now() - start,
  });
}

runWithId(() => main()).catch((err: unknown) => {
  logFatalError("collect run", err);
  process.exit(1);
});
