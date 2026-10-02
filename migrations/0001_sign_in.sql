CREATE TABLE `sign_in_throttle` (
	`key` text PRIMARY KEY NOT NULL,
	`failures` integer NOT NULL,
	`last_failure_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `signed_in_device` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`session_hash` text NOT NULL,
	`language` text,
	`created_at` text NOT NULL,
	`last_used_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `signed_in_device_session_hash_unique` ON `signed_in_device` (`session_hash`);--> statement-breakpoint
ALTER TABLE `family` ADD `password_hash` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `family` ADD `recovery_email` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `family` ADD `setup_code_hash` text DEFAULT '' NOT NULL;