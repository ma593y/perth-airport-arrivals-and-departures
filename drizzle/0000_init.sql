CREATE TABLE `flights` (
	`flight_key` text PRIMARY KEY NOT NULL,
	`nature` text NOT NULL,
	`airline_logo` text,
	`airline_name` text,
	`flight_number` text NOT NULL,
	`port_name` text NOT NULL,
	`flight_nature` text NOT NULL,
	`terminal` text,
	`estimated_time` text,
	`scheduled_time` text NOT NULL,
	`status` text,
	`remark` text NOT NULL,
	`url` text NOT NULL,
	`code_shares` text NOT NULL,
	`content_hash` text NOT NULL,
	`updated_at` text NOT NULL,
	`board_date` text NOT NULL,
	`scheduled_at` text,
	`estimated_at` text
);
--> statement-breakpoint
CREATE INDEX `flights_nature_board_date_idx` ON `flights` (`nature`,`board_date`);--> statement-breakpoint
CREATE INDEX `flights_nature_scheduled_at_idx` ON `flights` (`nature`,`scheduled_at`);--> statement-breakpoint
CREATE INDEX `flights_nature_estimated_at_idx` ON `flights` (`nature`,`estimated_at`);--> statement-breakpoint
CREATE TABLE `store_meta` (
	`nature` text PRIMARY KEY NOT NULL,
	`board_date` text NOT NULL,
	`retained_board_dates` text NOT NULL,
	`api_date_awst` text NOT NULL,
	`last_scrape_at` text NOT NULL,
	`last_api_updated` text NOT NULL,
	`last_api_updated_ms` integer,
	`scrape_revision` text NOT NULL,
	`flight_count` integer NOT NULL,
	`next_day_prefetch` integer NOT NULL,
	`next_day_hours_before_midnight` integer NOT NULL
);
