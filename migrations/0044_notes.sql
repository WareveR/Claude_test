CREATE TABLE `note` (
	`id` text PRIMARY KEY NOT NULL,
	`text` text NOT NULL,
	`color` text NOT NULL,
	`until` text,
	`author_account_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`author_account_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE set null
);
