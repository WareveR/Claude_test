CREATE TABLE `gift_idea` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`text` text NOT NULL,
	`link` text DEFAULT '' NOT NULL,
	`occasion` text DEFAULT 'any' NOT NULL,
	`given_on` text,
	`created_by` text,
	`created_at` text NOT NULL,
	`changed_at` text NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE set null
);
