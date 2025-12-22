const express = require('express');
const router = express.Router();
const db = require('../config/db');

// @route   GET api/activity
// @desc    Get all activity logs
// @access  Private
router.get('/', async (req, res) => {
    try {
        const [logs] = await db.query(
            `SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 100`
        );
        res.json(logs);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST api/activity
// @desc    Log an activity
// @access  Private
router.post('/', async (req, res) => {
    const { action, details, user_name } = req.body;

    if (!action) {
        return res.status(400).json({ msg: 'Action is required' });
    }

    try {
        await db.query(
            'INSERT INTO activity_logs (action, details, user_name) VALUES (?, ?, ?)',
            [action, details || null, user_name || 'System']
        );
        res.status(201).json({ msg: 'Activity logged successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
