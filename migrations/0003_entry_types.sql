CREATE TABLE `entry_type` (
	`id` text PRIMARY KEY NOT NULL,
	`builtin_key` text,
	`name` text,
	`color` text NOT NULL,
	`icon` text,
	`thumbnail_key` text,
	`defaults` text NOT NULL,
	`created_at` text NOT NULL,
	`changed_at` text NOT NULL
);
