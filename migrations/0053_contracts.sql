CREATE TABLE `contract` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`provider` text DEFAULT '' NOT NULL,
	`amount` integer,
	`frequency` text DEFAULT 'monthly' NOT NULL,
	`payment` text DEFAULT 'manual' NOT NULL,
	`pay_day` integer,
	`pay_month` integer,
	`renewal_date` text,
	`notes` text DEFAULT '' NOT NULL,
	`task_series_id` text,
	`created_at` text NOT NULL,
	`changed_at` text NOT NULL
);
