import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const flights = sqliteTable(
  "flights",
  {
    flightKey: text("flight_key").primaryKey(),
    nature: text("nature").notNull(),
    airlineLogo: text("airline_logo"),
    airlineName: text("airline_name"),
    flightNumber: text("flight_number").notNull(),
    portName: text("port_name").notNull(),
    flightNature: text("flight_nature").notNull(),
    terminal: text("terminal"),
    estimatedTime: text("estimated_time"),
    scheduledTime: text("scheduled_time").notNull(),
    status: text("status"),
    remark: text("remark").notNull(),
    url: text("url").notNull(),
    codeShares: text("code_shares").notNull(),
    contentHash: text("content_hash").notNull(),
    updatedAt: text("updated_at").notNull(),
    boardDate: text("board_date").notNull(),
    scheduledAt: text("scheduled_at"),
    estimatedAt: text("estimated_at"),
  },
  (table) => [
    index("flights_nature_board_date_idx").on(table.nature, table.boardDate),
    index("flights_nature_scheduled_at_idx").on(
      table.nature,
      table.scheduledAt,
    ),
    index("flights_nature_estimated_at_idx").on(table.nature, table.estimatedAt),
  ],
);

export const storeMeta = sqliteTable("store_meta", {
  nature: text("nature").primaryKey(),
  boardDate: text("board_date").notNull(),
  retainedBoardDates: text("retained_board_dates").notNull(),
  apiDateAwst: text("api_date_awst").notNull(),
  lastScrapeAt: text("last_scrape_at").notNull(),
  lastApiUpdated: text("last_api_updated").notNull(),
  lastApiUpdatedMs: integer("last_api_updated_ms"),
  scrapeRevision: text("scrape_revision").notNull(),
  flightCount: integer("flight_count").notNull(),
  nextDayPrefetch: integer("next_day_prefetch", { mode: "boolean" }).notNull(),
  nextDayHoursBeforeMidnight: integer("next_day_hours_before_midnight").notNull(),
});

export type FlightRow = typeof flights.$inferSelect;
export type FlightInsert = typeof flights.$inferInsert;
export type StoreMetaRow = typeof storeMeta.$inferSelect;
