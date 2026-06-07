import { chromium, type Page } from "playwright";
import { shouldFetchNextDayAwst } from "../config/dates.js";
import {
  parseMsDate,
  todayAwstMmDdYyyy,
  tomorrowAwstMmDdYyyy,
} from "../config/dates.js";
import { ScrapeContextError, summarizeFlightJson } from "../lib/format-error.js";
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

    console.log(`Opening ${FLIGHTS_URL} ...`);
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
    console.log(`Using date (AWST): ${date}`);
    if (fetchNextDay) {
      console.log("Within next-day prefetch window — will also fetch tomorrow's board");
    }

    const fetchBoard = async (
      label: string,
      boardDate: string,
      nature: FlightNature,
    ): Promise<FlightResultsResponse> => {
      console.log(label);
      try {
        return await fetchFlightResults(page, csrfToken, boardDate, nature);
      } catch (err) {
        throw new ScrapeContextError(`Failed to fetch ${nature} board`, {
          nature,
          dateAwst: boardDate,
          label,
        }, err);
      }
    };

    const departuresData = await fetchBoard(
      "Fetching departures (today) ...",
      date,
      "Departures",
    );

    const arrivalsData = await fetchBoard(
      "Fetching arrivals (today) ...",
      date,
      "Arrivals",
    );

    let nextDate: string | undefined;
    let nextDayDepartures: ScrapeNatureResult | undefined;
    let nextDayArrivals: ScrapeNatureResult | undefined;

    if (fetchNextDay) {
      nextDate = tomorrowAwstMmDdYyyy(now);
      console.log(`Fetching next day (AWST): ${nextDate}`);

      const nextDeparturesData = await fetchBoard(
        "Fetching departures (tomorrow) ...",
        nextDate,
        "Departures",
      );

      const nextArrivalsData = await fetchBoard(
        "Fetching arrivals (tomorrow) ...",
        nextDate,
        "Arrivals",
      );

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
