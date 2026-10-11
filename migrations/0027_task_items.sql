-- Checklist items nest: an item can hold items of its own (parent_id).
ALTER TABLE `task` ADD `parent_id` text REFERENCES task(id) ON DELETE CASCADE;--> statement-breakpoint
-- Each section of a Checklist becomes an item holding that section's items, marked for a moment
-- by its notes so its items can find it. It is done when all of them are.
INSERT INTO `task` (`id`, `title`, `notes`, `private`, `checklist_id`, `section`, `importance`, `done_at`, `created_at`, `changed_at`)
SELECT lower(hex(randomblob(12))), `section`, '~section~', 0, `checklist_id`, '', 'normal',
  CASE WHEN sum(`done_at` IS NULL) = 0 THEN max(`done_at`) END, min(`created_at`), max(`changed_at`)
FROM `task`
WHERE `checklist_id` IS NOT NULL AND `section` <> ''
GROUP BY `checklist_id`, `section`;--> statement-breakpoint
UPDATE `task` SET `parent_id` = (
  SELECT `p`.`id` FROM `task` AS `p`
  WHERE `p`.`notes` = '~section~' AND `p`.`checklist_id` = `task`.`checklist_id` AND `p`.`title` = `task`.`section`
)
WHERE `checklist_id` IS NOT NULL AND `section` <> '';--> statement-breakpoint
UPDATE `task` SET `section` = '' WHERE `section` <> '';--> statement-breakpoint
UPDATE `task` SET `notes` = '' WHERE `notes` = '~section~';
