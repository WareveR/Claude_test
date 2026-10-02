CREATE TABLE `briefing_pending` (
	`id` integer PRIMARY KEY NOT NULL
);
--> statement-breakpoint
ALTER TABLE `briefing` ADD `week` text DEFAULT '' NOT NULL;