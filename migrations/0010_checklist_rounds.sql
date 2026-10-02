CREATE TABLE `checklist_round` (
	`id` text PRIMARY KEY NOT NULL,
	`checklist_id` text NOT NULL,
	`label` text NOT NULL,
	`done` integer NOT NULL,
	`total` integer NOT NULL,
	`closed_at` text NOT NULL,
	FOREIGN KEY (`checklist_id`) REFERENCES `checklist`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `checklist` ADD `repetition` text;