/**
 * VOIP Directory — Server Diagnostics
 * Run: node diagnose.js
 */

const fs   = require('fs');
const path = require('path');
const net  = require('net');

const OK   = '  [OK]  ';
const FAIL = ' [FAIL] ';
const WARN = ' [WARN] ';
const INFO = ' [INFO] ';

let passed = 0, failed = 0, warned = 0;

function ok(msg)   { console.log(`\x1b[32m${OK}\x1b[0m ${msg}`);   passed++; }
function fail(msg) { console.log(`\x1b[31m${FAIL}\x1b[0m ${msg}`); failed++; }
function warn(msg) { console.log(`\x1b[33m${WARN}\x1b[0m ${msg}`); warned++; }
function info(msg) { console.log(`\x1b[36m${INFO}\x1b[0m ${msg}`); }
function section(title) {
  console.log(`\n\x1b[1m── ${title} ${'─'.repeat(50 - title.length)}\x1b[0m`);
}

async function run() {
  console.log('\n\x1b[1m╔══════════════════════════════════════════════════════╗');
  console.log('║        VOIP Directory — Server Diagnostics           ║');
  console.log(`║        ${new Date().toLocaleString().padEnd(46)}║`);
  console.log('╚══════════════════════════════════════════════════════╝\x1b[0m');

  // ── 1. .env file ────────────────────────────────────────────────────────────
  section('1. Environment (.env)');

  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    ok(`.env found at: ${envPath}`);
    require('dotenv').config();
  } else {
    fail(`.env NOT found at: ${envPath}`);
    warn('Create it by copying .env.example and filling in values.');
    // Load anyway in case env vars were set another way
    require('dotenv').config();
  }

  const required = { DB_HOST: 'localhost', DB_USER: 'root', DB_PASSWORD: '', DB_NAME: 'bcc_voip_directory', PORT: '5001' };
  let envOk = true;
  for (const [key, def] of Object.entries(required)) {
    const val = process.env[key];
    if (!val) {
      fail(`${key} is NOT set (expected: ${def || '<your value>'})`);
      envOk = false;
    } else {
      const display = key.includes('PASSWORD') ? '***' : val;
      ok(`${key} = ${display}`);
    }
  }

  // ── 2. MySQL port reachable ─────────────────────────────────────────────────
  section('2. MySQL Port Check');

  const host = process.env.DB_HOST || 'localhost';
  const port = 3306;

  await new Promise(resolve => {
    const s = new net.Socket();
    s.setTimeout(3000);
    s.connect(port, host, () => {
      ok(`MySQL port ${port} is open on ${host}`);
      s.destroy();
      resolve();
    });
    s.on('timeout', () => { fail(`TCP timeout connecting to ${host}:${port} — MySQL may not be running`); s.destroy(); resolve(); });
    s.on('error',   e => { fail(`Cannot reach ${host}:${port} — ${e.message}`); resolve(); });
  });

  // ── 3. Database connection ───────────────────────────────────────────────────
  section('3. Database Connection');

  if (!envOk) {
    warn('Skipping DB test — fix missing env vars above first.');
  } else {
    let db;
    try {
      db = require('./config/db');
      await db.query('SELECT 1');
      ok('Connected to MySQL successfully');
    } catch (e) {
      fail(`Cannot connect to MySQL: ${e.message}`);
      if (e.message.includes('Access denied')) {
        warn('Wrong DB_USER or DB_PASSWORD in .env');
      } else if (e.message.includes('ECONNREFUSED')) {
        warn('MySQL is not running or not on the expected host/port');
      } else if (e.message.includes('Unknown database')) {
        warn(`Database "${process.env.DB_NAME}" does not exist — run: node database/ensure_schema.js`);
      }
      console.log('\n  Run this to create the .env file:');
      console.log('  node -e "require(\'dotenv\').config(); console.log(process.env)"');
      process.exit(1);
    }

    // ── 4. Tables ──────────────────────────────────────────────────────────────
    section('4. Database Tables');

    const requiredTables = ['users', 'extensions', 'admins', 'activity_logs', 'ping_logs'];
    const [rows] = await db.query('SHOW TABLES');
    const existing = rows.map(r => Object.values(r)[0].toLowerCase());

    for (const t of requiredTables) {
      if (existing.includes(t)) {
        ok(`Table "${t}" exists`);
      } else {
        fail(`Table "${t}" is MISSING — run: node database/ensure_schema.js`);
      }
    }

    // ── 5. Row counts ──────────────────────────────────────────────────────────
    section('5. Data Check');

    try {
      const [[{ u }]] = await db.query('SELECT COUNT(*) AS u FROM users');
      const [[{ e }]] = await db.query('SELECT COUNT(*) AS e FROM extensions');
      const [[{ a }]] = await db.query('SELECT COUNT(*) AS a FROM admins');

      u > 0 ? ok(`Users table: ${u} record(s)`) : warn('Users table is empty');
      e > 0 ? ok(`Extensions table: ${e} record(s)`) : warn('Extensions table is empty');
      a > 0 ? ok(`Admins table: ${a} admin account(s)`) : fail('No admin accounts found — login will fail for everyone');

      if (a > 0) {
        const [admins] = await db.query('SELECT username FROM admins');
        info(`Admin usernames: ${admins.map(r => r.username).join(', ')}`);
      }
    } catch (e) {
      fail(`Row count query failed: ${e.message}`);
    }

    await db.end().catch(() => {});
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n\x1b[1m── Summary ──────────────────────────────────────────────\x1b[0m');
  if (failed === 0) {
    console.log(`\x1b[32m  All checks passed (${passed} OK, ${warned} warning(s))\x1b[0m`);
    console.log('  The server should be working. Run: pm2 restart bcc-directory-backend\n');
  } else {
    console.log(`\x1b[31m  ${failed} check(s) FAILED, ${passed} passed, ${warned} warning(s)\x1b[0m`);
    console.log('  Fix the items marked [FAIL] above, then restart PM2.\n');
  }
}

run().catch(e => { console.error('Diagnostics crashed:', e); process.exit(1); });
