CREATE TABLE `medication` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`name` text NOT NULL,
	`dose` text DEFAULT '' NOT NULL,
	`times` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`private` integer DEFAULT true NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_by` text,
	`created_at` text NOT NULL,
	`changed_at` text NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `medication_dose` (
	`id` text PRIMARY KEY NOT NULL,
	`medication_id` text NOT NULL,
	`date` text NOT NULL,
	`time` text NOT NULL,
	`taken_at` text NOT NULL,
	`taken_by` text,
	FOREIGN KEY (`medication_id`) REFERENCES `medication`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`taken_by`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `medication_dose_due` ON `medication_dose` (`medication_id`,`date`,`time`);