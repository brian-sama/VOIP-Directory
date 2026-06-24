const mysql = require('mysql2/promise');
require('dotenv').config();

const DB_NAME = process.env.DB_NAME || 'bcc_voip_directory';

const createTables = [
  `CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name_surname VARCHAR(100) NOT NULL,
    email VARCHAR(255) NULL UNIQUE,
    username VARCHAR(100),
    password VARCHAR(255),
    department VARCHAR(100),
    section VARCHAR(100),
    office_number VARCHAR(100),
    designation VARCHAR(100),
    station VARCHAR(100),
    role ENUM('admin', 'user') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_users_username (username),
    INDEX idx_users_name_surname (name_surname),
    INDEX idx_users_email (email),
    INDEX idx_users_department (department)
  )`,
  `CREATE TABLE IF NOT EXISTS extensions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    extension_number VARCHAR(10),
    old_extension_number VARCHAR(50),
    ip_address VARCHAR(45),
    mac_address VARCHAR(50),
    phone_model VARCHAR(100),
    status ENUM('Online', 'Offline') DEFAULT 'Offline',
    sip_status ENUM('Registered', 'Unregistered', 'Unknown') DEFAULT 'Unknown',
    sip_port_open TINYINT(1) DEFAULT NULL,
    sip_last_checked DATETIME DEFAULT NULL,
    last_seen DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_extensions_extension_number (extension_number),
    INDEX idx_extensions_old_extension_number (old_extension_number),
    INDEX idx_extensions_ip_address (ip_address),
    INDEX idx_extensions_user_id (user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS sections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS stations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    user_name VARCHAR(100) DEFAULT 'System',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS ping_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    extension_id INT NOT NULL,
    ping_time DATETIME NOT NULL,
    result ENUM('Success', 'Failed') NOT NULL,
    FOREIGN KEY (extension_id) REFERENCES extensions(id) ON DELETE CASCADE
  )`
];

const requiredColumns = {
  users: [
    ['name_surname', 'VARCHAR(100) NOT NULL'],
    ['email', 'VARCHAR(255) NULL'],
    ['username', 'VARCHAR(100)'],
    ['password', 'VARCHAR(255)'],
    ['department', 'VARCHAR(100)'],
    ['section', 'VARCHAR(100)'],
    ['office_number', 'VARCHAR(100)'],
    ['designation', 'VARCHAR(100)'],
    ['station', 'VARCHAR(100)'],
    ['role', "ENUM('admin', 'user') DEFAULT 'user'"],
    ['created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
    ['deleted_at', 'DATETIME NULL DEFAULT NULL']
  ],
  extensions: [
    ['user_id', 'INT NOT NULL'],
    ['extension_number', 'VARCHAR(10)'],
    ['old_extension_number', 'VARCHAR(50) NULL'],
    ['ip_address', 'VARCHAR(45)'],
    ['mac_address', 'VARCHAR(50)'],
    ['phone_model', 'VARCHAR(100)'],
    ['status', "ENUM('Online', 'Offline') DEFAULT 'Offline'"],
    ['sip_status', "ENUM('Registered', 'Unregistered', 'Unknown') DEFAULT 'Unknown'"],
    ['sip_port_open', 'TINYINT(1) DEFAULT NULL'],
    ['sip_last_checked', 'DATETIME DEFAULT NULL'],
    ['last_seen', 'DATETIME']
  ],
  activity_logs: [
    ['action', 'VARCHAR(100) NOT NULL'],
    ['details', 'TEXT'],
    ['user_name', "VARCHAR(100) DEFAULT 'System'"],
    ['created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP']
  ],
  ping_logs: [
    ['extension_id', 'INT NOT NULL'],
    ['ping_time', 'DATETIME NOT NULL'],
    ['result', "ENUM('Success', 'Failed') NOT NULL"]
  ]
};

const requiredIndexes = [
  ['users', 'idx_users_username', 'username'],
  ['users', 'idx_users_name_surname', 'name_surname'],
  ['users', 'idx_users_email', 'email'],
  ['users', 'idx_users_department', 'department'],
  ['extensions', 'idx_extensions_extension_number', 'extension_number'],
  ['extensions', 'idx_extensions_old_extension_number', 'old_extension_number'],
  ['extensions', 'idx_extensions_ip_address', 'ip_address'],
  ['extensions', 'idx_extensions_user_id', 'user_id']
];

async function columnExists(connection, table, column) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.columns
     WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
    [DB_NAME, table, column]
  );
  return rows[0].count > 0;
}

async function indexExists(connection, table, indexName) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.statistics
     WHERE table_schema = ? AND table_name = ? AND index_name = ?`,
    [DB_NAME, table, indexName]
  );
  return rows[0].count > 0;
}

async function ensureSchema() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: false
  });

  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
    await connection.query(`USE \`${DB_NAME}\``);

    for (const statement of createTables) {
      await connection.query(statement);
    }

    for (const [table, columns] of Object.entries(requiredColumns)) {
      for (const [column, definition] of columns) {
        if (!(await columnExists(connection, table, column))) {
          await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
          console.log(`Added missing column ${table}.${column}`);
        }
      }
    }

    await connection.query('ALTER TABLE extensions MODIFY COLUMN old_extension_number VARCHAR(50) NULL');

    for (const [table, indexName, column] of requiredIndexes) {
      if (!(await indexExists(connection, table, indexName))) {
        await connection.query(`ALTER TABLE \`${table}\` ADD INDEX \`${indexName}\` (\`${column}\`)`);
        console.log(`Added missing index ${table}.${indexName}`);
      }
    }

    // Only create default admin if no admins exist at all
    const [adminCount] = await connection.query('SELECT COUNT(*) as count FROM admins');
    if (adminCount[0].count === 0) {
      const bcrypt = require('bcrypt');
      const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'bccit';
      const hash = await bcrypt.hash(defaultPassword, 12);
      await connection.query(
        'INSERT INTO admins (username, password) VALUES (?, ?)',
        ['admin', hash]
      );
      console.log(`Default admin created. Password set from DEFAULT_ADMIN_PASSWORD env var (or "bccit" if not set). Change it immediately.`);
    }

    const [tables] = await connection.query('SHOW TABLES');
    console.log(`Schema check complete for database "${DB_NAME}".`);
    console.table(tables);
  } finally {
    await connection.end();
  }
}

ensureSchema().catch((err) => {
  console.error('Schema check failed:', err.message);
  process.exitCode = 1;
});
