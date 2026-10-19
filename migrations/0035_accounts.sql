CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`dev` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`changed_at` text NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_email_unique` ON `account` (`email`);--> statement-breakpoint
-- The Family Password and recovery email become the Owner's Account, who keeps the dev tools.
INSERT INTO `account` (`id`, `person_id`, `email`, `password_hash`, `role`, `dev`, `created_at`, `changed_at`)
SELECT lower(hex(randomblob(16))), NULL, lower(trim(`recovery_email`)), `password_hash`, 'owner', 1, `created_at`, `changed_at`
FROM `family` WHERE `password_hash` <> '';--> statement-breakpoint
UPDATE `family` SET `password_hash` = '';--> statement-breakpoint
-- Recovery links and sessions belonged to the Family Password: every device signs in again.
DELETE FROM `recovery_token`;--> statement-breakpoint
ALTER TABLE `recovery_token` ADD `account_id` text REFERENCES account(id) ON DELETE cascade;--> statement-breakpoint
DROP TABLE `signed_in_device`;--> statement-breakpoint
CREATE TABLE `signed_in_device` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`name` text NOT NULL,
	`session_hash` text NOT NULL,
	`language` text,
	`created_at` text NOT NULL,
	`last_used_at` text NOT NULL,
	`push_subscription` text,
	`reminders_on` integer DEFAULT true NOT NULL,
	`reminder_person_ids` text,
	`kind` text,
	`model` text,
	FOREIGN KEY (`account_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `signed_in_device_session_hash_unique` ON `signed_in_device` (`session_hash`);
