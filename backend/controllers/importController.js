const db = require('../config/db');
const xlsx = require('xlsx');

// Import Users from Excel/CSV - ONLY adds new entries, never updates existing
exports.importUsers = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ msg: 'No file uploaded' });
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);

        let importedCount = 0;
        let skippedCount = 0;
        let errors = [];

        // Get all existing extensions to check for duplicates
        const [existingExtensions] = await connection.query('SELECT extension_number FROM extensions');
        const existingExtSet = new Set(existingExtensions.map(e => String(e.extension_number).trim()));

        // Get all existing user names
        const [existingUsers] = await connection.query('SELECT name_surname FROM users');
        const existingUserSet = new Set(existingUsers.map(u => u.name_surname.trim().toLowerCase()));

        for (const row of data) {
            // Map columns with more flexibility
            const designation = row['Designation'] || row['designation'] || row['Title'] || row['title'] || '';

            let name_surname = row['Name Surname'] || row['name_surname'] || row['Full Name'] || row['full_name'] || row['Employee Name'] || row['User'] || row['User Name'] || row['user_name'] || row['UserName'];
            if (!name_surname) {
                const firstName = row['Name'] || row['First Name'] || row['first_name'] || row['Given Name'] || '';
                const surname = row['Surname'] || row['Last Name'] || row['last_name'] || row['Family Name'] || '';
                if (firstName || surname) name_surname = `${firstName} ${surname}`.trim();
            }
            if (name_surname) name_surname = name_surname.trim();
            if (!name_surname && designation) name_surname = designation;

            let department = row['Department'] || row['department'] || 'General';
            let section = row['Section'] || row['section'] || row['Unit'] || 'General';
            const office_number = row['Office Number'] || row['Office'] || row['office_number'] || row['Room'] || '';
            const station = row['Station'] || row['station'] || row['Location'] || '';
            const extension_number = String(row['Extension'] || row['Extension Number'] || row['extension_number'] || row['Ext'] || '').trim();
            const ip_address = (row['IP Address'] || row['IP'] || row['ip_address'] || '').trim() || null;
            const mac_address = (row['Mac Address'] || row['MAC'] || row['mac_address'] || '').trim() || null;
            const phone_model = (row['Phone Model'] || row['Model'] || row['phone_model'] || row['Device'] || '').trim() || null;

            // Skip completely empty rows
            if (!name_surname && !extension_number && !designation && !office_number) {
                continue;
            }

            if (!name_surname) {
                errors.push(`Skipping row (Missing Name): ${JSON.stringify(row)}`);
                continue;
            }

            // SKIP if extension already exists in database
            if (extension_number && existingExtSet.has(extension_number)) {
                skippedCount++;
                continue;
            }

            // SKIP if user name already exists in database
            if (existingUserSet.has(name_surname.toLowerCase())) {
                skippedCount++;
                continue;
            }

            try {
                // Populate lookup tables
                await connection.query('INSERT IGNORE INTO departments (name) VALUES (?)', [department]);
                await connection.query('INSERT IGNORE INTO sections (name) VALUES (?)', [section]);

                // Create new user
                const loginPassword = extension_number || '123456';
                const [userResult] = await connection.query(
                    'INSERT INTO users (name_surname, username, password, department, section, office_number, designation, station, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [name_surname, name_surname, loginPassword, department, section, office_number, designation, station, 'user']
                );
                const userId = userResult.insertId;

                // Insert extension (only if we have extension number)
                if (extension_number) {
                    await connection.query(
                        'INSERT INTO extensions (user_id, extension_number, ip_address, mac_address, phone_model) VALUES (?, ?, ?, ?, ?)',
                        [userId, extension_number, ip_address, mac_address, phone_model]
                    );
                    existingExtSet.add(extension_number);
                }

                // Add user to existing set
                existingUserSet.add(name_surname.toLowerCase());
                importedCount++;

            } catch (err) {
                console.error(`Error importing row for ${name_surname}:`, err);
                if (err.code === 'ER_DUP_ENTRY') {
                    skippedCount++;
                } else {
                    errors.push(`Error importing ${name_surname}: ${err.message}`);
                }
            }
        }

        await connection.commit();
        res.json({
            msg: `Imported ${importedCount} new users. Skipped ${skippedCount} existing entries.`,
            importedCount,
            skippedCount,
            errors
        });

    } catch (err) {
        await connection.rollback();
        console.error('Import transaction error:', err);
        res.status(500).json({ msg: 'Server Error during import' });
    } finally {
        connection.release();
    }
};
