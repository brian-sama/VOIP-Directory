
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./config/db'); // Reuse existing db connection

const app = express();
const PORT = 5002;

// Middleware
app.use(cors());
app.use(express.json());

// Import Routes
app.use('/api/import', require('./routes/import'));

// Start the server
app.listen(PORT, () => {
    console.log(`Temp Server is running on port ${PORT}`);
});
