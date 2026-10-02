ALTER TABLE `entry` ADD `birthday_person_id` text REFERENCES person(id);--> statement-breakpoint
ALTER TABLE `entry` ADD `birth_year_known` integer DEFAULT false NOT NULL;