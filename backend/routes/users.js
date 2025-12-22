const express = require('express');
const router = express.Router();
const db = require('../config/db');

// @route   POST api/users
// @desc    Add a new user and their extension
// @access  Private (to be protected by auth middleware)
router.post('/', async (req, res) => {
    const { name_surname, department, office_number, designation, station, extension_number, ip_address, mac_address, phone_model } = req.body;

    if (!name_surname || !extension_number || !ip_address) {
        return res.status(400).json({ msg: 'Please provide name, extension number, and IP address.' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Insert into users table
        const [userResult] = await connection.query(
            'INSERT INTO users (name_surname, department, office_number, designation, station) VALUES (?, ?, ?, ?, ?)',
            [name_surname, department, office_number, designation, station]
        );
        const newUserId = userResult.insertId;

        // Insert into extensions table (including mac and model)
        await connection.query(
            'INSERT INTO extensions (user_id, extension_number, ip_address, mac_address, phone_model) VALUES (?, ?, ?, ?, ?)',
            [newUserId, extension_number, ip_address, mac_address || null, phone_model || null]
        );

        await connection.commit();
        res.status(201).json({ msg: 'User and extension added successfully.' });
    } catch (err) {
        await connection.rollback();
        console.error(err.message);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ msg: 'Extension number or IP address already exists.' });
        }
        res.status(500).send('Server Error');
    } finally {
        connection.release();
    }
});

// @route   GET api/users
// @desc    Get all users and their extensions
// @access  Private
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT 
                u.id, 
                u.name_surname, 
                u.department, 
                u.office_number, 
                u.designation,
                u.station,
                e.extension_number, 
                e.ip_address, 
                e.mac_address,
                e.phone_model,
                e.status,
                e.last_seen,
                e.sip_status,
                e.sip_port_open,
                e.sip_last_checked
            FROM users u
            JOIN extensions e ON u.id = e.user_id
            ORDER BY u.name_surname`
        );
        res.json(rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT api/users/:id
// @desc    Update a user and their extension
// @access  Private
router.put('/:id', async (req, res) => {
    const { name_surname, department, office_number, designation, station, extension_number, ip_address, mac_address, phone_model } = req.body;
    const userId = req.params.id;

    if (!name_surname || !extension_number || !ip_address) {
        return res.status(400).json({ msg: 'Please provide name, extension number, and IP address.' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Update users table including designation and station
        await connection.query(
            'UPDATE users SET name_surname = ?, department = ?, office_number = ?, designation = ?, station = ? WHERE id = ?',
            [name_surname, department, office_number, designation || null, station || null, userId]
        );

        // Update extensions table including mac and phone model
        await connection.query(
            'UPDATE extensions SET extension_number = ?, ip_address = ?, mac_address = ?, phone_model = ? WHERE user_id = ?',
            [extension_number, ip_address, mac_address || null, phone_model || null, userId]
        );

        await connection.commit();
        res.json({ msg: 'User and extension updated successfully.' });
    } catch (err) {
        await connection.rollback();
        console.error(err.message);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ msg: 'Extension number or IP address already exists.' });
        }
        res.status(500).send('Server Error');
    } finally {
        connection.release();
    }
});

// @route   DELETE api/users/:id
// @desc    Delete a user and their extension
// @access  Private
router.delete('/:id', async (req, res) => {
    const userId = req.params.id;

    try {
        // The database is set up with ON DELETE CASCADE,
        // so deleting the user will also delete their extension.
        const [result] = await db.query('DELETE FROM users WHERE id = ?', [userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ msg: 'User not found.' });
        }

        res.json({ msg: 'User and extension deleted successfully.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});


module.exports = router;
