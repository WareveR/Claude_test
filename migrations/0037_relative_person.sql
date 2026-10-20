-- A tree Relative can be a calendar Person, linked when a relation between two Persons is set.
ALTER TABLE `relative` ADD `person_id` text REFERENCES person(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `relative_person_id_unique` ON `relative` (`person_id`);
