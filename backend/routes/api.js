const express = require('express');
const router = express.Router();
const db = require('../config/db');
const multer = require('multer');
const { runDirectoryCleanup } = require('../services');
const apiController = require('../controllers/apiController');
const { generateUsername } = require('../utils/userUtils');
const PDFDocument = require('pdfkit');
const xlsx = require('xlsx');

// Multer setup for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- AUTH ROUTES ---
const { generateToken, verifyToken, requireAdmin } = require('../middleware/auth');

// @route   POST api/auth/login
router.post('/auth/login', async (req, res) => {
    const startTime = Date.now();
    const { username, password } = req.body;
    console.log(`[AUTH] Login attempt for: ${username} at ${new Date().toISOString()}`);

    if (!username || !password) return res.status(400).json({ msg: 'Please enter all fields' });

    try {
        // Normalize input for comparison
        const normalizedInput = generateUsername(username);
        console.log(`[AUTH] Normalized input: ${normalizedInput}`);

        // 1. Check Admin Table first
        const [adminRows] = await db.query('SELECT * FROM admins WHERE username = ?', [username]);
        console.log(`[AUTH] Admin check took ${Date.now() - startTime}ms`);

        if (adminRows.length > 0 && password === adminRows[0].password) {
            const user = { id: adminRows[0].id, username: adminRows[0].username, role: 'admin' };
            const token = generateToken(user);

            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000
            });

            console.log(`[AUTH] Admin login successful for ${username} in ${Date.now() - startTime}ms`);
            return res.json({ msg: 'Login successful', role: 'admin', user, token });
        }

        // 2. Check Users Table with optimized query
        // We look for direct matches first, then normalized matches
        const [userRows] = await db.query(
            'SELECT id, name_surname, username, department, section, role, password FROM users WHERE username = ? OR name_surname = ? OR username = ? LIMIT 5',
            [username, username, normalizedInput]
        );
        console.log(`[AUTH] User query took ${Date.now() - startTime}ms. Matches found: ${userRows.length}`);

        const matchedUser = userRows.find(user => {
            const storedUsername = (user.username || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const normalizedDbName = generateUsername(user.name_surname || '');
            return storedUsername === normalizedInput || normalizedDbName === normalizedInput;
        });

        if (matchedUser && password === matchedUser.password) {
            const user = {
                id: matchedUser.id,
                username: matchedUser.name_surname,
                department: matchedUser.department,
                section: matchedUser.section,
                role: matchedUser.role || 'user'
            };
            const token = generateToken(user);

            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000
            });

            console.log(`[AUTH] User login successful for ${username} in ${Date.now() - startTime}ms`);
            return res.json({ msg: 'Login successful', role: user.role, user, token });
        }

        console.log(`[AUTH] Invalid credentials for ${username} after ${Date.now() - startTime}ms`);
        return res.status(400).json({ msg: 'Invalid credentials' });
    } catch (err) {
        console.error(`[AUTH] Login error after ${Date.now() - startTime}ms:`, err);
        res.status(500).send('Server Error');
    }
});

// --- USER ROUTES ---
// @route   POST api/users
router.post('/users', verifyToken, requireAdmin, async (req, res) => {
    let { name_surname, email, department, section, office_number, designation, station, extension_number, ip_address, mac_address, phone_model, role } = req.body;

    if (!name_surname) return res.status(400).json({ msg: 'Please provide name & surname.' });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ msg: 'Please provide a valid email address.' });

    // Automatically generate username: first initial + surname
    const username = generateUsername(name_surname);

    // Sanitize empty strings to null
    const toNull = (val) => (val && val.trim() !== '') ? val.trim() : null;

    ip_address = toNull(ip_address);
    extension_number = toNull(extension_number);
    department = toNull(department);
    section = toNull(section);
    office_number = toNull(office_number);
    designation = toNull(designation);
    station = toNull(station);
    mac_address = toNull(mac_address);
    phone_model = toNull(phone_model);

    try {
        if (ip_address) {
            const [existingIp] = await db.query('SELECT u.name_surname FROM extensions e JOIN users u ON e.user_id = u.id WHERE e.ip_address = ?', [ip_address]);
            if (existingIp.length > 0) return res.status(400).json({ msg: `IP Address ${ip_address} already assigned to ${existingIp[0].name_surname}.` });
        }
        if (extension_number) {
            const [existingExt] = await db.query('SELECT u.name_surname FROM extensions e JOIN users u ON e.user_id = u.id WHERE e.extension_number = ?', [extension_number]);
            if (existingExt.length > 0) return res.status(400).json({ msg: `Extension ${extension_number} already assigned to ${existingExt[0].name_surname}.` });
        }
        const password = extension_number || '1234';
        const [userResult] = await db.query(
            'INSERT INTO users (name_surname, email, username, password, department, section, office_number, designation, station, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [name_surname, email, username, password, department, section, office_number, designation, station, role || 'user']
        );
        await db.query(
            'INSERT INTO extensions (user_id, extension_number, ip_address, mac_address, phone_model) VALUES (?, ?, ?, ?, ?)',
            [userResult.insertId, extension_number, ip_address, mac_address, phone_model]
        );
        res.status(201).json({ msg: 'User and extension added successfully.' });
    } catch (err) {
        console.error('Error adding user:', err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET api/users
router.get('/users', async (req, res) => {
    try {
        const { department, user, extension, page, limit } = req.query;
        let baseQuery = `FROM users u LEFT JOIN extensions e ON u.id = e.user_id WHERE 1=1`;
        const params = [];

        if (department) { baseQuery += ` AND u.department LIKE ?`; params.push(`%${department}%`); }
        if (user) {
            baseQuery += ` AND (u.name_surname LIKE ? OR u.username LIKE ? OR u.email LIKE ?)`;
            params.push(`%${user}%`, `%${user}%`, `%${user}%`);
        }
        if (extension) { baseQuery += ` AND e.extension_number LIKE ?`; params.push(`%${extension}%`); }

        if (page && limit) {
            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);
            const offset = (pageNum - 1) * limitNum;

            const [countResult] = await db.query(`SELECT COUNT(*) as total ${baseQuery}`, params);
            const total = countResult[0].total;

            const [rows] = await db.query(`SELECT u.*, e.extension_number, e.ip_address, e.mac_address, e.phone_model, e.status, e.last_seen, e.sip_status ${baseQuery} ORDER BY u.name_surname LIMIT ? OFFSET ?`, [...params, limitNum, offset]);

            res.json({ data: rows, total, page: pageNum, limit: limitNum });
        } else {
            const [rows] = await db.query(`SELECT u.*, e.extension_number, e.ip_address, e.mac_address, e.phone_model, e.status, e.last_seen, e.sip_status ${baseQuery} ORDER BY u.name_surname`, params);
            res.json(rows);
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT api/users/:id
router.put('/users/:id', verifyToken, requireAdmin, async (req, res) => {
    let { name_surname, email, department, section, office_number, designation, station, extension_number, ip_address, mac_address, phone_model, role } = req.body;
    const userId = req.params.id;

    if (!name_surname) return res.status(400).json({ msg: 'Please provide name & surname.' });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ msg: 'Please provide a valid email address.' });

    // Sanitize empty strings to null
    const toNull = (val) => (val === null || val === undefined || (typeof val === 'string' && val.trim() === '')) ? null : (typeof val === 'string' ? val.trim() : val);

    ip_address = toNull(ip_address);
    extension_number = toNull(extension_number);
    department = toNull(department);
    section = toNull(section);
    office_number = toNull(office_number);
    designation = toNull(designation);
    station = toNull(station);
    mac_address = toNull(mac_address);
    phone_model = toNull(phone_model);

    try {
        // Automatically update username when name changes for automation
        const username = generateUsername(name_surname);

        if (ip_address) {
            const [existingIp] = await db.query('SELECT u.name_surname FROM extensions e JOIN users u ON e.user_id = u.id WHERE e.ip_address = ? AND u.id != ?', [ip_address, userId]);
            if (existingIp.length > 0) {
                console.warn(`[400] IP Duplicate: ${ip_address} taken by ${existingIp[0].name_surname}`);
                return res.status(400).json({ msg: `IP Address ${ip_address} already assigned to ${existingIp[0].name_surname}.` });
            }
        }
        if (extension_number) {
            const [existingExt] = await db.query('SELECT u.name_surname FROM extensions e JOIN users u ON e.user_id = u.id WHERE e.extension_number = ? AND u.id != ?', [extension_number, userId]);
            if (existingExt.length > 0) {
                console.warn(`[400] Extension Duplicate: ${extension_number} taken by ${existingExt[0].name_surname}`);
                return res.status(400).json({ msg: `Extension ${extension_number} already assigned to ${existingExt[0].name_surname}.` });
            }
        }
        await db.query(
            'UPDATE users SET name_surname = ?, email = ?, username = ?, department = ?, section = ?, office_number = ?, designation = ?, station = ?, role = ? WHERE id = ?',
            [name_surname, email, username, department, section, office_number, designation, station, role || 'user', userId]
        );
        const [extResult] = await db.query(
            'UPDATE extensions SET extension_number = ?, ip_address = ?, mac_address = ?, phone_model = ? WHERE user_id = ?',
            [extension_number, ip_address, mac_address, phone_model, userId]
        );
        if (extResult.affectedRows === 0) {
            // If no row updated, it might be missing (common with imports). Check and insert if needed.
            const [existing] = await db.query('SELECT id FROM extensions WHERE user_id = ?', [userId]);
            if (existing.length === 0) {
                await db.query(
                    'INSERT INTO extensions (user_id, extension_number, ip_address, mac_address, phone_model) VALUES (?, ?, ?, ?, ?)',
                    [userId, extension_number, ip_address, mac_address, phone_model]
                );
            }
        }
        res.json({ msg: 'User updated successfully.' });
    } catch (err) {
        console.error('Error updating user:', err.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE api/users/:id
router.delete('/users/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const [result] = await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ msg: 'User not found.' });
        res.json({ msg: 'User deleted successfully.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST api/users/bulk-delete
router.post('/users/bulk-delete', verifyToken, requireAdmin, async (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ msg: 'Please provide user IDs for deletion.' });
    }
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query('DELETE FROM users WHERE id IN (?)', [ids]);
        await connection.commit();
        res.json({ msg: `${ids.length} users deleted successfully.` });
    } catch (err) {
        await connection.rollback();
        console.error('Bulk delete error:', err.message);
        res.status(500).send('Server Error');
    } finally {
        connection.release();
    }
});

// @route   POST api/users/cleanup
router.post('/users/cleanup', verifyToken, requireAdmin, async (req, res) => {
    try {
        const stats = await runDirectoryCleanup();
        res.json({ msg: `Cleanup successful. Removed ${stats.removedCount} duplicates and merged ${stats.mergedExtensions} extensions.`, ...stats });
    } catch (err) {
        console.error('Cleanup error:', err);
        res.status(500).json({ msg: 'Server Error during cleanup' });
    }
});

// --- METADATA ROUTES ---
router.get('/metadata/:type', verifyToken, requireAdmin, apiController.getMetadata);
router.post('/metadata/:type', verifyToken, requireAdmin, apiController.addMetadata);
router.delete('/metadata/:type/:id', verifyToken, requireAdmin, apiController.deleteMetadata);

// --- ACTIVITY ROUTES ---
router.get('/activity', verifyToken, requireAdmin, async (req, res) => {
    try {
        const [logs] = await db.query('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 100');
        res.json(logs);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

router.post('/activity', verifyToken, requireAdmin, async (req, res) => {
    const { action, details, user_name } = req.body;
    if (!action) return res.status(400).json({ msg: 'Action is required' });
    try {
        await db.query('INSERT INTO activity_logs (action, details, user_name) VALUES (?, ?, ?)', [action, details || null, user_name || 'System']);
        res.status(201).json({ msg: 'Activity logged' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// --- IMPORT ROUTES ---
router.post('/import/users', verifyToken, requireAdmin, upload.single('file'), apiController.importUsers);

// --- REPORT ROUTES ---
router.get('/reports/daily', verifyToken, requireAdmin, async (req, res) => {
    const { format = 'json', date } = req.query;
    if (!date) return res.status(400).json({ msg: 'Date parameter is required' });
    try {
        const startOfDay = new Date(date); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date); endOfDay.setHours(23, 59, 59, 999);
        const [logs] = await db.query(
            `SELECT e.extension_number, e.ip_address, u.name_surname, u.department, u.station, pl.ping_time, pl.result FROM ping_logs pl JOIN extensions e ON pl.extension_id = e.id JOIN users u ON e.user_id = u.id WHERE pl.ping_time >= ? AND pl.ping_time <= ? AND pl.result = 'Failed' ORDER BY pl.ping_time DESC`,
            [startOfDay, endOfDay]
        );
        if (format === 'pdf') { generatePDF(res, logs, `Daily Downtime Report - ${date}`, `daily_report_${date}.pdf`); }
        else if (format === 'excel') { generateExcel(res, logs, `daily_report_${date}.xlsx`); }
        else { res.json(logs); }
    } catch (err) { console.error(err.message); res.status(500).send('Server Error'); }
});

router.get('/reports/range', verifyToken, requireAdmin, async (req, res) => {
    const { format = 'json', startDate, endDate } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ msg: 'Dates are required' });
    try {
        const start = new Date(startDate); start.setHours(0, 0, 0, 0);
        const end = new Date(endDate); end.setHours(23, 59, 59, 999);
        const [logs] = await db.query(
            `SELECT e.extension_number, e.ip_address, u.name_surname, u.department, u.station, pl.ping_time, pl.result FROM ping_logs pl JOIN extensions e ON pl.extension_id = e.id JOIN users u ON e.user_id = u.id WHERE pl.ping_time >= ? AND pl.ping_time <= ? AND pl.result = 'Failed' ORDER BY pl.ping_time DESC`,
            [start, end]
        );
        if (format === 'pdf') { generatePDF(res, logs, `Downtime Report - ${startDate} to ${endDate}`, `report_${startDate}_to_${endDate}.pdf`); }
        else if (format === 'excel') { generateExcel(res, logs, `report_${startDate}_to_${endDate}.xlsx`); }
        else { res.json(logs); }
    } catch (err) { console.error(err.message); res.status(500).send('Server Error'); }
});

function generatePDF(res, logs, title, filename) {
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    doc.pipe(res);
    doc.fontSize(20).text(title, { align: 'center' });
    doc.fontSize(10).text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' }).moveDown(2);
    const userX = 220, timeX = 400;
    doc.fontSize(10).text('Extension', 50, doc.y, { bold: true }).text('User', userX, doc.y, { bold: true }).text('Time of Failure', timeX, doc.y, { bold: true }).moveDown();
    logs.forEach(log => {
        doc.fontSize(9).text(log.extension_number, 50, doc.y, { width: 70 }).text(`${log.name_surname} (${log.department || 'N/A'})`, userX, doc.y, { width: 180 }).text(new Date(log.ping_time).toLocaleString(), timeX, doc.y, { width: 150 }).moveDown();
    });
    doc.end();
}

function generateExcel(res, logs, filename) {
    const worksheetData = logs.map(log => ({ 'Extension': log.extension_number, 'IP Address': log.ip_address, 'User': log.name_surname, 'Department': log.department || 'N/A', 'Station': log.station || 'N/A', 'Time of Failure': new Date(log.ping_time).toLocaleString() }));
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(worksheetData);
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Downtime');
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(buffer);
}

module.exports = router;
