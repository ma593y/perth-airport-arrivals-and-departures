import { z } from "zod";

export const flightResultSchema = z.object({
  AirlineLogo: z.string().nullable(),
  AirlineName: z.string().nullable(),
  FlightNumber: z.string(),
  PortName: z.string(),
  Nature: z.string(),
  Terminal: z.string().nullable(),
  EstimatedTime: z.string().nullable(),
  ScheduledTime: z.string(),
  Status: z.string().nullable(),
  Remark: z.string(),
  Url: z.string(),
  FlightKey: z.string(),
  CodeShares: z.array(z.string()),
});

export const flightResultsResponseSchema = z.object({
  LastUpdated: z.string(),
  Results: z.array(flightResultSchema),
});

export const apiFlightSchema = flightResultSchema.extend({
  _boardDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  _scheduledAt: z.string().nullable().optional(),
  _estimatedAt: z.string().nullable().optional(),
  updatedAt: z.string().datetime(),
  _direction: z.enum(["departures", "arrivals"]),
  _routeType: z.enum(["domestic", "international", "unknown"]),
});

export type FlightResult = z.infer<typeof flightResultSchema>;
export type ApiFlight = z.infer<typeof apiFlightSchema>;
export type FlightResultsResponse = z.infer<typeof flightResultsResponseSchema>;

export type FlightNature = "Departures" | "Arrivals";
