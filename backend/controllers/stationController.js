const db = require('../config/db');

// Get all stations
exports.getStations = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM stations ORDER BY name');
        res.json(rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Add a station
exports.addStation = async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ msg: 'Name is required' });
    try {
        const [result] = await db.query('INSERT IGNORE INTO stations (name) VALUES (?)', [name]);
        res.json({ id: result.insertId, name });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Delete a station
exports.deleteStation = async (req, res) => {
    try {
        await db.query('DELETE FROM stations WHERE id = ?', [req.params.id]);
        res.json({ msg: 'Station deleted' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};
