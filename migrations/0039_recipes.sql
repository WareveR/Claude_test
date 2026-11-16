CREATE TABLE `recipe` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`servings` integer DEFAULT 4 NOT NULL,
	`minutes` integer,
	`tags` text DEFAULT '[]' NOT NULL,
	`ingredients` text DEFAULT '[]' NOT NULL,
	`steps` text DEFAULT '' NOT NULL,
	`source` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`photo_key` text,
	`favourite` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`changed_at` text NOT NULL
);
