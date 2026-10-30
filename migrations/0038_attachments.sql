-- Photos and files attached to an Entry, a loose Task or a Task with items (a Checklist).
CREATE TABLE `attachment` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text,
	`task_id` text,
	`checklist_id` text,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`created_by` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `entry`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `task`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`checklist_id`) REFERENCES `checklist`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE set null
);
