
const db = require('./config/db');

async function alterSchema() {
    const connection = await db.getConnection();
    try {
        console.log('Altering extensions table...');

        // Allow NULL for optional fields that might be unique
        await connection.query('ALTER TABLE extensions MODIFY ip_address VARCHAR(45) NULL');
        await connection.query('ALTER TABLE extensions MODIFY mac_address VARCHAR(45) NULL');
        await connection.query('ALTER TABLE extensions MODIFY phone_model VARCHAR(50) NULL');

        console.log('Schema altered successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Error altering schema:', err);
        process.exit(1);
    } finally {
        connection.release();
    }
}

alterSchema();
