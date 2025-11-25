const admin = require('../utils/admin');

/**
 * Admin Authorization Middleware
 * Check if user has admin privileges
 */

const adminAuth = async (req, res, next) => {
    try {
        const userId = req.user.userId;

        const adminUser = await admin.isAdmin(userId);

        if (!adminUser) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin privileges required.'
            });
        }

        // Attach admin info to request
        req.admin = {
            adminId: adminUser.admin_id,
            adminLevel: adminUser.admin_level
        };

        next();
    } catch (error) {
        console.error('Admin auth middleware error:', error);
        res.status(500).json({
            success: false,
            message: 'Authorization check failed'
        });
    }
};

/**
 * Super Admin only middleware
 */
const superAdminAuth = async (req, res, next) => {
    try {
        const userId = req.user.userId;

        const adminUser = await admin.isAdmin(userId);

        if (!adminUser || adminUser.admin_level !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Super admin privileges required.'
            });
        }

        req.admin = {
            adminId: adminUser.admin_id,
            adminLevel: adminUser.admin_level
        };

        next();
    } catch (error) {
        console.error('Super admin auth middleware error:', error);
        res.status(500).json({
            success: false,
            message: 'Authorization check failed'
        });
    }
};

module.exports = {
    adminAuth,
    superAdminAuth
};
