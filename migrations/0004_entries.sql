CREATE TABLE `entry` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`entry_type_id` text NOT NULL,
	`all_day` integer NOT NULL,
	`start_date` text NOT NULL,
	`start_time` text,
	`end_date` text,
	`end_time` text,
	`importance` text DEFAULT 'normal' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`icon` text,
	`private` integer DEFAULT false NOT NULL,
	`reminders` text NOT NULL,
	`repetition` text,
	`created_at` text NOT NULL,
	`changed_at` text NOT NULL,
	FOREIGN KEY (`entry_type_id`) REFERENCES `entry_type`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `entry_person` (
	`entry_id` text NOT NULL,
	`person_id` text NOT NULL,
	PRIMARY KEY(`entry_id`, `person_id`),
	FOREIGN KEY (`entry_id`) REFERENCES `entry`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE no action
);
