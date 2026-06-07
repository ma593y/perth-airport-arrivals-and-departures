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
import { formatRepoRelativePath } from "../src/lib/paths.js";
import { scrapeAllFlights } from "../src/ingest/perth-airport.js";
import { runMigrations } from "./migrate.js";

function formatLastUpdated(iso: string | null): string {
  return iso ?? "(could not parse LastUpdated)";
}

function logPrefetchWindow(now: Date): void {
  const hours = nextDayHoursBeforeMidnight();
  const minutesLeft = Math.round(minutesUntilMidnightAwst(now));
  const willFetch = shouldFetchNextDayAwst(now);
  console.log(
    `Prefetch: ${hours}h before AWST midnight (${minutesLeft} min until midnight) — next-day fetch: ${willFetch ? "yes" : "no"}\n`,
  );
}

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

function logNatureSummary(
  label: string,
  apiToday: number,
  apiTomorrow: number | undefined,
  lastUpdated: string | null,
  store: MergeFlightStoreResult,
): void {
  console.log(label);
  console.log(`  API today:     ${apiToday}`);
  if (apiTomorrow !== undefined) {
    console.log(`  API tomorrow:  ${apiTomorrow}`);
  }
  console.log(`  LastUpdated:   ${formatLastUpdated(lastUpdated)}`);
  console.log(
    `  Database:      ${formatRepoRelativePath(store.path)} (${store.flightCount} flights, ${store.changed} changed, ${store.unchanged} unchanged, ${store.skipped} skipped, ${store.prunedCount} pruned)`,
  );
}

function logSummary(
  result: Awaited<ReturnType<typeof scrapeAllFlights>>,
  departuresStore: MergeFlightStoreResult,
  arrivalsStore: MergeFlightStoreResult,
): void {
  console.log("\n--- Summary ---\n");
  console.log(`Date (AWST):     ${result.date}`);
  console.log(
    `Next-day fetch:  ${result.fetchNextDay ? `yes (${result.nextDate})` : "no"}`,
  );
  console.log();

  logNatureSummary(
    "Departures",
    result.departures.data.Results.length,
    result.nextDayDepartures?.data.Results.length,
    result.departures.lastUpdated?.toISOString() ?? null,
    departuresStore,
  );
  console.log();

  logNatureSummary(
    "Arrivals",
    result.arrivals.data.Results.length,
    result.nextDayArrivals?.data.Results.length,
    result.arrivals.lastUpdated?.toISOString() ?? null,
    arrivalsStore,
  );
  console.log("\nDone.");
}

async function main() {
  const now = new Date();
  console.log("Perth Airport flight board — collect\n");
  logPrefetchWindow(now);

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
}

main().catch((err: unknown) => {
  logFatalError("collect run", err);
  process.exit(1);
});
