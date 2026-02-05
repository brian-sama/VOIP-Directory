const express = require('express');
const http = require('http');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5001;

// Initialize Socket.io
const { initializeSocket } = require('./socketHandler');
initializeSocket(server);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Define Routes
app.use('/api', require('./routes/api'));

const { startServices } = require('./services');

app.get('/', (req, res) => {
  res.send('BCC VOIP Directory Backend is running...');
});

// Start the server (using 'server' instead of 'app' for Socket.io)
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  startServices();
});
