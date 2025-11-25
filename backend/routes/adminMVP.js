const express = require('express');
const router = express.Router();
const db = require('../config/fileStorage');
const auth = require('../middleware/auth');

// Simple admin check middleware (for MVP, check if user is admin role)
function requireAdmin(req, res, next) {
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
}

// ============================================
// ADMIN DASHBOARD STATS
// ============================================
router.get('/stats', auth, requireAdmin, async (req, res) => {
  try {
    const users = await db.getAll('users');
    const startups = await db.getAll('startupProfiles');
    const investors = await db.getAll('investorProfiles');
    const videos = await db.getAll('pitchVideos');
    const messages = await db.getAll('messages');
    const verifications = await db.getAll('userVerifications');

    const stats = {
      total_users: users.length,
      total_startups: startups.length,
      total_investors: investors.length,
      total_videos: videos.length,
      total_messages: messages.length,
      pending_verifications: verifications.filter(v => v.status === 'pending').length,
      verified_users: verifications.filter(v => v.status === 'approved').length,
      active_users_7d: users.filter(u => {
        const last = new Date(u.last_login || 0);
        const sevenDays = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return last > sevenDays;
      }).length
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch admin stats' });
  }
});

// ============================================
// USER MANAGEMENT
// ============================================
router.get('/users', auth, requireAdmin, async (req, res) => {
  try {
    const { role, search, is_verified, is_suspended } = req.query;
    let users = await db.getAll('users');

    // Filters
    if (role) users = users.filter(u => u.role === role);
    if (is_verified === 'true') users = users.filter(u => u.is_verified === true || u.is_verified === 1);
    if (is_verified === 'false') users = users.filter(u => !u.is_verified);
    if (is_suspended === 'true') users = users.filter(u => u.is_suspended === true || u.is_suspended === 1);
    if (is_suspended === 'false') users = users.filter(u => !u.is_suspended);
    if (search) {
      const s = search.toLowerCase();
      users = users.filter(u => 
        (u.full_name || '').toLowerCase().includes(s) || 
        (u.email || '').toLowerCase().includes(s)
      );
    }

    // Enrich with profile info
    const sp = await db.getAll('startupProfiles');
    const ip = await db.getAll('investorProfiles');
    const spMap = new Map(sp.map(p => [p.user_id, p]));
    const ipMap = new Map(ip.map(p => [p.user_id, p]));

    const enriched = users.map(u => ({
      ...u,
      display_name: spMap.get(u.user_id)?.company_name || ipMap.get(u.user_id)?.investor_name || ''
    }));

    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
});

router.get('/users/:userId', auth, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const user = await db.findOne('users', { user_id: userId });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const sp = await db.findOne('startupProfiles', { user_id: userId });
    const ip = await db.findOne('investorProfiles', { user_id: userId });
    const messages = await db.getAll('messages');
    const userMessages = messages.filter(m => m.sender_id === userId || m.receiver_id === userId);

    const details = {
      ...user,
      profile: sp || ip || null,
      messages_count: userMessages.length
    };

    res.json({ success: true, data: details });
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user details' });
  }
});

router.put('/users/:userId/suspend', auth, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { reason } = req.body;
    const adminId = req.user.userId;

    await db.update('users', { user_id: userId }, { is_suspended: true });
    await db.insert('userSuspensions', {
      user_id: userId,
      suspended_by: adminId,
      reason: reason || 'No reason provided',
      suspended_at: new Date().toISOString()
    }, 'suspension_id');

    res.json({ success: true, message: 'User suspended' });
  } catch (error) {
    console.error('Suspend user error:', error);
    res.status(500).json({ success: false, message: 'Failed to suspend user' });
  }
});

router.put('/users/:userId/unsuspend', auth, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    await db.update('users', { user_id: userId }, { is_suspended: false });
    res.json({ success: true, message: 'User unsuspended' });
  } catch (error) {
    console.error('Unsuspend user error:', error);
    res.status(500).json({ success: false, message: 'Failed to unsuspend user' });
  }
});

// ============================================
// KYC VERIFICATION
// ============================================
router.get('/kyc-requests', auth, requireAdmin, async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const verifications = await db.getAll('userVerifications');
    let list = verifications.filter(v => v.status === status);

    const users = await db.getAll('users');
    const uMap = new Map(users.map(u => [u.user_id, u]));

    list = list.map(v => {
      const u = uMap.get(v.user_id) || {};
      return {
        ...v,
        username: u.full_name || (u.email ? u.email.split('@')[0] : ''),
        email: u.email
      };
    }).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    res.json({ success: true, data: list });
  } catch (error) {
    console.error('Get KYC requests error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch KYC requests' });
  }
});

router.put('/kyc/:verificationId/approve', auth, requireAdmin, async (req, res) => {
  try {
    const verificationId = parseInt(req.params.verificationId);
    const adminId = req.user.userId;

    const verification = await db.findOne('userVerifications', { verification_id: verificationId });
    if (!verification) {
      return res.status(404).json({ success: false, message: 'Verification request not found' });
    }

    await db.update('userVerifications', { verification_id: verificationId }, {
      status: 'approved',
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString()
    });

    await db.update('users', { user_id: verification.user_id }, { is_verified: true });

    res.json({ success: true, message: 'KYC request approved' });
  } catch (error) {
    console.error('Approve KYC error:', error);
    res.status(500).json({ success: false, message: 'Failed to approve KYC' });
  }
});

router.put('/kyc/:verificationId/reject', auth, requireAdmin, async (req, res) => {
  try {
    const verificationId = parseInt(req.params.verificationId);
    const { reason } = req.body;
    const adminId = req.user.userId;

    await db.update('userVerifications', { verification_id: verificationId }, {
      status: 'rejected',
      rejection_reason: reason || 'No reason provided',
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString()
    });

    res.json({ success: true, message: 'KYC request rejected' });
  } catch (error) {
    console.error('Reject KYC error:', error);
    res.status(500).json({ success: false, message: 'Failed to reject KYC' });
  }
});

// ============================================
// REPORTS & MODERATION
// ============================================
router.get('/reports', auth, requireAdmin, async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const reports = await db.getAll('userReports');
    let list = reports.filter(r => r.status === status);

    const users = await db.getAll('users');
    const uMap = new Map(users.map(u => [u.user_id, u]));

    list = list.map(r => {
      const reporter = uMap.get(r.reporter_id) || {};
      const reported = uMap.get(r.reported_user_id) || {};
      return {
        ...r,
        reporter_name: reporter.full_name || reporter.email,
        reported_user_name: reported.full_name || reported.email
      };
    }).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    res.json({ success: true, data: list });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch reports' });
  }
});

router.put('/reports/:reportId/resolve', auth, requireAdmin, async (req, res) => {
  try {
    const reportId = parseInt(req.params.reportId);
    const { action, notes } = req.body;
    const adminId = req.user.userId;

    await db.update('userReports', { report_id: reportId }, {
      status: 'resolved',
      action_taken: action || 'No action',
      admin_notes: notes || '',
      resolved_by: adminId,
      resolved_at: new Date().toISOString()
    });

    res.json({ success: true, message: 'Report resolved' });
  } catch (error) {
    console.error('Resolve report error:', error);
    res.status(500).json({ success: false, message: 'Failed to resolve report' });
  }
});

module.exports = router;
