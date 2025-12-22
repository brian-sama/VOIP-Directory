const express = require('express');
const router = express.Router();
const db = require('../config/db');

// @route   POST api/auth/login
// @desc    Authenticate admin and get token (for future implementation)
// @access  Public
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ msg: 'Please enter all fields' });
  }

  try {
    const [rows] = await db.query('SELECT * FROM admins WHERE username = ?', [username]);

    if (rows.length === 0) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    const admin = rows[0];

    // NOTE: This is plain text password comparison. In a production environment,
    // you MUST use a hashing library like bcrypt to compare passwords.
    // Example: const isMatch = await bcrypt.compare(password, admin.password);
    const isMatch = (password === admin.password);

    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // For now, we'll just send a success message.
    // In a real app, you would return a JSON Web Token (JWT).
    res.json({
      msg: 'Login successful',
      // token: 'YOUR_JWT_HERE'
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
