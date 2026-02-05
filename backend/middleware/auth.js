const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'bcc_voip_secret_key_change_in_production';
const JWT_EXPIRES_IN = '7d';

// Generate JWT token
function generateToken(user) {
    return jwt.sign(
        {
            id: user.id,
            username: user.username,
            role: user.role,
            department: user.department
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

// Verify JWT middleware
function verifyToken(req, res, next) {
    const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ msg: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ msg: 'Invalid or expired token.' });
    }
}

// Admin-only middleware
function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ msg: 'Access denied. Admin only.' });
    }
    next();
}

module.exports = {
    generateToken,
    verifyToken,
    requireAdmin,
    JWT_SECRET
};
