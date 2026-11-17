CREATE TABLE `countdown_mark` (
	`entry_id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `entry`(`id`) ON UPDATE no action ON DELETE cascade
);
