CREATE TABLE `recovery_token` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`purpose` text NOT NULL,
	`new_email` text,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recovery_token_token_hash_unique` ON `recovery_token` (`token_hash`);