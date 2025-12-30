
const db = require('./config/db');

async function checkUsers() {
    try {
        const [users] = await db.query('SELECT * FROM users');
        console.log(`Found ${users.length} users in the database.`);
        console.log(JSON.stringify(users, null, 2));

        const [extensions] = await db.query('SELECT * FROM extensions');
        console.log(`Found ${extensions.length} extensions in the database.`);
        console.log(JSON.stringify(extensions, null, 2));

        process.exit(0);
    } catch (err) {
        console.error('Error checking users:', err);
        process.exit(1);
    }
}

checkUsers();
