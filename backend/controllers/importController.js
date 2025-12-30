const db = require('../config/db');
const xlsx = require('xlsx');

// Import Users from Excel/CSV
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
        let errors = [];

        for (const row of data) {
            // Map columns with more flexibility
            const designation = row['Designation'] || row['designation'] || row['Title'] || row['title'] || '';

            let name_surname = row['Name Surname'] || row['name_surname'] || row['Full Name'] || row['full_name'] || row['Employee Name'] || row['User'];
            if (!name_surname) {
                const firstName = row['Name'] || row['First Name'] || row['first_name'] || row['Given Name'] || '';
                const surname = row['Surname'] || row['Last Name'] || row['last_name'] || row['Family Name'] || '';
                if (firstName || surname) name_surname = `${firstName} ${surname}`.trim();
            }
            if (!name_surname && designation) name_surname = designation; // Fallback to designation if name missing (edge case)

            let department = row['Department'] || row['department'] || 'General';
            let section = row['Section'] || row['section'] || row['Unit'] || 'General';
            const office_number = row['Office Number'] || row['Office'] || row['office_number'] || row['Room'] || '';
            const station = row['Station'] || row['station'] || row['Location'] || '';
            const extension_number = row['Extension'] || row['Extension Number'] || row['extension_number'] || row['Ext'] || '';
            const ip_address = (row['IP Address'] || row['IP'] || row['ip_address'] || '').trim() || null;
            const mac_address = (row['Mac Address'] || row['MAC'] || row['mac_address'] || '').trim() || null;
            const phone_model = (row['Phone Model'] || row['Model'] || row['phone_model'] || row['Device'] || '').trim() || null;

            // Skip completely empty rows (common in Excel exports)
            if (!name_surname && !extension_number && !designation && !office_number) {
                continue;
            }

            if (!name_surname) {
                errors.push(`Skipping row (Missing Name): ${JSON.stringify(row)}`);
                continue;
            }

            try {
                // Populate lookup tables
                await connection.query('INSERT IGNORE INTO departments (name) VALUES (?)', [department]);
                await connection.query('INSERT IGNORE INTO sections (name) VALUES (?)', [section]);

                // Upsert User
                let userId;
                // Search for existing user by name_surname OR designation (weak match, but helpful for updates)
                const [existingUsers] = await connection.query(
                    'SELECT id, name_surname, username, password, designation FROM users WHERE name_surname = ?',
                    [name_surname]
                );

                if (existingUsers.length > 0) {
                    const existing = existingUsers[0];
                    userId = existing.id;

                    // Update existing user
                    const isNewPasswordNeeded = (existing.password === null || existing.password === '' || existing.password === '123456') && extension_number;
                    const finalPassword = isNewPasswordNeeded ? extension_number : existing.password;

                    await connection.query(
                        'UPDATE users SET name_surname = ?, username = ?, password = ?, department = ?, section = ?, office_number = ?, designation = ?, station = ? WHERE id = ?',
                        [name_surname, name_surname, finalPassword, department, section, office_number, designation, station, userId]
                    );
                } else {
                    // Create new user
                    const loginPassword = extension_number || '123456';
                    const [userResult] = await connection.query(
                        'INSERT INTO users (name_surname, username, password, department, section, office_number, designation, station, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [name_surname, name_surname, loginPassword, department, section, office_number, designation, station, 'user']
                    );
                    userId = userResult.insertId;
                }

                // Upsert Extension
                // Crucial fix: Ensure the extension is linked to THIS user_id, stealing it if necessary
                if (extension_number || ip_address) {
                    // Find if this extension OR IP already exists on any record
                    let query = 'SELECT id, user_id FROM extensions WHERE 1=0';
                    const params = [];
                    if (extension_number) {
                        query += ' OR extension_number = ?';
                        params.push(extension_number);
                    }
                    if (ip_address) {
                        query += ' OR ip_address = ?';
                        params.push(ip_address);
                    }

                    const [existingExts] = await connection.query(query, params);

                    if (existingExts.length > 0) {
                        // Update the FIRST found matching extension
                        // We must update user_id to ensure it links to the current imported user
                        await connection.query(
                            'UPDATE extensions SET user_id = ?, extension_number = ?, ip_address = ?, mac_address = ?, phone_model = ? WHERE id = ?',
                            [userId, extension_number, ip_address, mac_address, phone_model, existingExts[0].id]
                        );
                    } else {
                        // Insert new extension record
                        await connection.query(
                            'INSERT INTO extensions (user_id, extension_number, ip_address, mac_address, phone_model) VALUES (?, ?, ?, ?, ?)',
                            [userId, extension_number, ip_address, mac_address, phone_model]
                        );
                    }
                }

                importedCount++;

            } catch (err) {
                console.error(`Error importing row for ${name_surname}:`, err);
                errors.push(`Error importing ${name_surname}: ${err.code === 'ER_DUP_ENTRY' ? 'Duplicate IP or Extension found.' : err.message}`);
            }
        }

        await connection.commit();
        res.json({ msg: `Imported ${importedCount} users.${errors.length > 0 ? ' Some rows failed. See alert.' : ''}`, errors });

    } catch (err) {
        await connection.rollback();
        console.error('Import transaction error:', err);
        res.status(500).json({ msg: 'Server Error during import' });
    } finally {
        connection.release();
    }
};
