CREATE TABLE `meal` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`slot` text NOT NULL,
	`recipe_id` text,
	`text` text DEFAULT '' NOT NULL,
	`servings` integer,
	`created_at` text NOT NULL,
	`changed_at` text NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipe`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `meal_date_slot_idx` ON `meal` (`date`,`slot`);