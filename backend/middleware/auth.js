/**
 * Authentication Middleware - File Storage Version
 * Verifies JWT tokens and attaches user info to request
 */

const jwt = require('jsonwebtoken');
const { getUserById } = require('../utils/auth');

/**
 * Verify JWT token middleware
 */
async function authMiddleware(req, res, next) {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

        // Get user from file storage
        const user = await getUserById(decoded.userId);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        if (user.is_suspended) {
            return res.status(403).json({
                success: false,
                message: 'Account suspended'
            });
        }

        // Attach user info to request
        req.user = {
            userId: user.user_id,
            email: user.email,
            role: user.role,
            fullName: user.full_name
        };

        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired'
            });
        }

        console.error('Auth middleware error:', error);
        return res.status(500).json({
            success: false,
            message: 'Authentication error'
        });
    }
}

/**
 * Role-based access control middleware
 */
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Insufficient permissions.'
            });
        }

        next();
    };
}

module.exports = authMiddleware;
module.exports.requireRole = requireRole;
