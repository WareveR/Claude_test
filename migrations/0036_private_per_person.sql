-- Who made each Entry and Task, so a Private one shows in full only to them and its Persons.
-- Existing rows have no creator: none is Private yet (the Family's data was cleared).
ALTER TABLE `entry` ADD `created_by` text REFERENCES account(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `task` ADD `created_by` text REFERENCES account(id) ON DELETE SET NULL;
