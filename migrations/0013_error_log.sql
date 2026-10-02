CREATE TABLE `error_log` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`at` text NOT NULL,
	`source` text NOT NULL,
	`device_name` text,
	`app_version` text NOT NULL,
	`action` text NOT NULL,
	`message` text NOT NULL,
	`comment` text,
	`reported_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `error_log_code_unique` ON `error_log` (`code`);--> statement-breakpoint
CREATE TABLE `scheduler_run` (
	`job` text NOT NULL,
	`key` text NOT NULL,
	`at` text NOT NULL,
	PRIMARY KEY(`job`, `key`)
);
