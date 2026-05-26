import { z } from "zod";
import { apiFlightSchema } from "../schemas/airport-api.js";

export const boardDirectionSchema = z.enum(["departures", "arrivals"]);

export const metaQuerySchema = z.object({
  direction: boardDirectionSchema,
});

const timeWindowHoursSchema = z.coerce.number().pipe(
  z.union([
    z.literal(1),
    z.literal(2),
    z.literal(4),
    z.literal(6),
    z.literal(12),
    z.literal(24),
  ]),
);

export const flightsQuerySchema = z.object({
  direction: boardDirectionSchema,
  domInt: z.enum(["", "domestic", "international"]).default(""),
  terminalGroup: z.enum(["", "t1t2", "t3t4", "others"]).default(""),
  lastHours: timeWindowHoursSchema.default(1),
  nextHours: timeWindowHoursSchema.default(6),
  boardDate: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/)
    .default(""),
  hideCompleted: z
    .preprocess(
      (v) => (v === undefined || v === "" ? "false" : v),
      z.union([
        z.literal("true"),
        z.literal("false"),
        z.literal("1"),
        z.literal("0"),
      ]),
    )
    .transform((v) => v === "true" || v === "1"),
});

export const storeMetaResponseSchema = z.object({
  boardDate: z.string(),
  retainedBoardDates: z.array(z.string()),
  apiDateAwst: z.string(),
  lastScrapeAt: z.string(),
  lastApiUpdated: z.string(),
  scrapeRevision: z.string(),
  flightCount: z.number(),
  nextDayPrefetch: z.boolean(),
  nextDayHoursBeforeMidnight: z.number(),
});

export const flightsResponseSchema = z.object({
  meta: storeMetaResponseSchema,
  flights: z.array(apiFlightSchema),
});

export type FlightsQuery = z.infer<typeof flightsQuerySchema>;
export type MetaQuery = z.infer<typeof metaQuerySchema>;

export const MAX_FLIGHTS = 500;
