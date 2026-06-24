const express = require('express');
const http = require('http');
const cors = require('cors');
const os = require('os');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const xss = require('xss-clean');
const session = require('express-session');
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

// IIS/Nginx proxies send X-Forwarded-For; express-rate-limit needs Express to trust that proxy.
app.set('trust proxy', Number(process.env.TRUST_PROXY || 1));

// Initialize Socket.io
const { initializeSocket } = require('./socketHandler');
initializeSocket(server);

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow any origin in development
    if (process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      const allowedOrigins = [
        process.env.FRONTEND_URL,
        'http://9.135.112.20', // Explicitly allow the current VPS IP
        'http://localhost:5173'
      ];

      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Origin rejected: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Session middleware — HTTP-only cookie, replaces sessionStorage
app.use(session({
  secret: process.env.SESSION_SECRET || 'bcc-voip-change-this-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Security Middleware
app.use(helmet());
app.use(xss());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Stricter limiter for the login endpoint — 10 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts. Please try again in 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});
app.use('/api/auth/login', loginLimiter);

// Define Routes — /api/v1 for versioned clients, /api for backward compat
const apiRoutes = require('./routes/api');
app.use('/api/v1', apiRoutes);
app.use('/api', apiRoutes);

const { startServices } = require('./services');

app.get('/', (req, res) => {
  res.send('CoB INTERNAL DIRECTORY Backend is running...');
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Global Error]', err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start the server (using 'server' instead of 'app' for Socket.io)
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
  console.log(`Access locally at http://localhost:${PORT}`);
  console.log(`Access from network at http://${LOCAL_IP}:${PORT}`);
  startServices();
});
