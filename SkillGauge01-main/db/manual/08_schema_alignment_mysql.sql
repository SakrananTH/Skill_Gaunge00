-- MySQL schema alignment migration for legacy databases
-- Purpose:
--   Bring existing DBs (created from older schema revisions) up to date
--   with backend endpoints that read/write extended project/task fields.
--
-- Safe to run multiple times (idempotent).

SET @schema_name := DATABASE();

-- -----------------------------------------------------------------------------
-- projects
-- -----------------------------------------------------------------------------

SET @exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'projects'
    AND COLUMN_NAME = 'project_type'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE projects ADD COLUMN project_type VARCHAR(120) NULL',
  'SELECT ''skip projects.project_type'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'projects'
    AND COLUMN_NAME = 'site_address'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE projects ADD COLUMN site_address VARCHAR(255) NULL',
  'SELECT ''skip projects.site_address'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'projects'
    AND COLUMN_NAME = 'latitude'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE projects ADD COLUMN latitude DECIMAL(10,6) NULL',
  'SELECT ''skip projects.latitude'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'projects'
    AND COLUMN_NAME = 'longitude'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE projects ADD COLUMN longitude DECIMAL(10,6) NULL',
  'SELECT ''skip projects.longitude'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'projects'
    AND COLUMN_NAME = 'start_date'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE projects ADD COLUMN start_date DATE NULL',
  'SELECT ''skip projects.start_date'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'projects'
    AND COLUMN_NAME = 'end_date'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE projects ADD COLUMN end_date DATE NULL',
  'SELECT ''skip projects.end_date'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'projects'
    AND COLUMN_NAME = 'description'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE projects ADD COLUMN description TEXT NULL',
  'SELECT ''skip projects.description'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- -----------------------------------------------------------------------------
-- tasks
-- -----------------------------------------------------------------------------

SET @exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'tasks'
    AND COLUMN_NAME = 'description'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE tasks ADD COLUMN description TEXT NULL',
  'SELECT ''skip tasks.description'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'tasks'
    AND COLUMN_NAME = 'category'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE tasks ADD COLUMN category VARCHAR(120) NULL',
  'SELECT ''skip tasks.category'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'tasks'
    AND COLUMN_NAME = 'required_workers'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE tasks ADD COLUMN required_workers INT UNSIGNED NULL',
  'SELECT ''skip tasks.required_workers'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'tasks'
    AND COLUMN_NAME = 'required_level'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE tasks ADD COLUMN required_level INT UNSIGNED NULL',
  'SELECT ''skip tasks.required_level'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- -----------------------------------------------------------------------------
-- quick verification output
-- -----------------------------------------------------------------------------
SELECT COLUMN_NAME, COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = @schema_name
  AND TABLE_NAME = 'projects'
  AND COLUMN_NAME IN ('project_type', 'site_address', 'latitude', 'longitude', 'start_date', 'end_date', 'description')
ORDER BY COLUMN_NAME;

SELECT COLUMN_NAME, COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = @schema_name
  AND TABLE_NAME = 'tasks'
  AND COLUMN_NAME IN ('description', 'category', 'required_workers', 'required_level')
ORDER BY COLUMN_NAME;
