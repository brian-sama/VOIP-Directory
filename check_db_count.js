const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'backend/.env' });

async function checkDb() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    const [rows] = await connection.query('SELECT COUNT(*) as count FROM users');
    console.log('Total users in database:', rows[0].count);

    const [extRows] = await connection.query('SELECT COUNT(*) as count FROM extensions');
    console.log('Total extensions in database:', extRows[0].count);

    await connection.end();
}

checkDb().catch(console.error);
