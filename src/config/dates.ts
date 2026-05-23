const AWST_TIMEZONE = "Australia/Perth";

/** Date string for POST body: M/D/YYYY in Perth local time */
export function todayAwstMmDdYyyy(now = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: AWST_TIMEZONE,
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
  const parts = formatter.formatToParts(now);
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  const year = parts.find((p) => p.type === "year")?.value;
  if (!month || !day || !year) {
    throw new Error("Failed to format AWST date");
  }
  return `${month}/${day}/${year}`;
}

/** Board date in AWST: YYYY-MM-DD */
export function todayAwstYyyyMmDd(now = new Date()): string {
  return formatAwstYyyyMmDd(now);
}

function formatAwstYyyyMmDd(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: AWST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

function awstYyyyMmDdPlusDays(dayOffset: number, now = new Date()): string {
  const base = todayAwstYyyyMmDd(now);
  const [year, month, day] = base.split("-").map((s) => parseInt(s, 10));
  const shifted = new Date(Date.UTC(year, month - 1, day + dayOffset, 12, 0, 0));
  return formatAwstYyyyMmDd(shifted);
}

/** Yesterday's board date in AWST: YYYY-MM-DD */
export function yesterdayAwstYyyyMmDd(now = new Date()): string {
  return awstYyyyMmDdPlusDays(-1, now);
}

/** Tomorrow's board date in AWST: YYYY-MM-DD */
export function tomorrowAwstYyyyMmDd(now = new Date()): string {
  return awstYyyyMmDdPlusDays(1, now);
}

/** Date string for POST body: M/D/YYYY for tomorrow in Perth */
export function tomorrowAwstMmDdYyyy(now = new Date()): string {
  const yyyyMmDd = tomorrowAwstYyyyMmDd(now);
  const [year, month, day] = yyyyMmDd.split("-").map((s) => parseInt(s, 10));
  return `${month}/${day}/${year}`;
}

type AwstClockParts = {
  hour: number;
  minute: number;
  second: number;
};

function awstClockParts(now = new Date()): AwstClockParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: AWST_TIMEZONE,
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  const minute = Number(parts.find((p) => p.type === "minute")?.value);
  const second = Number(parts.find((p) => p.type === "second")?.value);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || !Number.isFinite(second)) {
    throw new Error("Failed to read AWST clock parts");
  }
  return { hour, minute, second };
}

/** Minutes from now until the next AWST midnight (0 at midnight, up to ~1440). */
export function minutesUntilMidnightAwst(now = new Date()): number {
  const { hour, minute, second } = awstClockParts(now);
  const elapsedMinutes = hour * 60 + minute + second / 60;
  return Math.max(0, 24 * 60 - elapsedMinutes);
}

/** True when within the given hours before the next AWST midnight. */
export function shouldFetchNextDayAwst(
  hoursBeforeMidnight: number,
  now = new Date(),
): boolean {
  return minutesUntilMidnightAwst(now) <= hoursBeforeMidnight * 60;
}

const FLIGHT_KEY_BOARD_DATE = /^(.+)(\d{8})([ad])$/;

/**
 * Parse board date from FlightKey (e.g. va942920260521d → 2026-05-21).
 * Returns null if the key does not match the expected shape.
 */
export function boardDateFromFlightKey(flightKey: string): string | null {
  const match = FLIGHT_KEY_BOARD_DATE.exec(flightKey);
  if (!match) return null;
  const yyyymmdd = match[2];
  const year = yyyymmdd.slice(0, 4);
  const month = yyyymmdd.slice(4, 6);
  const day = yyyymmdd.slice(6, 8);
  return `${year}-${month}-${day}`;
}

const BOARD_DATE_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const CLOCK_TIME_24H = /^(\d{1,2}):(\d{2})$/;
const AWST_OFFSET = "+08:00";

/**
 * Combine board date (YYYY-MM-DD, AWST) with API clock time (H:MM / HH:MM).
 * Returns ISO 8601 with +08:00, or null if date/time is missing or invalid.
 */
export function boardTimeToAwstIso(
  boardDate: string,
  time: string | null | undefined,
): string | null {
  if (time == null || typeof time !== "string") return null;
  const trimmed = time.trim();
  if (!trimmed) return null;
  if (!BOARD_DATE_ISO.test(boardDate)) return null;

  const timeMatch = CLOCK_TIME_24H.exec(trimmed);
  if (!timeMatch) return null;

  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour > 23 || minute > 59) return null;

  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return `${boardDate}T${hh}:${mm}:00${AWST_OFFSET}`;
}

const MS_PER_HOUR = 3600000;

/**
 * AWST ISO cutoff for SQL time-window filters (matches boardTimeToAwstIso format).
 * Instant = now minus hoursAgo, expressed in Australia/Perth calendar/clock.
 */
export function cutoffAwstIso(hoursAgo: number, now = new Date()): string {
  const instant = new Date(now.getTime() - hoursAgo * MS_PER_HOUR);
  const boardDate = formatAwstYyyyMmDd(instant);
  const { hour, minute } = awstClockParts(instant);
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return `${boardDate}T${hh}:${mm}:00${AWST_OFFSET}`;
}

/** Parse Microsoft JSON date: /Date(1766587419126)/ */
export function parseMsDate(msDateString: string): Date | null {
  const match = /\/Date\((\d+)\)\//.exec(msDateString);
  if (!match) return null;
  return new Date(Number(match[1]));
}
