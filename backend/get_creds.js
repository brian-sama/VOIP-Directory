
const db = require('./config/db');

async function listCredentials() {
    try {
        const [admins] = await db.query('SELECT username, password FROM admins');
        console.log('--- ADMIN CREDENTIALS ---');
        admins.forEach(u => {
            console.log(`Role: ADMIN | Username: '${u.username}' | Password: '${u.password}'`);
        });

        const [users] = await db.query('SELECT name_surname, username, password, role FROM users');
        console.log('\n--- USER CREDENTIALS ---');
        users.forEach(u => {
            console.log(`Role: ${u.role} | Name: ${u.name_surname} | Username: '${u.username}' | Password: '${u.password}'`);
        });
        process.exit(0);
    } catch (err) {
        console.error('Error listing users:', err);
        process.exit(1);
    }
}

listCredentials();
