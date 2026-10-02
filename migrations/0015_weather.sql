CREATE TABLE `weather_cache` (
	`location_id` text PRIMARY KEY NOT NULL,
	`forecast` text,
	`fetched_at` text,
	`attempted_at` text NOT NULL,
	FOREIGN KEY (`location_id`) REFERENCES `weather_location`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `weather_location` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`admin` text NOT NULL,
	`country` text NOT NULL,
	`country_code` text NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `family` ADD `selected_weather_location_id` text;