-- One more built-in Entry Type per icon group, and colours by group (only where the Family
-- kept the old default); new built-in Checklist templates; Persons' colours move to their own
-- palette (only the old palette's colours), so no Person shares a colour with an Entry Type.
INSERT INTO `entry_type` (`id`, `builtin_key`, `name`, `color`, `icon`, `thumbnail_key`, `defaults`, `created_at`, `changed_at`) SELECT lower(hex(randomblob(12))), 'beauty', NULL, '#d81b60', 'massage', NULL, '{"allDay":false,"durationMinutes":60,"reminders":[1440]}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM `family` WHERE NOT EXISTS (SELECT 1 FROM `entry_type` WHERE `builtin_key` = 'beauty');
--> statement-breakpoint
INSERT INTO `entry_type` (`id`, `builtin_key`, `name`, `color`, `icon`, `thumbnail_key`, `defaults`, `created_at`, `changed_at`) SELECT lower(hex(randomblob(12))), 'meal', NULL, '#f57c00', 'utensils', NULL, '{"allDay":false,"durationMinutes":90}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM `family` WHERE NOT EXISTS (SELECT 1 FROM `entry_type` WHERE `builtin_key` = 'meal');
--> statement-breakpoint
INSERT INTO `entry_type` (`id`, `builtin_key`, `name`, `color`, `icon`, `thumbnail_key`, `defaults`, `created_at`, `changed_at`) SELECT lower(hex(randomblob(12))), 'home', NULL, '#8d6e63', 'home', NULL, '{"allDay":false,"durationMinutes":60}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM `family` WHERE NOT EXISTS (SELECT 1 FROM `entry_type` WHERE `builtin_key` = 'home');
--> statement-breakpoint
INSERT INTO `entry_type` (`id`, `builtin_key`, `name`, `color`, `icon`, `thumbnail_key`, `defaults`, `created_at`, `changed_at`) SELECT lower(hex(randomblob(12))), 'pet', NULL, '#9e9d24', 'paw', NULL, '{"allDay":false,"durationMinutes":30,"reminders":[1440]}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM `family` WHERE NOT EXISTS (SELECT 1 FROM `entry_type` WHERE `builtin_key` = 'pet');
--> statement-breakpoint
INSERT INTO `entry_type` (`id`, `builtin_key`, `name`, `color`, `icon`, `thumbnail_key`, `defaults`, `created_at`, `changed_at`) SELECT lower(hex(randomblob(12))), 'work', NULL, '#3949ab', 'briefcase', NULL, '{"allDay":false,"durationMinutes":60}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM `family` WHERE NOT EXISTS (SELECT 1 FROM `entry_type` WHERE `builtin_key` = 'work');
--> statement-breakpoint
INSERT INTO `entry_type` (`id`, `builtin_key`, `name`, `color`, `icon`, `thumbnail_key`, `defaults`, `created_at`, `changed_at`) SELECT lower(hex(randomblob(12))), 'school', NULL, '#3949ab', 'school', NULL, '{"allDay":false,"durationMinutes":60}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM `family` WHERE NOT EXISTS (SELECT 1 FROM `entry_type` WHERE `builtin_key` = 'school');
--> statement-breakpoint
INSERT INTO `entry_type` (`id`, `builtin_key`, `name`, `color`, `icon`, `thumbnail_key`, `defaults`, `created_at`, `changed_at`) SELECT lower(hex(randomblob(12))), 'payment', NULL, '#00897b', 'card', NULL, '{"allDay":true,"importance":"high","reminders":[4320,0]}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM `family` WHERE NOT EXISTS (SELECT 1 FROM `entry_type` WHERE `builtin_key` = 'payment');
--> statement-breakpoint
UPDATE `entry_type` SET `color` = '#e53935' WHERE `builtin_key` = 'birthday' AND lower(`color`) = '#d1495b';
--> statement-breakpoint
UPDATE `entry_type` SET `color` = '#00acc1' WHERE `builtin_key` = 'holiday' AND lower(`color`) = '#f4a261';
--> statement-breakpoint
UPDATE `entry_type` SET `color` = '#8e24aa' WHERE `builtin_key` = 'booking' AND lower(`color`) = '#8e44ad';
--> statement-breakpoint
UPDATE `entry_type` SET `color` = '#e53935' WHERE `builtin_key` = 'event' AND lower(`color`) = '#c2185b';
--> statement-breakpoint
INSERT INTO `checklist_template` (`id`, `builtin_key`, `name`, `items`, `created_at`, `changed_at`) SELECT lower(hex(randomblob(12))), 'weeklyCleaning', NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM `family` WHERE NOT EXISTS (SELECT 1 FROM `checklist_template` WHERE `builtin_key` = 'weeklyCleaning');
--> statement-breakpoint
INSERT INTO `checklist_template` (`id`, `builtin_key`, `name`, `items`, `created_at`, `changed_at`) SELECT lower(hex(randomblob(12))), 'birthdayParty', NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM `family` WHERE NOT EXISTS (SELECT 1 FROM `checklist_template` WHERE `builtin_key` = 'birthdayParty');
--> statement-breakpoint
INSERT INTO `checklist_template` (`id`, `builtin_key`, `name`, `items`, `created_at`, `changed_at`) SELECT lower(hex(randomblob(12))), 'moving', NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM `family` WHERE NOT EXISTS (SELECT 1 FROM `checklist_template` WHERE `builtin_key` = 'moving');
--> statement-breakpoint
INSERT INTO `checklist_template` (`id`, `builtin_key`, `name`, `items`, `created_at`, `changed_at`) SELECT lower(hex(randomblob(12))), 'beachDay', NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM `family` WHERE NOT EXISTS (SELECT 1 FROM `checklist_template` WHERE `builtin_key` = 'beachDay');
--> statement-breakpoint
INSERT INTO `checklist_template` (`id`, `builtin_key`, `name`, `items`, `created_at`, `changed_at`) SELECT lower(hex(randomblob(12))), 'camping', NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM `family` WHERE NOT EXISTS (SELECT 1 FROM `checklist_template` WHERE `builtin_key` = 'camping');
--> statement-breakpoint
INSERT INTO `checklist_template` (`id`, `builtin_key`, `name`, `items`, `created_at`, `changed_at`) SELECT lower(hex(randomblob(12))), 'christmas', NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM `family` WHERE NOT EXISTS (SELECT 1 FROM `checklist_template` WHERE `builtin_key` = 'christmas');
--> statement-breakpoint
INSERT INTO `checklist_template` (`id`, `builtin_key`, `name`, `items`, `created_at`, `changed_at`) SELECT lower(hex(randomblob(12))), 'hospitalBag', NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM `family` WHERE NOT EXISTS (SELECT 1 FROM `checklist_template` WHERE `builtin_key` = 'hospitalBag');
--> statement-breakpoint
INSERT INTO `checklist_template` (`id`, `builtin_key`, `name`, `items`, `created_at`, `changed_at`) SELECT lower(hex(randomblob(12))), 'gymBag', NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM `family` WHERE NOT EXISTS (SELECT 1 FROM `checklist_template` WHERE `builtin_key` = 'gymBag');
--> statement-breakpoint
INSERT INTO `checklist_template` (`id`, `builtin_key`, `name`, `items`, `created_at`, `changed_at`) SELECT lower(hex(randomblob(12))), 'carService', NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM `family` WHERE NOT EXISTS (SELECT 1 FROM `checklist_template` WHERE `builtin_key` = 'carService');
--> statement-breakpoint
INSERT INTO `checklist_template` (`id`, `builtin_key`, `name`, `items`, `created_at`, `changed_at`) SELECT lower(hex(randomblob(12))), 'winterPrep', NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM `family` WHERE NOT EXISTS (SELECT 1 FROM `checklist_template` WHERE `builtin_key` = 'winterPrep');
--> statement-breakpoint
INSERT INTO `checklist_template` (`id`, `builtin_key`, `name`, `items`, `created_at`, `changed_at`) SELECT lower(hex(randomblob(12))), 'flight', NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM `family` WHERE NOT EXISTS (SELECT 1 FROM `checklist_template` WHERE `builtin_key` = 'flight');
--> statement-breakpoint
INSERT INTO `checklist_template` (`id`, `builtin_key`, `name`, `items`, `created_at`, `changed_at`) SELECT lower(hex(randomblob(12))), 'newPet', NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM `family` WHERE NOT EXISTS (SELECT 1 FROM `checklist_template` WHERE `builtin_key` = 'newPet');
--> statement-breakpoint
UPDATE `person` SET `color` = CASE lower(`color`) WHEN '#e07a5f' THEN '#ffcdd2' WHEN '#d1495b' THEN '#f8bbd0' WHEN '#c2185b' THEN '#e1bee7' WHEN '#8e44ad' THEN '#c5cae9' WHEN '#5c6bc0' THEN '#bbdefb' WHEN '#1e88e5' THEN '#b2ebf2' WHEN '#00897b' THEN '#c8e6c9' WHEN '#43a047' THEN '#f0f4c3' WHEN '#7cb342' THEN '#ffecb3' WHEN '#f4a261' THEN '#ffccbc' WHEN '#8d6e63' THEN '#d7ccc8' WHEN '#607d8b' THEN '#cfd8dc' END WHERE lower(`color`) IN ('#e07a5f', '#d1495b', '#c2185b', '#8e44ad', '#5c6bc0', '#1e88e5', '#00897b', '#43a047', '#7cb342', '#f4a261', '#8d6e63', '#607d8b');
