const express = require('express');
const http = require('http');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const os = require('os');
require('dotenv').config();

// Utility to get local IP address
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const LOCAL_IP = getLocalIp();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5001;

// Initialize Socket.io
const { initializeSocket } = require('./socketHandler');
initializeSocket(server);

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow any origin in development, or specific origins in production
    if (process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      const allowedOrigins = [
        process.env.FRONTEND_URL,
        'http://localhost:5173'
      ];
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
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
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
  console.log(`Access locally at http://localhost:${PORT}`);
  console.log(`Access from network at http://${LOCAL_IP}:${PORT}`);
  startServices();
});
