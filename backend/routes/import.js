const express = require('express');
const router = express.Router();
const multer = require('multer');
const importController = require('../controllers/importController');

// Multer setup for memory storage (process in memory)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// @route   POST api/import/users
// @desc    Import users from CSV/Excel
// @access  Private (Admin)
router.post('/users', upload.single('file'), importController.importUsers);

module.exports = router;
