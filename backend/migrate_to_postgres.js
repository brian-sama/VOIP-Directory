/**
 * VOIP Directory — MySQL to PostgreSQL data migration
 * Run ONCE on the server after PostgreSQL is installed:
 *   node migrate_to_postgres.js
 *
 * Prerequisites (handled by setup_postgres.ps1):
 *   - MySQL running with bcc_voip_directory data
 *   - PostgreSQL installed and running
 *   - Target database created: CREATE DATABASE bcc_voip_directory;
 *   - npm install pg
 */

'use strict';

const mysql = require('mysql2/promise');
const { Pool } = require('pg');

const MYSQL_CFG = {
  host:           '127.0.0.1',
  user:           'voipapp',
  password:       'Cityvoip@502',
  database:       'bcc_voip_directory',
  connectTimeout: 10000,
};

const PG_CFG = {
  host:     '127.0.0.1',
  port:     5432,
  user:     'postgres',
  password: 'Cityvoip@502',
  database: 'bcc_voip_directory',
};

// Insert in dependency order so parent rows exist before children
const TABLE_ORDER = ['users', 'admins', 'extensions', 'activity_logs', 'ping_logs'];

// Tables with millions of rows that are safe to skip (they rebuild automatically)
const SKIP_TABLES = ['ping_logs'];

// ── Type mapping ─────────────────────────────────────────────────────────────

function toPgType(dataType, columnType, extra) {
  const dt  = dataType.toUpperCase();
  const ct  = columnType.toUpperCase();
  const inc = /AUTO_INCREMENT/i.test(extra);

  if (inc)             return dt === 'BIGINT' ? 'BIGSERIAL' : 'SERIAL';
  if (ct === 'TINYINT(1)') return 'BOOLEAN';

  switch (dt) {
    case 'TINYINT':    return 'SMALLINT';
    case 'SMALLINT':   return 'SMALLINT';
    case 'MEDIUMINT':  return 'INTEGER';
    case 'INT':
    case 'INTEGER':    return 'INTEGER';
    case 'BIGINT':     return 'BIGINT';
    case 'FLOAT':      return 'REAL';
    case 'DOUBLE':     return 'DOUBLE PRECISION';
    case 'DECIMAL':
    case 'NUMERIC': {
      const m = ct.match(/(?:DECIMAL|NUMERIC)\((\d+),(\d+)\)/);
      return m ? `NUMERIC(${m[1]},${m[2]})` : 'NUMERIC';
    }
    case 'DATE':       return 'DATE';
    case 'TIME':       return 'TIME';
    case 'DATETIME':
    case 'TIMESTAMP':  return 'TIMESTAMP';
    case 'YEAR':       return 'SMALLINT';
    case 'CHAR': {
      const m = ct.match(/CHAR\((\d+)\)/);
      return m ? `CHAR(${m[1]})` : 'TEXT';
    }
    case 'VARCHAR': {
      const m = ct.match(/VARCHAR\((\d+)\)/);
      return m ? `VARCHAR(${m[1]})` : 'TEXT';
    }
    case 'TINYTEXT':
    case 'TEXT':
    case 'MEDIUMTEXT':
    case 'LONGTEXT':   return 'TEXT';
    case 'TINYBLOB':
    case 'BLOB':
    case 'MEDIUMBLOB':
    case 'LONGBLOB':   return 'BYTEA';
    case 'JSON':       return 'JSONB';
    case 'ENUM':
    case 'SET':        return 'TEXT';
    case 'BOOLEAN':
    case 'BOOL':       return 'BOOLEAN';
    default:           return 'TEXT';
  }
}

function convertValue(value, pgType) {
  if (value === null || value === undefined) return null;
  if (pgType === 'BOOLEAN') return value === 1 || value === true || value === '1';
  if (pgType === 'JSONB' && typeof value === 'string') {
    try { JSON.parse(value); return value; } catch { return null; }
  }
  return value;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function migrate() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   VOIP Directory — MySQL → PostgreSQL Migration      ║');
  console.log(`║   ${new Date().toLocaleString().padEnd(50)}║`);
  console.log('╚══════════════════════════════════════════════════════╝\n');

  // Connect MySQL
  process.stdout.write('→ Connecting to MySQL      ... ');
  let my;
  try {
    my = await mysql.createConnection(MYSQL_CFG);
    console.log('[OK]');
  } catch (e) {
    console.log('[FAIL]\n  ' + e.message);
    process.exit(1);
  }

  // Connect PostgreSQL
  process.stdout.write('→ Connecting to PostgreSQL ... ');
  const pgPool = new Pool(PG_CFG);
  let pg;
  try {
    pg = await pgPool.connect();
    console.log('[OK]\n');
  } catch (e) {
    console.log('[FAIL]\n  ' + e.message);
    console.log('  Ensure PostgreSQL is running and the database exists:');
    console.log('  psql -U postgres -c "CREATE DATABASE bcc_voip_directory;"');
    await my.end();
    process.exit(1);
  }

  const stats = { tables: 0, rows: 0, failed: 0 };

  try {
    // Discover tables
    const [tableRows] = await my.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'`,
      [MYSQL_CFG.database]
    );
    const discovered = tableRows.map(r => r.TABLE_NAME);

    // Sort: known tables in dependency order first, then any extras
    const ordered = [
      ...TABLE_ORDER.filter(t => discovered.includes(t)),
      ...discovered.filter(t => !TABLE_ORDER.includes(t)),
    ];

    console.log(`Tables to migrate: ${ordered.join(', ')}\n`);

    for (const table of ordered) {
      if (SKIP_TABLES.includes(table)) {
        console.log(`── ${table}`);
        console.log('  [SKIP] Monitoring log — will rebuild automatically. Creating empty table.\n');
        // Still create the schema so the app can write to it
        const [cols] = await my.query(
          `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE,
                  COLUMN_DEFAULT, EXTRA, COLUMN_KEY
           FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
           ORDER BY ORDINAL_POSITION`,
          [MYSQL_CFG.database, table]
        );
        const typeMap = {};
        const colDefs = [];
        for (const c of cols) {
          const pt = toPgType(c.DATA_TYPE, c.COLUMN_TYPE, c.EXTRA);
          typeMap[c.COLUMN_NAME] = pt;
          const isSerial = pt === 'SERIAL' || pt === 'BIGSERIAL';
          let def = `  "${c.COLUMN_NAME}" ${pt}`;
          if (c.COLUMN_KEY === 'PRI') def += ' PRIMARY KEY';
          if (!isSerial && c.IS_NULLABLE === 'NO') def += ' NOT NULL';
          if (!isSerial && c.COLUMN_DEFAULT !== null) {
            const dv = c.COLUMN_DEFAULT;
            if (/^CURRENT_TIMESTAMP/i.test(dv) || dv === 'current_timestamp()') {
              def += ' DEFAULT CURRENT_TIMESTAMP';
            } else if (pt === 'BOOLEAN') {
              def += ` DEFAULT ${dv === '1' ? 'TRUE' : 'FALSE'}`;
            } else if (/^\d+(\.\d+)?$/.test(dv)) {
              def += ` DEFAULT ${dv}`;
            } else {
              def += ` DEFAULT '${dv.replace(/'/g, "''")}'`;
            }
          }
          colDefs.push(def);
        }
        await pg.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
        await pg.query(`CREATE TABLE "${table}" (\n${colDefs.join(',\n')}\n)`).catch(e => {
          console.warn(`  [WARN] Schema: ${e.message}`);
        });
        stats.tables++;
        continue;
      }

      console.log(`── ${table}`);

      // Get column definitions from information_schema
      const [cols] = await my.query(
        `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE,
                COLUMN_DEFAULT, EXTRA, COLUMN_KEY
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
         ORDER BY ORDINAL_POSITION`,
        [MYSQL_CFG.database, table]
      );

      // Build PostgreSQL CREATE TABLE
      const typeMap  = {};
      const colDefs  = [];

      for (const c of cols) {
        const pt    = toPgType(c.DATA_TYPE, c.COLUMN_TYPE, c.EXTRA);
        typeMap[c.COLUMN_NAME] = pt;
        const isSerial = pt === 'SERIAL' || pt === 'BIGSERIAL';

        let def = `  "${c.COLUMN_NAME}" ${pt}`;

        if (c.COLUMN_KEY === 'PRI') def += ' PRIMARY KEY';
        if (!isSerial && c.IS_NULLABLE === 'NO') def += ' NOT NULL';

        if (!isSerial && c.COLUMN_DEFAULT !== null) {
          const dv = c.COLUMN_DEFAULT;
          if (/^CURRENT_TIMESTAMP/i.test(dv) || dv === 'current_timestamp()') {
            def += ' DEFAULT CURRENT_TIMESTAMP';
          } else if (pt === 'BOOLEAN') {
            def += ` DEFAULT ${dv === '1' ? 'TRUE' : 'FALSE'}`;
          } else if (/^\d+(\.\d+)?$/.test(dv)) {
            def += ` DEFAULT ${dv}`;
          } else {
            def += ` DEFAULT '${dv.replace(/'/g, "''")}'`;
          }
        }

        colDefs.push(def);
      }

      // Recreate table
      await pg.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
      const ddl = `CREATE TABLE "${table}" (\n${colDefs.join(',\n')}\n)`;

      try {
        await pg.query(ddl);
        console.log('  [OK] Schema created');
      } catch (e) {
        console.error(`  [FAIL] Schema: ${e.message}`);
        console.error(`         DDL: ${ddl}`);
        stats.failed++;
        continue;
      }

      // Count rows first so we can show progress without loading everything
      const [[{ total }]] = await my.query(`SELECT COUNT(*) AS total FROM \`${table}\``);
      if (total === 0) {
        console.log('  [OK] 0 rows (empty table)\n');
        stats.tables++;
        continue;
      }

      const colNames  = cols.map(c => c.COLUMN_NAME);
      const colList   = colNames.map(c => `"${c}"`).join(', ');
      const serialCol = cols.find(c => /AUTO_INCREMENT/i.test(c.EXTRA));
      // Fetch in pages of 500 rows. Use cursor-based pagination (WHERE id > lastId)
      // when a serial/PK column exists — stays fast on tables with millions of rows.
      // Fall back to OFFSET only for tables without a numeric PK.
      const PAGE     = 500;
      let   inserted = 0;
      let   lastId   = 0;
      let   offset   = 0;
      let   fetched;

      do {
        let rows;
        if (serialCol) {
          [rows] = await my.query(
            `SELECT * FROM \`${table}\` WHERE \`${serialCol.COLUMN_NAME}\` > ? ORDER BY \`${serialCol.COLUMN_NAME}\` LIMIT ${PAGE}`,
            [lastId]
          );
          if (rows.length) lastId = rows[rows.length - 1][serialCol.COLUMN_NAME];
        } else {
          [rows] = await my.query(
            `SELECT * FROM \`${table}\` LIMIT ${PAGE} OFFSET ${offset}`
          );
          offset += rows.length;
        }
        fetched = rows.length;

        if (!fetched) break;

        const placeholders = [];
        const values       = [];
        let   idx          = 1;

        for (const row of rows) {
          placeholders.push(`(${colNames.map(() => `$${idx++}`).join(', ')})`);
          for (const col of colNames) values.push(convertValue(row[col], typeMap[col]));
        }

        const sql = `INSERT INTO "${table}" (${colList}) VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING`;

        try {
          const r = await pg.query(sql, values);
          inserted += r.rowCount;
        } catch (batchErr) {
          // Retry row by row to recover as many as possible
          for (const row of rows) {
            const vals = colNames.map(c => convertValue(row[c], typeMap[c]));
            const ph   = colNames.map((_, k) => `$${k + 1}`).join(', ');
            try {
              await pg.query(`INSERT INTO "${table}" (${colList}) VALUES (${ph}) ON CONFLICT DO NOTHING`, vals);
              inserted++;
            } catch (rowErr) {
              console.warn(`  [WARN] Row skipped: ${rowErr.message.slice(0, 100)}`);
              stats.failed++;
            }
          }
        }

        process.stdout.write(`\r  Migrating... ${inserted}/${total} rows`);
      } while (fetched === PAGE);

      // Advance the SERIAL sequence past the highest existing id
      if (serialCol) {
        try {
          await pg.query(
            `SELECT setval(
               pg_get_serial_sequence('"${table}"', '${serialCol.COLUMN_NAME}'),
               COALESCE(MAX("${serialCol.COLUMN_NAME}"), 1)
             ) FROM "${table}"`
          );
        } catch { /* non-fatal */ }
      }

      process.stdout.write('\n');
      console.log(`  [OK] ${inserted}/${total} rows migrated\n`);
      stats.rows   += inserted;
      stats.tables++;
    }

  } finally {
    pg.release();
    await pgPool.end();
    await my.end();
  }

  console.log('── Summary ──────────────────────────────────────────────');
  console.log(`  Tables migrated : ${stats.tables}`);
  console.log(`  Total rows      : ${stats.rows}`);
  console.log(`  Errors/skipped  : ${stats.failed}`);

  if (stats.failed === 0) {
    console.log('\n[OK] All data migrated successfully.\n');
  } else {
    console.log('\n[WARN] Some rows were skipped — check output above.\n');
  }
}

migrate().catch(e => {
  console.error('\n[FAIL] Migration crashed:', e.message);
  process.exit(1);
});
