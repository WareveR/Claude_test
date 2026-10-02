CREATE TABLE `occurrence_exception` (
	`entry_id` text NOT NULL,
	`original_date` text NOT NULL,
	`skipped` integer DEFAULT false NOT NULL,
	`override` text,
	PRIMARY KEY(`entry_id`, `original_date`),
	FOREIGN KEY (`entry_id`) REFERENCES `entry`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `entry` ADD `series_id` text;