CREATE TABLE `reminder_sent` (
	`key` text PRIMARY KEY NOT NULL,
	`sent_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `signed_in_device` ADD `push_subscription` text;--> statement-breakpoint
ALTER TABLE `signed_in_device` ADD `reminders_on` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `signed_in_device` ADD `reminder_person_ids` text;