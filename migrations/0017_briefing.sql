CREATE TABLE `briefing` (
	`scope` text NOT NULL,
	`language` text NOT NULL,
	`segments` text NOT NULL,
	`fallback` integer NOT NULL,
	`written_at` text NOT NULL,
	PRIMARY KEY(`scope`, `language`)
);
