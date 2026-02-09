const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../config/db');
const { generateUsername } = require('../utils/userUtils');

async function fixUsernames() {
    console.log('--- Starting Username Sync ---');
    try {
        const [users] = await db.query('SELECT id, name_surname, username FROM users');
        console.log(`Found ${users.length} users to check.`);

        let updatedCount = 0;

        for (const user of users) {
            const newUsername = generateUsername(user.name_surname);

            // Only update if it's different to save resources
            if (user.username !== newUsername) {
                await db.query('UPDATE users SET username = ? WHERE id = ?', [newUsername, user.id]);
                console.log(`Updated ID ${user.id}: "${user.name_surname}" -> "${newUsername}"`);
                updatedCount++;
            }
        }

        console.log(`--- Sync Complete! Total updated: ${updatedCount} ---`);
        process.exit(0);
    } catch (err) {
        console.error('Error syncing usernames:', err.message);
        process.exit(1);
    }
}

fixUsernames();
