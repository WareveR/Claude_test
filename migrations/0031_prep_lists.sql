-- Two more built-in lists, made ready for new Entries: a swimming bag and what to take to an
-- appointment.
INSERT INTO `checklist_template` (`id`, `builtin_key`, `name`, `items`, `created_at`, `changed_at`) SELECT lower(hex(randomblob(12))), 'swimming', NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM `family` WHERE NOT EXISTS (SELECT 1 FROM `checklist_template` WHERE `builtin_key` = 'swimming');
--> statement-breakpoint
INSERT INTO `checklist_template` (`id`, `builtin_key`, `name`, `items`, `created_at`, `changed_at`) SELECT lower(hex(randomblob(12))), 'appointment', NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM `family` WHERE NOT EXISTS (SELECT 1 FROM `checklist_template` WHERE `builtin_key` = 'appointment');
