CREATE TABLE `entry_lift` (
	`entry_id` text PRIMARY KEY NOT NULL,
	`drop_off_id` text,
	`pick_up_id` text,
	`changed_at` text NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `entry`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`drop_off_id`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`pick_up_id`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE set null
);
