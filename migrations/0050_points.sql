CREATE TABLE `points_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`points` integer NOT NULL,
	`task_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `task`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `points_goal` (
	`person_id` text PRIMARY KEY NOT NULL,
	`goal` integer NOT NULL,
	`reward` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `task` ADD `points` integer DEFAULT 0 NOT NULL;