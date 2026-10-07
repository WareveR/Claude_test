CREATE TABLE `weather_day` (
	`location_id` text NOT NULL,
	`date` text NOT NULL,
	`day` text NOT NULL,
	`hours` text NOT NULL,
	PRIMARY KEY(`location_id`, `date`),
	FOREIGN KEY (`location_id`) REFERENCES `weather_location`(`id`) ON UPDATE no action ON DELETE cascade
);
