const db = require('../config/db');
const xlsx = require('xlsx');

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

// --- IMPORT LOGIC ---

// Import Users from Excel/CSV
exports.importUsers = async (req, res) => {
    if (!req.file) return res.status(400).json({ msg: 'No file uploaded' });
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

        let importedCount = 0, skippedCount = 0, errors = [];
        const [extRows] = await connection.query('SELECT extension_number FROM extensions');
        const existingExts = new Set(extRows.map(e => String(e.extension_number).trim()));
        const [userRows] = await connection.query('SELECT name_surname FROM users');
        const existingUsers = new Set(userRows.map(u => u.name_surname.trim().toLowerCase()));

        for (const row of data) {
            let name = row['Name Surname'] || row['name_surname'] || row['Full Name'] || row['full_name'] || row['Employee Name'] || row['User'] || row['UserName'];
            if (!name) {
                const f = row['Name'] || row['First Name'] || '';
                const s = row['Surname'] || row['Last Name'] || '';
                if (f || s) name = `${f} ${s}`.trim();
            }
            if (name) name = name.trim();
            const ext = String(row['Extension'] || row['Extension Number'] || row['ext'] || '').trim();

            if (!name || (ext && existingExts.has(ext)) || existingUsers.has(name.toLowerCase())) {
                if (name) skippedCount++;
                continue;
            }

            try {
                const dept = row['Department'] || row['department'] || 'General';
                const sect = row['Section'] || row['section'] || 'General';
                await connection.query('INSERT IGNORE INTO departments (name) VALUES (?)', [dept]);
                await connection.query('INSERT IGNORE INTO sections (name) VALUES (?)', [sect]);

                const [ur] = await connection.query(
                    'INSERT INTO users (name_surname, username, password, department, section, office_number, designation, station, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [name, name, ext || '123456', dept, sect, row['Office Number'] || '', row['Designation'] || '', row['Station'] || '', 'user']
                );
                if (ext) {
                    await connection.query('INSERT INTO extensions (user_id, extension_number, ip_address, mac_address, phone_model) VALUES (?, ?, ?, ?, ?)',
                        [ur.insertId, ext, (row['IP Address'] || '').trim(), (row['Mac Address'] || '').trim(), (row['Phone Model'] || '').trim()]);
                    existingExts.add(ext);
                }
                existingUsers.add(name.toLowerCase());
                importedCount++;
            } catch (err) {
                errors.push(`Error importing ${name}: ${err.message}`);
            }
        }
        await connection.commit();
        res.json({ msg: `Imported ${importedCount}. Skipped ${skippedCount}.`, importedCount, skippedCount, errors });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ msg: 'Server Error during import' });
    } finally { connection.release(); }
};
