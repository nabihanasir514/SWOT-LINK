const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/auth');
const { adminAuth, superAdminAuth } = require('../middleware/adminAuth');
const admin = require('../utils/admin');

/**
 * Admin Panel API Routes
 * User management, KYC verification, moderation
 */

// Configure multer for KYC document uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../uploads/kyc'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'kyc-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const kycUpload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB max
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Only PDF and image files are allowed'));
        }
    }
});

// ============================================
// ADMIN STATISTICS
// ============================================

/**
 * GET /api/admin/stats
 * Get admin dashboard statistics
 */
router.get('/stats', auth, adminAuth, async (req, res) => {
    try {
        const stats = await admin.getAdminStats();

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Get admin stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics'
        });
    }
});

// ============================================
// USER MANAGEMENT
// ============================================

/**
 * GET /api/admin/users
 * Get all users with pagination and filters
 */
router.get('/users', auth, adminAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const filters = {
            role: req.query.role,
            is_verified: req.query.is_verified === 'true' ? true : req.query.is_verified === 'false' ? false : undefined,
            is_suspended: req.query.is_suspended === 'true' ? true : req.query.is_suspended === 'false' ? false : undefined,
            search: req.query.search
        };

        const result = await admin.getUsers(page, limit, filters);

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users'
        });
    }
});

/**
 * GET /api/admin/users/:userId
 * Get detailed user information
 */
router.get('/users/:userId', auth, adminAuth, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const userDetails = await admin.getUserDetails(userId);

        if (!userDetails) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            data: userDetails
        });
    } catch (error) {
        console.error('Get user details error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user details'
        });
    }
});

/**
 * PUT /api/admin/users/:userId
 * Update user details
 */
router.put('/users/:userId', auth, adminAuth, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const adminId = req.admin.adminId;

        const result = await admin.updateUser(userId, req.body, adminId);

        res.json(result);
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update user'
        });
    }
});

/**
 * DELETE /api/admin/users/:userId
 * Delete (deactivate) user
 */
router.delete('/users/:userId', auth, superAdminAuth, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const adminId = req.admin.adminId;
        const reason = req.body.reason || 'No reason provided';

        const result = await admin.deleteUser(userId, adminId, reason);

        res.json(result);
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete user'
        });
    }
});

// ============================================
// KYC DOCUMENT MANAGEMENT
// ============================================

/**
 * POST /api/admin/kyc/upload
 * Upload KYC document (user endpoint)
 */
router.post('/kyc/upload', auth, kycUpload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        const { document_type, expiry_date } = req.body;
        const userId = req.user.userId;

        const fileStorage = require('../config/fileStorage');
        await fileStorage.insert('kyc_documents', {
            userId,
            documentType: document_type,
            filePath: req.file.path,
            fileName: req.file.originalname,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            expiryDate: expiry_date || null,
            verificationStatus: 'pending',
            uploadedAt: new Date().toISOString()
        });

        res.json({
            success: true,
            message: 'Document uploaded successfully. Pending verification.'
        });
    } catch (error) {
        console.error('Upload KYC document error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload document'
        });
    }
});

/**
 * GET /api/admin/kyc/pending
 * Get pending KYC documents for verification
 */
router.get('/kyc/pending', auth, adminAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const result = await admin.getPendingDocuments(page, limit);

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('Get pending documents error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch pending documents'
        });
    }
});

/**
 * PUT /api/admin/kyc/:documentId/verify
 * Approve or reject KYC document
 */
router.put('/kyc/:documentId/verify', auth, adminAuth, async (req, res) => {
    try {
        const documentId = parseInt(req.params.documentId);
        const adminId = req.admin.adminId;
        const { status, notes } = req.body;

        if (!['approved', 'rejected', 'resubmit_required'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }

        const result = await admin.verifyDocument(documentId, adminId, status, notes);

        res.json({
            success: true,
            message: `Document ${status}`
        });
    } catch (error) {
        console.error('Verify document error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify document'
        });
    }
});

/**
 * GET /api/admin/kyc/user/:userId
 * Get user's KYC documents
 */
router.get('/kyc/user/:userId', auth, adminAuth, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const fileStorage = require('../config/fileStorage');

        const documents = await fileStorage.findMany('kyc_documents', (doc) => doc.userId === userId);
        
        // Sort by uploaded date (newest first)
        documents.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

        res.json({
            success: true,
            documents
        });
    } catch (error) {
        console.error('Get user KYC documents error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch documents'
        });
    }
});

// ============================================
// USER SUSPENSION
// ============================================

/**
 * POST /api/admin/users/:userId/suspend
 * Suspend user account
 */
router.post('/users/:userId/suspend', auth, adminAuth, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const adminId = req.admin.adminId;
        const { reason, duration } = req.body; // duration in days, null for permanent

        if (!reason) {
            return res.status(400).json({
                success: false,
                message: 'Reason is required'
            });
        }

        const result = await admin.suspendUser(userId, adminId, reason, duration);

        res.json({
            success: true,
            message: 'User suspended successfully'
        });
    } catch (error) {
        console.error('Suspend user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to suspend user'
        });
    }
});

/**
 * POST /api/admin/users/:userId/unsuspend
 * Unsuspend user account
 */
router.post('/users/:userId/unsuspend', auth, adminAuth, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const adminId = req.admin.adminId;

        const result = await admin.unsuspendUser(userId, adminId);

        res.json({
            success: true,
            message: 'User unsuspended successfully'
        });
    } catch (error) {
        console.error('Unsuspend user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to unsuspend user'
        });
    }
});

// ============================================
// REPORTS & MODERATION
// ============================================

/**
 * GET /api/admin/reports
 * Get pending reports
 */
router.get('/reports', auth, adminAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const result = await admin.getPendingReports(page, limit);

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('Get reports error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch reports'
        });
    }
});

/**
 * PUT /api/admin/reports/:reportId/resolve
 * Resolve a report
 */
router.put('/reports/:reportId/resolve', auth, adminAuth, async (req, res) => {
    try {
        const reportId = parseInt(req.params.reportId);
        const adminId = req.admin.adminId;
        const { resolution_notes } = req.body;

        const result = await admin.resolveReport(reportId, adminId, resolution_notes);

        res.json({
            success: true,
            message: 'Report resolved'
        });
    } catch (error) {
        console.error('Resolve report error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to resolve report'
        });
    }
});

// ============================================
// ADMIN ACTION LOGS
// ============================================

/**
 * GET /api/admin/logs
 * Get admin action logs
 */
router.get('/logs', auth, adminAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const filters = {
            admin_id: req.query.admin_id ? parseInt(req.query.admin_id) : undefined,
            action_type: req.query.action_type
        };

        const result = await admin.getActionLogs(page, limit, filters);

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('Get action logs error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch logs'
        });
    }
});

module.exports = router;
