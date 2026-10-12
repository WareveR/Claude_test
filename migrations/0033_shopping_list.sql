CREATE TABLE `shopping_item` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`quantity` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`store` text DEFAULT '' NOT NULL,
	`bought_at` text,
	`created_at` text NOT NULL,
	`changed_at` text NOT NULL
);
