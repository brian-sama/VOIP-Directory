const db = require('./config/db');

async function checkSchema() {
    try {
        console.log('--- USERS TABLE ---');
        const [userCols] = await db.query('SHOW CREATE TABLE users');
        console.log(userCols[0]['Create Table']);

        console.log('\n--- EXTENSIONS TABLE ---');
        const [extCols] = await db.query('SHOW CREATE TABLE extensions');
        console.log(extCols[0]['Create Table']);

        process.exit(0);
    } catch (err) {
        console.error('Error checking schema:', err.message);
        process.exit(1);
    }
}

checkSchema();
