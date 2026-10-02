CREATE TABLE `checklist` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`start_date` text,
	`end_date` text,
	`created_at` text NOT NULL,
	`changed_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `checklist_person` (
	`checklist_id` text NOT NULL,
	`person_id` text NOT NULL,
	PRIMARY KEY(`checklist_id`, `person_id`),
	FOREIGN KEY (`checklist_id`) REFERENCES `checklist`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `task` ADD `checklist_id` text REFERENCES checklist(id);