const fs = require('fs');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'backend/.env' });

async function testImportLogic() {
    const csvPath = 'BCC Consolidated VOIP data.csv';
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split('\n');

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    // Pre-fetch existing data (mimic the controller)
    const [extRows] = await connection.query('SELECT extension_number FROM extensions');
    const existingExts = new Set(extRows.map(e => String(e.extension_number || '').trim()));
    const [userRows] = await connection.query('SELECT name_surname FROM users');
    const existingUsers = new Set(userRows.map(u => u.name_surname.trim().toLowerCase()));

    let importedCount = 0;
    let skippedCount = 0;
    const toImport = [];

    console.log('--- Simulating Import with New Logic ---');

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(',');
        const name = (parts[0] || '').trim();
        const ext = (parts[1] || '').trim();

        // --- NEW LOGIC ---
        if (ext) {
            if (existingExts.has(ext)) {
                skippedCount++;
                continue;
            }
        } else if (!name || existingUsers.has(name.toLowerCase())) {
            skippedCount++;
            continue;
        }

        if (ext) existingExts.add(ext);
        if (name) existingUsers.add(name.toLowerCase());

        toImport.push({ name, ext });
        importedCount++;
    }

    console.log('Total Rows Processed:', lines.length - 1);
    console.log('Already in DB (Skipped):', skippedCount);
    console.log('New Records to Import:', importedCount);
    console.log('Total Expected After Import:', (await connection.query('SELECT COUNT(*) as count FROM users'))[0][0].count + importedCount);

    await connection.end();
}

testImportLogic().catch(console.error);
