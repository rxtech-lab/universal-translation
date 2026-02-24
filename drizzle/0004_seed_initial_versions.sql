INSERT INTO `project_versions` (`id`, `project_id`, `content`, `format_data`, `created_at`)
SELECT
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
  `id`,
  `content`,
  `format_data`,
  `updated_at`
FROM `projects`
WHERE `content` IS NOT NULL;
