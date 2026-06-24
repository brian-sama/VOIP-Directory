const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host:                    process.env.DB_HOST     || 'localhost',
  port:                    parseInt(process.env.DB_PORT || '5432'),
  user:                    process.env.DB_USER     || 'postgres',
  password:                process.env.DB_PASSWORD,
  database:                process.env.DB_NAME     || 'bcc_voip_directory',
  max:                     20,
  idleTimeoutMillis:       30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('[DB] Pool error:', err.message);
});

// Rewrite MySQL SQL dialects to PostgreSQL so existing routes need no changes.
function rewrite(sql) {
  let s = sql;
  // Backtick identifiers → double-quoted
  s = s.replace(/`([^`]+)`/g, '"$1"');
  // ? params → $1 $2 ...
  let n = 0;
  s = s.replace(/\?/g, () => `$${++n}`);
  // INSERT IGNORE INTO → INSERT INTO ... ON CONFLICT DO NOTHING
  if (/INSERT\s+IGNORE\s+INTO/i.test(s)) {
    s = s.replace(/INSERT\s+IGNORE\s+INTO/gi, 'INSERT INTO');
    s = s.trimEnd() + ' ON CONFLICT DO NOTHING';
  }
  // UPDATE IGNORE → UPDATE  (no direct PG equivalent; unique errors surfaced as exceptions)
  s = s.replace(/\bUPDATE\s+IGNORE\b/gi, 'UPDATE');
  // DATE_SUB(NOW(), INTERVAL $n DAY) → (NOW() - $n * INTERVAL '1 day')
  s = s.replace(
    /DATE_SUB\s*\(\s*NOW\s*\(\s*\)\s*,\s*INTERVAL\s+(\$\d+|\d+)\s+DAY\s*\)/gi,
    "(NOW() - $1 * INTERVAL '1 day')"
  );
  // MySQL LIMIT offset, count → LIMIT count OFFSET offset
  s = s.replace(/\bLIMIT\s+(\d+)\s*,\s*(\d+)/gi, 'LIMIT $2 OFFSET $1');
  // SHOW TABLES → pg_tables equivalent (Object.values still works on the result)
  s = s.replace(
    /^SHOW\s+TABLES\s*;?\s*$/i,
    "SELECT tablename AS table_name FROM pg_tables WHERE schemaname = 'public'"
  );
  return s;
}

// Run a rewritten query against any pg client/pool runner.
// Returns [rows|meta, fields] to mirror the mysql2 promise interface.
async function execQuery(runner, sql, params = []) {
  const pgSql  = rewrite(sql);
  const result = await runner(pgSql, params.length ? params : undefined);
  const cmd    = pgSql.trimStart().split(/\s+/)[0].toUpperCase();

  if (cmd === 'SELECT' || cmd === 'WITH') {
    return [result.rows, result.fields || []];
  }
  // INSERT / UPDATE / DELETE — return mysql2-style metadata object
  return [
    { affectedRows: result.rowCount || 0, insertId: result.rows?.[0]?.id || 0 },
    [],
  ];
}

// Save original pool.query before we overwrite it
const _rawQuery = pool.query.bind(pool);

// mysql2-compatible pool.query(sql, params) → [rows, fields]
pool.query = (sql, params) => execQuery((s, p) => _rawQuery(s, p), sql, params);

// mysql2-compatible getConnection() for transactions
pool.getConnection = async () => {
  const client = await pool.connect();
  return {
    query:            (sql, params) => execQuery((s, p) => client.query(s, p), sql, params),
    beginTransaction: ()            => client.query('BEGIN'),
    commit:           ()            => client.query('COMMIT'),
    rollback:         ()            => client.query('ROLLBACK'),
    release:          ()            => client.release(),
  };
};

module.exports = pool;
