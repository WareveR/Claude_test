CREATE TABLE `checklist_template` (
	`id` text PRIMARY KEY NOT NULL,
	`builtin_key` text,
	`name` text,
	`items` text,
	`created_at` text NOT NULL,
	`changed_at` text NOT NULL
);--> statement-breakpoint
-- An existing Family gets the built-in templates; a new one gets them when it is set up.
INSERT INTO `checklist_template` (`id`, `builtin_key`, `name`, `items`, `created_at`, `changed_at`) SELECT lower(hex(randomblob(12))), 'summerCleaning', NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM `family`;
--> statement-breakpoint
INSERT INTO `checklist_template` (`id`, `builtin_key`, `name`, `items`, `created_at`, `changed_at`) SELECT lower(hex(randomblob(12))), 'decluttering', NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM `family`;
--> statement-breakpoint
INSERT INTO `checklist_template` (`id`, `builtin_key`, `name`, `items`, `created_at`, `changed_at`) SELECT lower(hex(randomblob(12))), 'shopping', NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM `family`;
--> statement-breakpoint
INSERT INTO `checklist_template` (`id`, `builtin_key`, `name`, `items`, `created_at`, `changed_at`) SELECT lower(hex(randomblob(12))), 'backToSchool', NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM `family`;
--> statement-breakpoint
INSERT INTO `checklist_template` (`id`, `builtin_key`, `name`, `items`, `created_at`, `changed_at`) SELECT lower(hex(randomblob(12))), 'holidayPacking', NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM `family`;
