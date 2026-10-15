CREATE TABLE `relative` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`nickname` text DEFAULT '' NOT NULL,
	`sex` text DEFAULT '' NOT NULL,
	`birth_date` text,
	`death_date` text,
	`birth_place` text DEFAULT '' NOT NULL,
	`photo_key` text,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`changed_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `relative_parent` (
	`child_id` text NOT NULL,
	`parent_id` text NOT NULL,
	PRIMARY KEY(`child_id`, `parent_id`),
	FOREIGN KEY (`child_id`) REFERENCES `relative`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `relative`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `relative_partner` (
	`a_id` text NOT NULL,
	`b_id` text NOT NULL,
	PRIMARY KEY(`a_id`, `b_id`),
	FOREIGN KEY (`a_id`) REFERENCES `relative`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`b_id`) REFERENCES `relative`(`id`) ON UPDATE no action ON DELETE cascade
);
