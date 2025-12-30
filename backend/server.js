const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Define Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/activity', require('./routes/activity'));
app.use('/api/import', require('./routes/import'));
app.use('/api/departments', require('./routes/departments'));
app.use('/api/sections', require('./routes/sections'));

const { startMonitoring } = require('./services/monitoringService');

app.get('/', (req, res) => {
  res.send('BCC VOIP Directory Backend is running...');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  // Start the monitoring service
  startMonitoring();
});
