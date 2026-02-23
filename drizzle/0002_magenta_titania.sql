ALTER TABLE `terms` ADD `slug` text NOT NULL DEFAULT '';
--> statement-breakpoint
UPDATE `terms` SET `slug` = `id` WHERE `slug` = '';
