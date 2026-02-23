-- Makes users.email optional when the column exists.
-- Safe to run multiple times.

USE bcc_voip_directory;

SET @email_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'email'
);

SET @alter_sql := IF(
  @email_exists > 0,
  'ALTER TABLE users MODIFY COLUMN email VARCHAR(255) NULL;',
  'SELECT ''users.email column not found - no change applied'';'
);

PREPARE stmt FROM @alter_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
