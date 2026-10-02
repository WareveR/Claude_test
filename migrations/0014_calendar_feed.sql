CREATE TABLE `calendar_feed` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`secret_hash` text NOT NULL,
	`family_wide` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`replaced_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `calendar_feed_secret_hash_unique` ON `calendar_feed` (`secret_hash`);--> statement-breakpoint
CREATE TABLE `calendar_feed_person` (
	`feed_id` text NOT NULL,
	`person_id` text NOT NULL,
	PRIMARY KEY(`feed_id`, `person_id`),
	FOREIGN KEY (`feed_id`) REFERENCES `calendar_feed`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE no action
);
