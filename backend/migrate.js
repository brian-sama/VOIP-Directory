const db = require('./config/db');

const runMigration = async () => {
    console.log('Starting Migration...');
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Add columns to users table
        console.log('Checking/Adding columns to users table...');

        // Helper to add column if not exists (MySQL doesn't have IF NOT EXISTS for columns in all versions easily, so we try/catch or assume)
        // Better approach: Try to SELECT the column, if error, ADD it. Or just run ALTER IGNORE... no, simple way:

        const alterQueries = [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100);",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR(255);",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS section VARCHAR(100);",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS role ENUM('admin', 'user') DEFAULT 'user';",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS designation VARCHAR(100);",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS station VARCHAR(100);"
        ];

        // MySQL 5.7+ supports IF NOT EXISTS in ALTER TABLE... wait, standard MySQL often doesn't.
        // Let's use a robust way: check first.

        const [columns] = await connection.query("SHOW COLUMNS FROM users");
        const existingColumns = columns.map(c => c.Field);

        if (!existingColumns.includes('username')) await connection.query("ALTER TABLE users ADD COLUMN username VARCHAR(100)");
        if (!existingColumns.includes('password')) await connection.query("ALTER TABLE users ADD COLUMN password VARCHAR(255)");
        if (!existingColumns.includes('section')) await connection.query("ALTER TABLE users ADD COLUMN section VARCHAR(100)");
        if (!existingColumns.includes('role')) await connection.query("ALTER TABLE users ADD COLUMN role ENUM('admin', 'user') DEFAULT 'user'");
        if (!existingColumns.includes('designation')) await connection.query("ALTER TABLE users ADD COLUMN designation VARCHAR(100)");
        if (!existingColumns.includes('station')) await connection.query("ALTER TABLE users ADD COLUMN station VARCHAR(100)");

        // Update existing users to have a default role if valid
        await connection.query("UPDATE users SET role = 'user' WHERE role IS NULL");
        // Update username to name_surname if empty
        await connection.query("UPDATE users SET username = name_surname WHERE username IS NULL");

        // 2. Extensions Table - check mac_address, phone_model
        console.log('Checking/Adding columns to extensions table...');
        const [extColumns] = await connection.query("SHOW COLUMNS FROM extensions");
        const existingExtColumns = extColumns.map(c => c.Field);

        if (!existingExtColumns.includes('mac_address')) await connection.query("ALTER TABLE extensions ADD COLUMN mac_address VARCHAR(50)");
        if (!existingExtColumns.includes('phone_model')) await connection.query("ALTER TABLE extensions ADD COLUMN phone_model VARCHAR(100)");

        // 3. Activity Logs Table
        console.log('Creating activity_logs table...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS activity_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                action VARCHAR(100) NOT NULL,
                details TEXT,
                user_name VARCHAR(100) DEFAULT 'System',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 4. Schema Refinement (NULLs and lengths)
        console.log('Refining schema (NULLs and lengths)...');
        await connection.query("ALTER TABLE users MODIFY COLUMN office_number VARCHAR(100)");
        await connection.query("ALTER TABLE extensions MODIFY ip_address VARCHAR(45) NULL");
        await connection.query("ALTER TABLE extensions MODIFY mac_address VARCHAR(45) NULL");
        await connection.query("ALTER TABLE extensions MODIFY phone_model VARCHAR(50) NULL");

        // 5. SIP Status Tracking
        console.log('Checking/Adding SIP status columns...');
        const [sipCols] = await connection.query("SHOW COLUMNS FROM extensions LIKE 'sip_status'");
        if (sipCols.length === 0) {
            await connection.query(`
                ALTER TABLE extensions 
                ADD COLUMN sip_status ENUM('Registered', 'Unregistered', 'Unknown') DEFAULT 'Unknown',
                ADD COLUMN sip_port_open TINYINT(1) DEFAULT NULL,
                ADD COLUMN sip_last_checked DATETIME DEFAULT NULL
            `);
        }

        // 6. Departments and Stations Tables
        console.log('Creating departments and stations tables...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS departments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS stations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Populate from existing user data if empty
        const [existingDepts] = await connection.query("SELECT COUNT(*) as count FROM departments");
        if (existingDepts[0].count === 0) {
            await connection.query("INSERT IGNORE INTO departments (name) SELECT DISTINCT department FROM users WHERE department IS NOT NULL AND department != ''");
        }

        const [existingSections] = await connection.query("SELECT COUNT(*) as count FROM sections");
        if (existingSections[0].count === 0) {
            // Check if sections table exists first (migration 5.7+ fix)
            const [tables] = await connection.query("SHOW TABLES LIKE 'sections'");
            if (tables.length > 0) {
                await connection.query("INSERT IGNORE INTO sections (name) SELECT DISTINCT section FROM users WHERE section IS NOT NULL AND section != ''");
            } else {
                // Actually create sections table if missed
                await connection.query(`
                    CREATE TABLE IF NOT EXISTS sections (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        name VARCHAR(100) NOT NULL UNIQUE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                await connection.query("INSERT IGNORE INTO sections (name) SELECT DISTINCT section FROM users WHERE section IS NOT NULL AND section != ''");
            }
        }

        const [existingStations] = await connection.query("SELECT COUNT(*) as count FROM stations");
        if (existingStations[0].count === 0) {
            await connection.query("INSERT IGNORE INTO stations (name) SELECT DISTINCT station FROM users WHERE station IS NOT NULL AND station != ''");
        }

        await connection.commit();
        console.log('Migration completed successfully.');
        process.exit(0);

    } catch (err) {
        await connection.rollback();
        console.error('Migration failed:', err.message);
        process.exit(1);
    } finally {
        connection.release();
    }
};

runMigration();
