const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const db = require('../config/fileStorage');

// ============================================
// PLATFORM-WIDE ANALYTICS (Admin/Overview)
// ============================================
router.get('/platform-stats', auth, async (req, res) => {
  try {
    const users = await db.getAll('users');
    const startups = await db.getAll('startupProfiles');
    const investors = await db.getAll('investorProfiles');
    const videos = await db.getAll('pitchVideos');
    const messages = await db.getAll('messages');
    const matches = await db.getAll('savedMatches');

    const stats = {
      total_users: users.length,
      total_startups: startups.length,
      total_investors: investors.length,
      total_pitch_videos: videos.length,
      total_messages_sent: messages.length,
      total_saved_matches: matches.length,
      active_users_7d: users.filter(u => {
        const lastLogin = new Date(u.last_login || 0);
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return lastLogin > sevenDaysAgo;
      }).length
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Platform stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch platform stats' });
  }
});

// ============================================
// USER ENGAGEMENT METRICS
// ============================================
router.get('/user-engagement/:userId', auth, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const messages = await db.getAll('messages');
    const views = await db.getAll('profileViews');
    const matches = await db.getAll('savedMatches');

    const userMessages = messages.filter(m => m.sender_id === userId || m.receiver_id === userId);
    const userViews = views.filter(v => v.viewer_id === userId);
    const userMatches = matches.filter(m => m.user_id === userId);

    const engagement = {
      messages_sent: messages.filter(m => m.sender_id === userId).length,
      messages_received: messages.filter(m => m.receiver_id === userId).length,
      profile_views_given: userViews.length,
      matches_saved: userMatches.length
    };

    res.json({ success: true, data: engagement });
  } catch (error) {
    console.error('User engagement error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user engagement' });
  }
});

// ============================================
// MATCH SUCCESS RATES
// ============================================
router.get('/match-success', auth, async (req, res) => {
  try {
    const matches = await db.getAll('savedMatches');
    const conversations = await db.getAll('conversations');

    // Calculate matches that led to conversations
    const convUserPairs = new Set();
    conversations.forEach(c => {
      const pair = [c.user1_id, c.user2_id].sort().join('-');
      convUserPairs.add(pair);
    });

    let matchesWithConversations = 0;
    matches.forEach(m => {
      const pair = [m.user_id, m.matched_user_id].sort().join('-');
      if (convUserPairs.has(pair)) matchesWithConversations++;
    });

    const successRate = matches.length > 0 ? (matchesWithConversations / matches.length * 100).toFixed(2) : 0;

    res.json({
      success: true,
      data: {
        total_matches: matches.length,
        matches_with_conversations: matchesWithConversations,
        success_rate_percent: parseFloat(successRate)
      }
    });
  } catch (error) {
    console.error('Match success error:', error);
    res.status(500).json({ success: false, message: 'Failed to calculate match success' });
  }
});

// ============================================
// VIDEO PERFORMANCE
// ============================================
router.get('/video-performance', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const role = req.user.role;

    if (role !== 'Startup') {
      return res.status(403).json({ success: false, message: 'Startups only' });
    }

    const videos = await db.getAll('pitchVideos');
    const comments = await db.getAll('videoComments');

    const userVideos = videos.filter(v => v.user_id === userId);

    const performance = userVideos.map(v => {
      const videoComments = comments.filter(c => c.video_id === v.video_id);
      return {
        video_id: v.video_id,
        title: v.title,
        views: v.views_count || 0,
        comments: videoComments.length,
        created_at: v.created_at
      };
    }).sort((a, b) => b.views - a.views);

    const totalViews = performance.reduce((sum, v) => sum + v.views, 0);
    const totalComments = performance.reduce((sum, v) => sum + v.comments, 0);

    res.json({
      success: true,
      data: {
        total_videos: userVideos.length,
        total_views: totalViews,
        total_comments: totalComments,
        videos: performance
      }
    });
  } catch (error) {
    console.error('Video performance error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch video performance' });
  }
});

// ============================================
// MESSAGING ACTIVITY
// ============================================
router.get('/messaging-activity', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const messages = await db.getAll('messages');

    const sent = messages.filter(m => m.sender_id === userId);
    const received = messages.filter(m => m.receiver_id === userId);

    // Group by day (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const timeline = {};

    sent.concat(received).forEach(m => {
      const msgDate = new Date(m.created_at);
      if (msgDate > thirtyDaysAgo) {
        const day = msgDate.toISOString().split('T')[0];
        timeline[day] = (timeline[day] || 0) + 1;
      }
    });

    const timelineArray = Object.keys(timeline).sort().map(day => ({
      date: day,
      count: timeline[day]
    }));

    res.json({
      success: true,
      data: {
        messages_sent: sent.length,
        messages_received: received.length,
        timeline: timelineArray
      }
    });
  } catch (error) {
    console.error('Messaging activity error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch messaging activity' });
  }
});

// ============================================
// GAMIFICATION
// ============================================
router.get('/gamification', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const gamification = require('../utils/gamification');
    const summary = await gamification.getGamificationSummary(userId);
    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Gamification error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch gamification data' });
  }
});

router.get('/leaderboard', auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const gamification = require('../utils/gamification');
    const leaderboard = await gamification.getLeaderboard(limit);
    res.json({ success: true, data: leaderboard });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch leaderboard' });
  }
});

router.post('/check-badges', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const gamification = require('../utils/gamification');
    const result = await gamification.checkAndAwardBadges(userId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Check badges error:', error);
    res.status(500).json({ success: false, message: 'Failed to check badges' });
  }
});

// ============================================
// NOTIFICATIONS
// ============================================
router.get('/notifications', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const notifications = require('../utils/notifications');
    const data = await notifications.getUserNotifications(userId, 50);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
});

router.put('/notifications/:notificationId/read', auth, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const notifications = require('../utils/notifications');
    await notifications.markAsRead(notificationId);
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark notification as read' });
  }
});

router.get('/notifications/unread-count', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const notifications = require('../utils/notifications');
    const count = await notifications.getUnreadCount(userId);
    res.json({ success: true, data: { unread_count: count } });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch unread count' });
  }
});

module.exports = router;
