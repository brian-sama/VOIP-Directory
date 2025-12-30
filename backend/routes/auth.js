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
    // 1. Check if Admin
    const [adminRows] = await db.query('SELECT * FROM admins WHERE username = ?', [username]);

    if (adminRows.length > 0) {
      const admin = adminRows[0];
      // Plain text check (Update to bcrypt in production)
      if (password === admin.password) {
        return res.json({
          msg: 'Login successful',
          role: 'admin',
          user: { username: admin.username }
        });
      }
    }

    // 2. Check if Regular User
    // Search by username (which is name_surname) or directly by name_surname if consistent
    const [userRows] = await db.query('SELECT * FROM users WHERE name_surname = ? OR username = ?', [username, username]);

    if (userRows.length > 0) {
      const user = userRows[0];
      // Password for user is their extension number (stored in password column)
      if (password === user.password) {
        return res.json({
          msg: 'Login successful',
          role: 'user',
          user: {
             username: user.name_surname,
             department: user.department,
             section: user.section
          }
        });
      }
    }

    return res.status(400).json({ msg: 'Invalid credentials' });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
