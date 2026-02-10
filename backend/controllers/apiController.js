const db = require('../config/db');
const xlsx = require('xlsx');
const { generateUsername } = require('../utils/userUtils');

// --- METADATA LOGIC ---

// Get all metadata of a certain type
exports.getMetadata = async (req, res) => {
    const { type } = req.params;
    const allowedTypes = ['departments', 'sections', 'stations'];
    if (!allowedTypes.includes(type)) return res.status(400).json({ msg: 'Invalid metadata type' });

    try {
        const [rows] = await db.query(`SELECT * FROM ${type} ORDER BY name`);
        res.json(rows);
    } catch (err) {
        console.error(`Error fetching ${type}:`, err.message);
        res.status(500).send('Server Error');
    }
};

// Add metadata
exports.addMetadata = async (req, res) => {
    const { type } = req.params;
    const { name } = req.body;
    const allowedTypes = ['departments', 'sections', 'stations'];
    if (!allowedTypes.includes(type)) return res.status(400).json({ msg: 'Invalid metadata type' });
    if (!name) return res.status(400).json({ msg: 'Name is required' });

    try {
        const [result] = await db.query(`INSERT IGNORE INTO ${type} (name) VALUES (?)`, [name]);
        res.json({ id: result.insertId, name });
    } catch (err) {
        console.error(`Error adding to ${type}:`, err.message);
        res.status(500).send('Server Error');
    }
};

// Delete metadata
exports.deleteMetadata = async (req, res) => {
    const { type, id } = req.params;
    const allowedTypes = ['departments', 'sections', 'stations'];
    if (!allowedTypes.includes(type)) return res.status(400).json({ msg: 'Invalid metadata type' });

    try {
        await db.query(`DELETE FROM ${type} WHERE id = ?`, [id]);
        res.json({ msg: `${type.slice(0, -1)} deleted successfully` });
    } catch (err) {
        console.error(`Error deleting from ${type}:`, err.message);
        res.status(500).send('Server Error');
    }
};

// Import Users from Excel/CSV - OPTIMIZED FOR 1000+ USERS
exports.importUsers = async (req, res) => {
    if (!req.file) return res.status(400).json({ msg: 'No file uploaded' });

    const BATCH_SIZE = 100; // Process 100 rows at a time
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

        console.log(`[IMPORT] Starting bulk import of ${data.length} rows...`);

        let importedCount = 0, skippedCount = 0, errors = [];

        // Pre-fetch existing data for duplicate checking
        const [extRows] = await connection.query('SELECT extension_number FROM extensions');
        const existingExts = new Set(extRows.map(e => String(e.extension_number).trim()));
        const [userRows] = await connection.query('SELECT name_surname FROM users');
        const existingUsers = new Set(userRows.map(u => u.name_surname.trim().toLowerCase()));

        // Step 1: Pre-collect all unique departments and sections
        const allDepts = new Set();
        const allSections = new Set();

        for (const row of data) {
            const dept = row['Department'] || row['department'] || 'General';
            const sect = row['Section'] || row['section'] || 'General';
            allDepts.add(dept);
            allSections.add(sect);
        }

        // Bulk insert departments and sections
        if (allDepts.size > 0) {
            const deptValues = Array.from(allDepts).map(d => [d]);
            await connection.query('INSERT IGNORE INTO departments (name) VALUES ?', [deptValues]);
        }
        if (allSections.size > 0) {
            const sectValues = Array.from(allSections).map(s => [s]);
            await connection.query('INSERT IGNORE INTO sections (name) VALUES ?', [sectValues]);
        }

        console.log(`[IMPORT] Pre-inserted ${allDepts.size} departments and ${allSections.size} sections`);

        // Step 2: Parse and validate all rows first
        const validUsers = [];

        for (const row of data) {
            let name = row['Name Surname'] || row['name_surname'] || row['Full Name'] || row['full_name'] || row['Employee Name'] || row['User'] || row['UserName'];
            if (!name) {
                const f = row['Name'] || row['First Name'] || '';
                const s = row['Surname'] || row['Last Name'] || '';
                if (f || s) name = `${f} ${s}`.trim();
            }
            if (name) name = name.trim();
            const ext = String(row['Extension'] || row['Extension Number'] || row['ext'] || '').trim();

            // --- REFINED SKIP LOGIC (Extension as Primary Key) ---
            if (ext) {
                // If extension exists, it must be unique
                if (existingExts.has(ext)) {
                    skippedCount++;
                    continue;
                }
            } else if (!name || existingUsers.has(name.toLowerCase())) {
                // If no extension, name must be unique and not empty
                if (name) skippedCount++;
                continue;
            }

            // Mark as used to prevent duplicates within the same file
            if (ext) existingExts.add(ext);
            if (name) existingUsers.add(name.toLowerCase());

            validUsers.push({
                name,
                ext,
                dept: row['Department'] || row['department'] || 'General',
                sect: row['Section'] || row['section'] || 'General',
                office: row['Office Number'] || row['office_number'] || '',
                designation: row['Designation'] || row['designation'] || '',
                station: row['Station'] || row['station'] || '',
                ip: (row['IP Address'] || row['ip_address'] || '').trim(),
                mac: (row['Mac Address'] || row['mac_address'] || '').trim(),
                phone: (row['Phone Model'] || row['phone_model'] || '').trim()
            });
        }

        console.log(`[IMPORT] Validated ${validUsers.length} users for import, skipping ${skippedCount} duplicates`);

        // Step 3: Batch insert users and extensions
        for (let i = 0; i < validUsers.length; i += BATCH_SIZE) {
            const batch = validUsers.slice(i, i + BATCH_SIZE);

            try {
                // Batch insert users with automated usernames (first initial + surname)
                const userValues = batch.map(u => [
                    u.name, generateUsername(u.name), u.ext || '123456', u.dept, u.sect, u.office, u.designation, u.station, 'user'
                ]);

                const [userResult] = await connection.query(
                    'INSERT INTO users (name_surname, username, password, department, section, office_number, designation, station, role) VALUES ?',
                    [userValues]
                );

                const firstInsertId = userResult.insertId;

                // Batch insert extensions (only for users with extensions)
                const extValues = [];
                batch.forEach((u, idx) => {
                    const userId = firstInsertId + idx;
                    if (u.ext || u.ip || u.mac || u.phone) {
                        extValues.push([userId, u.ext || null, u.ip || null, u.mac || null, u.phone || null]);
                    }
                });

                if (extValues.length > 0) {
                    await connection.query(
                        'INSERT INTO extensions (user_id, extension_number, ip_address, mac_address, phone_model) VALUES ?',
                        [extValues]
                    );
                }

                importedCount += batch.length;
                console.log(`[IMPORT] Processed batch ${Math.floor(i / BATCH_SIZE) + 1}: ${importedCount}/${validUsers.length} users imported`);

            } catch (batchErr) {
                errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error: ${batchErr.message}`);
                console.error(`[IMPORT] Batch error:`, batchErr.message);
            }
        }

        await connection.commit();
        console.log(`[IMPORT] Complete! Imported ${importedCount}, skipped ${skippedCount}`);
        res.json({ msg: `Imported ${importedCount}. Skipped ${skippedCount}.`, importedCount, skippedCount, errors });

    } catch (err) {
        await connection.rollback();
        console.error('[IMPORT] Fatal error:', err.message);
        res.status(500).json({ msg: 'Server Error during import', error: err.message });
    } finally {
        connection.release();
    }
};
