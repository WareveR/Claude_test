ALTER TABLE `checklist` ADD `entry_id` text REFERENCES entry(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `task` ADD `entry_id` text REFERENCES entry(id) ON DELETE SET NULL;