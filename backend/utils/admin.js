const fileStorage = require('../config/fileStorage');

/**
 * Admin Utility Functions (File Storage Version)
 * CRUD operations for user management and verification
 */

const admin = {
    /**
     * Check if user is admin
     */
    isAdmin: async (userId) => {
        try {
            const adminUser = await fileStorage.findOne('admin_users', (admin) => 
                admin.userId === userId && (admin.isActive === true || admin.isActive === 1)
            );
            return adminUser || null;
        } catch (error) {
            console.error('Is admin check error:', error);
            return null;
        }
    },

    /**
     * Get all users with pagination and filters
     */
    getUsers: async (page = 1, limit = 20, filters = {}) => {
        try {
            // Get all users
            let allUsers = await fileStorage.findMany('users', () => true);

            // Get profiles for display names
            const startupProfiles = await fileStorage.findMany('startup_profiles', () => true);
            const investorProfiles = await fileStorage.findMany('investor_profiles', () => true);
            const kycDocuments = await fileStorage.findMany('kyc_documents', () => true);
            const userReports = await fileStorage.findMany('user_reports', () => true);

            // Create lookup maps
            const startupMap = {};
            startupProfiles.forEach(sp => { startupMap[sp.userId] = sp; });

            const investorMap = {};
            investorProfiles.forEach(ip => { investorMap[ip.userId] = ip; });

            // Apply filters
            allUsers = allUsers.filter(user => {
                if (filters.role && user.roleName !== filters.role) return false;
                if (filters.is_verified !== undefined && user.isVerified !== filters.is_verified) return false;
                if (filters.is_suspended !== undefined && user.isSuspended !== filters.is_suspended) return false;
                
                if (filters.search) {
                    const searchLower = filters.search.toLowerCase();
                    const startupProfile = startupMap[user.userId];
                    const investorProfile = investorMap[user.userId];
                    const emailMatch = user.email.toLowerCase().includes(searchLower);
                    const companyMatch = startupProfile?.companyName?.toLowerCase().includes(searchLower);
                    const investorMatch = investorProfile?.investorName?.toLowerCase().includes(searchLower);
                    
                    if (!emailMatch && !companyMatch && !investorMatch) return false;
                }
                
                return true;
            });

            // Sort by created date (newest first)
            allUsers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            // Calculate pagination
            const total = allUsers.length;
            const offset = (page - 1) * limit;
            const paginatedUsers = allUsers.slice(offset, offset + limit);

            // Enrich user data
            const users = paginatedUsers.map(user => {
                const startupProfile = startupMap[user.userId];
                const investorProfile = investorMap[user.userId];
                const displayName = startupProfile?.companyName || investorProfile?.investorName || null;

                const pendingDocs = kycDocuments.filter(doc => 
                    doc.userId === user.userId && doc.verificationStatus === 'pending'
                ).length;

                const activeReports = userReports.filter(report => 
                    report.reportedUserId === user.userId && report.status === 'pending'
                ).length;

                return {
                    user_id: user.userId,
                    email: user.email,
                    role: user.roleName,
                    is_active: user.isActive,
                    is_verified: user.isVerified,
                    is_suspended: user.isSuspended,
                    verified_at: user.verifiedAt,
                    created_at: user.createdAt,
                    admin_notes: user.adminNotes,
                    display_name: displayName,
                    pending_documents: pendingDocs,
                    active_reports: activeReports
                };
            });

            return {
                users,
                pagination: {
                    page,
                    limit,
                    total,
                    total_pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            console.error('Get users error:', error);
            throw error;
        }
    },

    /**
     * Get user details by ID
     */
    getUserDetails: async (userId) => {
        try {
            const user = await fileStorage.findOne('users', (u) => u.userId === userId);
            if (!user) return null;

            // Get profile
            let profile = null;
            if (user.roleName === 'Startup') {
                profile = await fileStorage.findOne('startup_profiles', (p) => p.userId === userId);
            } else if (user.roleName === 'Investor') {
                profile = await fileStorage.findOne('investor_profiles', (p) => p.userId === userId);
            }

            // Count messages
            const messages = await fileStorage.findMany('messages', (m) => 
                m.senderId === userId || m.receiverId === userId
            );

            // Count videos
            const videos = await fileStorage.findMany('pitch_videos', (v) => v.userId === userId);

            // Get documents
            const documents = await fileStorage.findMany('kyc_documents', (d) => d.userId === userId);
            documents.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

            // Get verifications
            const verifications = await fileStorage.findMany('user_verifications', (v) => v.userId === userId);
            verifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            // Get reports with reporter info
            const allReports = await fileStorage.findMany('user_reports', (r) => r.reportedUserId === userId);
            const allUsers = await fileStorage.findMany('users', () => true);
            const userMap = {};
            allUsers.forEach(u => { userMap[u.userId] = u; });

            const reports = allReports.map(report => ({
                ...report,
                reporter_email: userMap[report.reporterId]?.email || 'Unknown'
            })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            // Get suspension history with admin info
            const allSuspensions = await fileStorage.findMany('user_suspensions', (s) => s.userId === userId);
            const adminUsers = await fileStorage.findMany('admin_users', () => true);
            const adminMap = {};
            adminUsers.forEach(a => { adminMap[a.adminId] = a; });

            const suspensions = allSuspensions.map(suspension => {
                const admin = adminMap[suspension.suspendedBy];
                const adminUser = admin ? userMap[admin.userId] : null;
                return {
                    ...suspension,
                    admin_email: adminUser?.email || 'Unknown'
                };
            }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            // Merge user and profile data
            const userData = {
                ...user,
                ...profile,
                message_count: messages.length,
                video_count: videos.length,
                document_count: documents.length,
                report_count: reports.length
            };

            return {
                user: userData,
                documents,
                verifications,
                reports,
                suspensions
            };
        } catch (error) {
            console.error('Get user details error:', error);
            throw error;
        }
    },

    /**
     * Update user details
     */
    updateUser: async (userId, updates, adminId) => {
        try {
            const user = await fileStorage.findOne('users', (u) => u.userId === userId);
            if (!user) {
                throw new Error('User not found');
            }

            const allowedFields = ['isActive', 'isVerified', 'isSuspended', 'adminNotes'];
            const updateData = {};

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key)) {
                    updateData[key] = value;
                }
            }

            // Update user
            await fileStorage.update('users', userId, {
                ...user,
                ...updateData
            });

            // Log admin action
            await fileStorage.insert('admin_action_logs', {
                adminId,
                actionType: 'user_update',
                targetUserId: userId,
                actionDetails: JSON.stringify(updateData),
                createdAt: new Date().toISOString()
            });

            return { success: true };
        } catch (error) {
            console.error('Update user error:', error);
            throw error;
        }
    },

    /**
     * Delete user (soft delete)
     */
    deleteUser: async (userId, adminId, reason) => {
        try {
            const user = await fileStorage.findOne('users', (u) => u.userId === userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Soft delete by setting isActive to false
            await fileStorage.update('users', userId, {
                ...user,
                isActive: false,
                deletedAt: new Date().toISOString(),
                deletionReason: reason
            });

            // Log admin action
            await fileStorage.insert('admin_action_logs', {
                adminId,
                actionType: 'user_delete',
                targetUserId: userId,
                actionDetails: JSON.stringify({ reason }),
                createdAt: new Date().toISOString()
            });

            return { success: true };
        } catch (error) {
            console.error('Delete user error:', error);
            throw error;
        }
    },

    /**
     * Get pending KYC documents
     */
    getPendingDocuments: async (page = 1, limit = 20) => {
        try {
            let pendingDocs = await fileStorage.findMany('kyc_documents', (doc) => 
                doc.verificationStatus === 'pending'
            );

            // Get user info
            const users = await fileStorage.findMany('users', () => true);
            const userMap = {};
            users.forEach(u => { userMap[u.userId] = u; });

            // Enrich documents with user info
            pendingDocs = pendingDocs.map(doc => ({
                ...doc,
                user_email: userMap[doc.userId]?.email || 'Unknown',
                user_role: userMap[doc.userId]?.roleName || 'Unknown'
            }));

            // Sort by uploaded date (oldest first)
            pendingDocs.sort((a, b) => new Date(a.uploadedAt) - new Date(b.uploadedAt));

            // Paginate
            const total = pendingDocs.length;
            const offset = (page - 1) * limit;
            const documents = pendingDocs.slice(offset, offset + limit);

            return {
                documents,
                pagination: {
                    page,
                    limit,
                    total,
                    total_pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            console.error('Get pending documents error:', error);
            throw error;
        }
    },

    /**
     * Verify KYC document
     */
    verifyDocument: async (documentId, adminId, status, notes) => {
        try {
            const doc = await fileStorage.findOne('kyc_documents', (d) => d.documentId === documentId);
            if (!doc) {
                throw new Error('Document not found');
            }

            // Update document
            await fileStorage.update('kyc_documents', documentId, {
                ...doc,
                verificationStatus: status,
                verifiedBy: adminId,
                verifiedAt: new Date().toISOString(),
                verificationNotes: notes
            });

            // If approved, update user verification status
            if (status === 'approved') {
                const user = await fileStorage.findOne('users', (u) => u.userId === doc.userId);
                if (user) {
                    await fileStorage.update('users', doc.userId, {
                        ...user,
                        isVerified: true,
                        verifiedAt: new Date().toISOString()
                    });

                    // Create verification record
                    await fileStorage.insert('user_verifications', {
                        userId: doc.userId,
                        verificationType: doc.documentType,
                        verifiedBy: adminId,
                        verificationStatus: 'approved',
                        notes: notes,
                        createdAt: new Date().toISOString()
                    });
                }
            }

            // Log admin action
            await fileStorage.insert('admin_action_logs', {
                adminId,
                actionType: 'kyc_verify',
                targetUserId: doc.userId,
                actionDetails: JSON.stringify({ documentId, status, notes }),
                createdAt: new Date().toISOString()
            });

            return { success: true };
        } catch (error) {
            console.error('Verify document error:', error);
            throw error;
        }
    },

    /**
     * Suspend user
     */
    suspendUser: async (userId, adminId, reason, duration = null) => {
        try {
            const user = await fileStorage.findOne('users', (u) => u.userId === userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Update user
            await fileStorage.update('users', userId, {
                ...user,
                isSuspended: true,
                suspendedAt: new Date().toISOString()
            });

            // Create suspension record
            const suspendedUntil = duration 
                ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString()
                : null;

            await fileStorage.insert('user_suspensions', {
                userId,
                suspendedBy: adminId,
                suspensionReason: reason,
                suspendedUntil,
                isActive: true,
                createdAt: new Date().toISOString()
            });

            // Log admin action
            await fileStorage.insert('admin_action_logs', {
                adminId,
                actionType: 'user_suspend',
                targetUserId: userId,
                actionDetails: JSON.stringify({ reason, duration }),
                createdAt: new Date().toISOString()
            });

            return { success: true };
        } catch (error) {
            console.error('Suspend user error:', error);
            throw error;
        }
    },

    /**
     * Unsuspend user
     */
    unsuspendUser: async (userId, adminId) => {
        try {
            const user = await fileStorage.findOne('users', (u) => u.userId === userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Update user
            await fileStorage.update('users', userId, {
                ...user,
                isSuspended: false,
                unsuspendedAt: new Date().toISOString()
            });

            // Deactivate active suspensions
            const suspensions = await fileStorage.findMany('user_suspensions', (s) => 
                s.userId === userId && s.isActive
            );

            for (const suspension of suspensions) {
                await fileStorage.update('user_suspensions', suspension.suspensionId, {
                    ...suspension,
                    isActive: false,
                    unsuspendedAt: new Date().toISOString()
                });
            }

            // Log admin action
            await fileStorage.insert('admin_action_logs', {
                adminId,
                actionType: 'user_unsuspend',
                targetUserId: userId,
                actionDetails: JSON.stringify({}),
                createdAt: new Date().toISOString()
            });

            return { success: true };
        } catch (error) {
            console.error('Unsuspend user error:', error);
            throw error;
        }
    },

    /**
     * Get pending reports
     */
    getPendingReports: async (page = 1, limit = 20) => {
        try {
            let pendingReports = await fileStorage.findMany('user_reports', (r) => r.status === 'pending');

            // Get user info
            const users = await fileStorage.findMany('users', () => true);
            const userMap = {};
            users.forEach(u => { userMap[u.userId] = u; });

            // Enrich reports
            pendingReports = pendingReports.map(report => ({
                ...report,
                reporter_email: userMap[report.reporterId]?.email || 'Unknown',
                reported_user_email: userMap[report.reportedUserId]?.email || 'Unknown'
            }));

            // Sort by created date (newest first)
            pendingReports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            // Paginate
            const total = pendingReports.length;
            const offset = (page - 1) * limit;
            const reports = pendingReports.slice(offset, offset + limit);

            return {
                reports,
                pagination: {
                    page,
                    limit,
                    total,
                    total_pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            console.error('Get pending reports error:', error);
            throw error;
        }
    },

    /**
     * Resolve report
     */
    resolveReport: async (reportId, adminId, resolutionNotes) => {
        try {
            const report = await fileStorage.findOne('user_reports', (r) => r.reportId === reportId);
            if (!report) {
                throw new Error('Report not found');
            }

            // Update report
            await fileStorage.update('user_reports', reportId, {
                ...report,
                status: 'resolved',
                resolvedBy: adminId,
                resolvedAt: new Date().toISOString(),
                resolutionNotes
            });

            // Log admin action
            await fileStorage.insert('admin_action_logs', {
                adminId,
                actionType: 'report_resolve',
                targetUserId: report.reportedUserId,
                actionDetails: JSON.stringify({ reportId, resolutionNotes }),
                createdAt: new Date().toISOString()
            });

            return { success: true };
        } catch (error) {
            console.error('Resolve report error:', error);
            throw error;
        }
    },

    /**
     * Get admin dashboard statistics
     */
    getAdminStats: async () => {
        try {
            const users = await fileStorage.findMany('users', () => true);
            const kycDocuments = await fileStorage.findMany('kyc_documents', () => true);
            const reports = await fileStorage.findMany('user_reports', () => true);

            const totalUsers = users.length;
            const activeUsers = users.filter(u => u.isActive).length;
            const verifiedUsers = users.filter(u => u.isVerified).length;
            const suspendedUsers = users.filter(u => u.isSuspended).length;
            
            const pendingKyc = kycDocuments.filter(d => d.verificationStatus === 'pending').length;
            const approvedKyc = kycDocuments.filter(d => d.verificationStatus === 'approved').length;
            const rejectedKyc = kycDocuments.filter(d => d.verificationStatus === 'rejected').length;

            const pendingReports = reports.filter(r => r.status === 'pending').length;
            const resolvedReports = reports.filter(r => r.status === 'resolved').length;

            // New users in last 7 days
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const newUsers = users.filter(u => new Date(u.createdAt) >= sevenDaysAgo).length;

            return {
                users: {
                    total: totalUsers,
                    active: activeUsers,
                    verified: verifiedUsers,
                    suspended: suspendedUsers,
                    new_last_7_days: newUsers
                },
                kyc: {
                    pending: pendingKyc,
                    approved: approvedKyc,
                    rejected: rejectedKyc
                },
                reports: {
                    pending: pendingReports,
                    resolved: resolvedReports
                }
            };
        } catch (error) {
            console.error('Get admin stats error:', error);
            throw error;
        }
    },

    /**
     * Get admin action logs
     */
    getActionLogs: async (page = 1, limit = 50, filters = {}) => {
        try {
            let logs = await fileStorage.findMany('admin_action_logs', () => true);

            // Apply filters
            if (filters.admin_id) {
                logs = logs.filter(log => log.adminId === filters.admin_id);
            }

            if (filters.action_type) {
                logs = logs.filter(log => log.actionType === filters.action_type);
            }

            if (filters.target_user_id) {
                logs = logs.filter(log => log.targetUserId === filters.target_user_id);
            }

            // Get admin user info
            const adminUsers = await fileStorage.findMany('admin_users', () => true);
            const users = await fileStorage.findMany('users', () => true);
            const userMap = {};
            users.forEach(u => { userMap[u.userId] = u; });

            const adminMap = {};
            adminUsers.forEach(a => {
                adminMap[a.adminId] = userMap[a.userId];
            });

            // Enrich logs
            logs = logs.map(log => ({
                ...log,
                admin_email: adminMap[log.adminId]?.email || 'Unknown',
                target_user_email: userMap[log.targetUserId]?.email || 'Unknown'
            }));

            // Sort by created date (newest first)
            logs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            // Paginate
            const total = logs.length;
            const offset = (page - 1) * limit;
            const paginatedLogs = logs.slice(offset, offset + limit);

            return {
                logs: paginatedLogs,
                pagination: {
                    page,
                    limit,
                    total,
                    total_pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            console.error('Get action logs error:', error);
            throw error;
        }
    }
};

module.exports = admin;
