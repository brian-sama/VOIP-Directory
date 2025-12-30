const db = require('../config/db');

// Get all sections
exports.getSections = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM sections ORDER BY name');
        res.json(rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Add a section
exports.addSection = async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ msg: 'Name is required' });
    try {
        const [result] = await db.query('INSERT IGNORE INTO sections (name) VALUES (?)', [name]);
        res.json({ id: result.insertId, name });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Delete a section
exports.deleteSection = async (req, res) => {
    try {
        await db.query('DELETE FROM sections WHERE id = ?', [req.params.id]);
        res.json({ msg: 'Section deleted' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};
