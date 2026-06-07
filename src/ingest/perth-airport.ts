import { chromium, type Page } from "playwright";
import { shouldFetchNextDayAwst } from "../config/dates.js";
import {
  parseMsDate,
  todayAwstMmDdYyyy,
  tomorrowAwstMmDdYyyy,
} from "../config/dates.js";
import { ScrapeContextError, summarizeFlightJson } from "../lib/format-error.js";
import { logger } from "../lib/logger.js";
import {
  flightResultsResponseSchema,
  type FlightNature,
  type FlightResultsResponse,
} from "../schemas/airport-api.js";

export const FLIGHTS_URL =
  "https://www.perthairport.com.au/flights/departures-and-arrivals";

export type ScrapeNatureResult = {
  nature: FlightNature;
  data: FlightResultsResponse;
  lastUpdated: Date | null;
};

export type ScrapeAllResult = {
  date: string;
  fetchNextDay: boolean;
  nextDate?: string;
  departures: ScrapeNatureResult;
  arrivals: ScrapeNatureResult;
  nextDayDepartures?: ScrapeNatureResult;
  nextDayArrivals?: ScrapeNatureResult;
};

/** POST from inside the browser so Cloudflare session cookies apply */
async function fetchFlightResults(
  page: Page,
  csrfToken: string,
  date: string,
  nature: FlightNature,
): Promise<FlightResultsResponse> {
  const json: unknown = await page.evaluate(
    async ({ url, token, date, nature }) => {
      const form = new FormData();
      form.append("__RequestVerificationToken", token);
      form.append("scController", "Flights");
      form.append("scAction", "GetFlightResults");
      form.append("Nature", nature);
      form.append("Date", date);
      form.append("Time", "");
      form.append("DomInt", "");
      form.append("Terminal", "");
      form.append("Query", "");
      form.append("ItemstoSkip", "0");

      const res = await fetch(url, {
        method: "POST",
        body: form,
        credentials: "include",
        headers: {
          accept: "application/json, text/plain, */*",
        },
      });

      const text = await res.text();
      if (!res.ok) {
        throw new Error(
          `POST ${res.status} ${res.statusText}: ${text.slice(0, 400)}`,
        );
      }
      try {
        return JSON.parse(text) as unknown;
      } catch (parseErr) {
        const hint = text.trimStart().startsWith("<")
          ? " (response looks like HTML, not JSON — Cloudflare or error page?)"
          : "";
        throw new Error(
          `JSON parse failed${hint}: ${text.slice(0, 200)}`,
          { cause: parseErr },
        );
      }
    },
    { url: FLIGHTS_URL, token: csrfToken, date, nature },
  );

  try {
    return flightResultsResponseSchema.parse(json);
  } catch (err) {
    throw new ScrapeContextError(
      "Flight API response did not match expected schema",
      {
        nature,
        dateAwst: date,
        url: FLIGHTS_URL,
        ...summarizeFlightJson(json),
      },
      err,
    );
  }
}

async function waitForFlightsPageReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => !document.title.toLowerCase().includes("just a moment"),
    { timeout: 90_000 },
  );

  const tokenLocator = page
    .locator('input[name="__RequestVerificationToken"]')
    .first();
  await tokenLocator.waitFor({ state: "attached", timeout: 30_000 });

  // Allow client-side flight UI to finish initializing
  await page.waitForTimeout(2_000);
}

export async function scrapeAllFlights(now = new Date()): Promise<ScrapeAllResult> {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
    });
    const page = await context.newPage();

    logger.info("scrape", "scrape.page.open", { url: FLIGHTS_URL });
    const pageReadyStart = Date.now();
    try {
      await page.goto(FLIGHTS_URL, {
        waitUntil: "domcontentloaded",
        timeout: 90_000,
      });
    } catch (err) {
      throw new ScrapeContextError("Could not load flights page", { url: FLIGHTS_URL }, err);
    }

    try {
      await waitForFlightsPageReady(page);
    } catch (err) {
      throw new ScrapeContextError(
        "Flights page did not become ready (Cloudflare challenge or missing CSRF field)",
        { url: FLIGHTS_URL, pageTitle: await page.title().catch(() => "(unknown)") },
        err,
      );
    }

    logger.info("scrape", "scrape.page.ready", {
      url: FLIGHTS_URL,
      durationMs: Date.now() - pageReadyStart,
    });

    const tokenLocator = page
      .locator('input[name="__RequestVerificationToken"]')
      .first();
    const csrfToken = await tokenLocator.inputValue();
    if (!csrfToken) {
      throw new ScrapeContextError("CSRF token missing on flights page", {
        url: FLIGHTS_URL,
        field: "__RequestVerificationToken",
      });
    }

    const date = todayAwstMmDdYyyy(now);
    const fetchNextDay = shouldFetchNextDayAwst(now);

    const fetchBoard = async (
      boardDate: string,
      nature: FlightNature,
      dayLabel: "today" | "tomorrow",
    ): Promise<FlightResultsResponse> => {
      try {
        const data = await fetchFlightResults(page, csrfToken, boardDate, nature);
        logger.info("scrape", "scrape.board.fetch", {
          nature,
          date: boardDate,
          dayLabel,
          resultCount: data.Results.length,
        });
        return data;
      } catch (err) {
        throw new ScrapeContextError(`Failed to fetch ${nature} board`, {
          nature,
          dateAwst: boardDate,
          dayLabel,
        }, err);
      }
    };

    const departuresData = await fetchBoard(date, "Departures", "today");
    const arrivalsData = await fetchBoard(date, "Arrivals", "today");

    let nextDate: string | undefined;
    let nextDayDepartures: ScrapeNatureResult | undefined;
    let nextDayArrivals: ScrapeNatureResult | undefined;

    if (fetchNextDay) {
      nextDate = tomorrowAwstMmDdYyyy(now);
      logger.info("scrape", "scrape.board.next_day", { nextDate });

      const nextDeparturesData = await fetchBoard(nextDate, "Departures", "tomorrow");
      const nextArrivalsData = await fetchBoard(nextDate, "Arrivals", "tomorrow");

      nextDayDepartures = {
        nature: "Departures",
        data: nextDeparturesData,
        lastUpdated: parseMsDate(nextDeparturesData.LastUpdated),
      };
      nextDayArrivals = {
        nature: "Arrivals",
        data: nextArrivalsData,
        lastUpdated: parseMsDate(nextArrivalsData.LastUpdated),
      };
    }

    logger.info("scrape", "scrape.complete", {
      date,
      fetchNextDay,
      nextDate: nextDate ?? null,
    });

    return {
      date,
      fetchNextDay,
      nextDate,
      departures: {
        nature: "Departures",
        data: departuresData,
        lastUpdated: parseMsDate(departuresData.LastUpdated),
      },
      arrivals: {
        nature: "Arrivals",
        data: arrivalsData,
        lastUpdated: parseMsDate(arrivalsData.LastUpdated),
      },
      nextDayDepartures,
      nextDayArrivals,
    };
  } finally {
    await browser.close();
  }
}
