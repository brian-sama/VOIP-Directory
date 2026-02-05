const mysql = require('mysql2/promise');
require('dotenv').config();

async function audit() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'bcc_voip_directory',
    });

    console.log('--- DATABASE TABLES ---');
    const [tables] = await connection.query('SHOW TABLES');
    for (const table of tables) {
        const tableName = Object.values(table)[0];
        console.log(`\nTable: ${tableName}`);
        const [columns] = await connection.query(`DESCRIBE ${tableName}`);
        columns.forEach(col => {
            console.log(` - ${col.Field} (${col.Type})`);
        });
    }

    await connection.end();
}

audit().catch(console.error);
