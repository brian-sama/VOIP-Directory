const db = require('./config/db');

async function fixOfficeNumberLength() {
    const connection = await db.getConnection();

    try {
        console.log('Updating office_number column to VARCHAR(100)...');

        await connection.query(`
            ALTER TABLE users 
            MODIFY COLUMN office_number VARCHAR(100)
        `);

        console.log('✓ Successfully updated office_number column length to VARCHAR(100)');

    } catch (err) {
        console.error('Error updating schema:', err);
        throw err;
    } finally {
        connection.release();
        await db.end();
    }
}

fixOfficeNumberLength()
    .then(() => {
        console.log('Migration completed successfully!');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Migration failed:', err);
        process.exit(1);
    });
