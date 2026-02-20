CREATE TABLE `waiting_list` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`approved` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `waiting_list_email_unique` ON `waiting_list` (`email`);