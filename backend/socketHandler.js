const { Server } = require('socket.io');
const db = require('./config/db');

let io;

// Initialize Socket.io with the HTTP server
function initializeSocket(httpServer) {
    io = new Server(httpServer, {
        cors: {
            origin: (origin, callback) => {
                if (process.env.NODE_ENV !== 'production') {
                    callback(null, true);
                } else {
                    const allowedOrigins = [process.env.FRONTEND_URL, 'http://localhost:5173'];
                    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
                        callback(null, true);
                    } else {
                        callback(new Error('Not allowed by CORS'));
                    }
                }
            },
            credentials: true
        },
        // Tuning for 1000 concurrent users
        pingTimeout: 60000,
        pingInterval: 25000,
        upgradeTimeout: 30000,
        maxHttpBufferSize: 1e6, // 1MB
        transports: ['websocket', 'polling']
    });

    // User tracking: userId -> { socketId, department, role }
    const connectedUsers = new Map();

    io.on('connection', (socket) => {
        console.log(`[Socket.io] User connected: ${socket.id}`);

        // Join user to their department room
        socket.on('join', ({ userId, department, role }) => {
            connectedUsers.set(userId, { socketId: socket.id, department, role });

            if (department) {
                socket.join(`dept:${department}`);
                console.log(`[Socket.io] User ${userId} joined room: dept:${department}`);
            }

            if (role === 'admin') {
                socket.join('admin');
                console.log(`[Socket.io] Admin ${userId} joined admin room`);
            }
        });

        socket.on('disconnect', () => {
            // Remove from tracking
            for (const [userId, data] of connectedUsers.entries()) {
                if (data.socketId === socket.id) {
                    connectedUsers.delete(userId);
                    console.log(`[Socket.io] User ${userId} disconnected`);
                    break;
                }
            }
        });
    });

    console.log('[Socket.io] Server initialized');
    return io;
}

// Broadcast extension status update
function broadcastStatusUpdate(extension) {
    if (!io) return;

    // Broadcast to all admins
    io.to('admin').emit('extension:statusUpdate', extension);

    // Broadcast to specific department if applicable
    if (extension.department) {
        io.to(`dept:${extension.department}`).emit('extension:statusUpdate', extension);
    }
}

// Broadcast new user added
function broadcastUserAdded(user) {
    if (!io) return;
    io.to('admin').emit('user:added', user);
}

// Broadcast user deleted
function broadcastUserDeleted(userId) {
    if (!io) return;
    io.to('admin').emit('user:deleted', { id: userId });
}

// Broadcast bulk changes
function broadcastBulkUpdate(type, data) {
    if (!io) return;
    io.to('admin').emit(`bulk:${type}`, data);
}

module.exports = {
    initializeSocket,
    broadcastStatusUpdate,
    broadcastUserAdded,
    broadcastUserDeleted,
    broadcastBulkUpdate
};
