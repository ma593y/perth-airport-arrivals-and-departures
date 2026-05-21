import { shouldFetchNextDayAwst as shouldFetchNextDayAwstFromDates } from "./dates.js";

const DEFAULT_NEXT_DAY_HOURS = 3;

/** Hours before AWST midnight when tomorrow's board is also fetched (default 3). */
export function nextDayHoursBeforeMidnight(): number {
  const raw = process.env.SCRAPE_NEXT_DAY_HOURS_BEFORE_MIDNIGHT;
  if (raw === undefined || raw === "") {
    return DEFAULT_NEXT_DAY_HOURS;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0 || value > 24) {
    console.warn(
      `Invalid SCRAPE_NEXT_DAY_HOURS_BEFORE_MIDNIGHT="${raw}", using default ${DEFAULT_NEXT_DAY_HOURS}`,
    );
    return DEFAULT_NEXT_DAY_HOURS;
  }
  return value;
}

export function shouldFetchNextDayAwst(now = new Date()): boolean {
  return shouldFetchNextDayAwstFromDates(nextDayHoursBeforeMidnight(), now);
}
