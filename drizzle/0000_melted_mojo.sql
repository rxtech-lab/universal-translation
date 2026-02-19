CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`format_id` text NOT NULL,
	`source_language` text,
	`target_language` text,
	`source_locale` text,
	`target_locale` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`blob_url` text,
	`content` text,
	`format_data` text,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `terms` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`original_text` text NOT NULL,
	`translation` text DEFAULT '' NOT NULL,
	`comment` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
