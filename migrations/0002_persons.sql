CREATE TABLE `image` (
	`key` text PRIMARY KEY NOT NULL,
	`content_type` text NOT NULL,
	`created_at` text NOT NULL,
	`last_used_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `person` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`photo_key` text,
	`date_of_birth` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`changed_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `person_nickname` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`nickname` text NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE cascade
);
