USE bcc_voip_directory;

SET @db = DATABASE();

SELECT COUNT(*) INTO @old_extension_col_exists
FROM information_schema.columns
WHERE table_schema = @db
  AND table_name = 'extensions'
  AND column_name = 'old_extension_number';

SET @sql = IF(
  @old_extension_col_exists = 0,
  'ALTER TABLE extensions ADD COLUMN old_extension_number VARCHAR(10) NULL AFTER extension_number',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT COUNT(*) INTO @old_extension_idx_exists
FROM information_schema.statistics
WHERE table_schema = @db
  AND table_name = 'extensions'
  AND index_name = 'idx_extensions_old_extension_number';

SET @sql = IF(
  @old_extension_idx_exists = 0,
  'ALTER TABLE extensions ADD INDEX idx_extensions_old_extension_number (old_extension_number)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
