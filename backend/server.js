const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Define Routes
app.use('/api', require('./routes/api'));

const { startServices } = require('./services');

app.get('/', (req, res) => {
  res.send('BCC VOIP Directory Backend is running...');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  startServices();
});
