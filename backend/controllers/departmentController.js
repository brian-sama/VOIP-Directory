const db = require('../config/db');

// Get all departments
exports.getDepartments = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM departments ORDER BY name');
        res.json(rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Add a department
exports.addDepartment = async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ msg: 'Name is required' });
    try {
        const [result] = await db.query('INSERT IGNORE INTO departments (name) VALUES (?)', [name]);
        res.json({ id: result.insertId, name });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Delete a department
exports.deleteDepartment = async (req, res) => {
    try {
        await db.query('DELETE FROM departments WHERE id = ?', [req.params.id]);
        res.json({ msg: 'Department deleted' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};
