const db = require('../config/fileStorage');

// ============================================
// QUEUE NOTIFICATION
// ============================================
async function queueNotification(userId, type, title, message, data = {}) {
  try {
    await db.insert('notificationQueue', {
      user_id: userId,
      notification_type: type,
      title,
      message,
      data: JSON.stringify(data),
      status: 'pending',
      attempts: 0
    }, 'queue_id');
    return { success: true };
  } catch (error) {
    console.error('Queue notification error:', error);
    return { success: false };
  }
}

// ============================================
// CREATE IN-APP NOTIFICATION
// ============================================
async function createNotification(userId, type, title, message, relatedId = null, relatedType = null) {
  try {
    await db.insert('notifications', {
      user_id: userId,
      notification_type: type,
      title,
      message,
      related_id: relatedId,
      related_type: relatedType,
      is_read: false
    }, 'notification_id');
    return { success: true };
  } catch (error) {
    console.error('Create notification error:', error);
    return { success: false };
  }
}

// ============================================
// GET USER NOTIFICATIONS
// ============================================
async function getUserNotifications(userId, limit = 50) {
  try {
    const all = await db.getAll('notifications');
    const userNotifs = (all || []).filter(n => n.user_id === userId)
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .slice(0, limit);
    return userNotifs;
  } catch (error) {
    console.error('Get notifications error:', error);
    return [];
  }
}

// ============================================
// MARK AS READ
// ============================================
async function markAsRead(notificationId) {
  try {
    await db.update('notifications', { notification_id: parseInt(notificationId) }, { is_read: true });
    return { success: true };
  } catch (error) {
    console.error('Mark as read error:', error);
    return { success: false };
  }
}

// ============================================
// GET UNREAD COUNT
// ============================================
async function getUnreadCount(userId) {
  try {
    const all = await db.getAll('notifications');
    const unread = (all || []).filter(n => n.user_id === userId && !n.is_read);
    return unread.length;
  } catch (error) {
    console.error('Get unread count error:', error);
    return 0;
  }
}

// ============================================
// SEND REAL-TIME NOTIFICATION (via Socket.IO)
// ============================================
function sendRealTimeNotification(userId, notification) {
  try {
    const io = require('../config/socket').getIO();
    if (io) {
      io.to(`user_${userId}`).emit('notification', notification);
    }
  } catch (error) {
    console.error('Send real-time notification error:', error);
  }
}

// ============================================
// NOTIFICATION HELPERS
// ============================================
async function notifyNewMatch(userId, matchedUserId, matchedUserName) {
  const title = 'New Match!';
  const message = `You have a new match with ${matchedUserName}`;
  await createNotification(userId, 'new_match', title, message, matchedUserId, 'user');
  sendRealTimeNotification(userId, { type: 'new_match', title, message });
}

async function notifyNewMessage(userId, senderId, senderName) {
  const title = 'New Message';
  const message = `${senderName} sent you a message`;
  await createNotification(userId, 'new_message', title, message, senderId, 'user');
  sendRealTimeNotification(userId, { type: 'new_message', title, message });
}

async function notifyProfileView(userId, viewerId, viewerName) {
  const title = 'Profile View';
  const message = `${viewerName} viewed your profile`;
  await createNotification(userId, 'profile_view', title, message, viewerId, 'user');
}

async function notifyBadgeEarned(userId, badgeName) {
  const title = 'Badge Earned!';
  const message = `Congratulations! You earned the "${badgeName}" badge`;
  await createNotification(userId, 'badge_earned', title, message);
  sendRealTimeNotification(userId, { type: 'badge_earned', title, message, badge: badgeName });
}

module.exports = {
  queueNotification,
  createNotification,
  getUserNotifications,
  markAsRead,
  getUnreadCount,
  sendRealTimeNotification,
  notifyNewMatch,
  notifyNewMessage,
  notifyProfileView,
  notifyBadgeEarned
};
            if (prefs[channelKey] === false) {
                return { queued: false, reason: `${channel} disabled` };
            }

            // Get user contact info
            const user = await fileStorage.findOne('users', (u) => u.userId === userId);
            if (!user) {
                return { queued: false, reason: 'User not found' };
            }

            // Queue notification
            await fileStorage.insert('notification_queue', {
                userId,
                notificationType: type,
                notificationChannel: channel,
                recipientEmail: user.email,
                recipientPhone: user.phone || '',
                subject: data.subject || '',
                message: data.message || '',
                templateData: JSON.stringify(data.template_data || {}),
                status: 'pending',
                createdAt: new Date().toISOString()
            });

            return { queued: true };
        } catch (error) {
            console.error('Queue notification error:', error);
            throw error;
        }
    },

    /**
     * Process notification queue
     */
    processQueue: async (batchSize = 10) => {
        try {
            const pending = await fileStorage.findMany('notification_queue', (n) => n.status === 'pending');
            
            const batch = pending.slice(0, batchSize);
            let processed = 0;
            let failed = 0;

            for (const notification of batch) {
                try {
                    // For now, just mark as sent (actual email/SMS sending would go here)
                    await fileStorage.update('notification_queue', notification.queueId, {
                        ...notification,
                        status: 'sent',
                        sentAt: new Date().toISOString()
                    });

                    // Log to history
                    await fileStorage.insert('notification_history', {
                        userId: notification.userId,
                        notificationType: notification.notificationType,
                        notificationChannel: notification.notificationChannel,
                        subject: notification.subject,
                        message: notification.message,
                        status: 'delivered',
                        sentAt: new Date().toISOString()
                    });

                    processed++;
                } catch (error) {
                    console.error(`Failed to process notification ${notification.queueId}:`, error);
                    
                    await fileStorage.update('notification_queue', notification.queueId, {
                        ...notification,
                        status: 'failed',
                        errorMessage: error.message
                    });
                    
                    failed++;
                }
            }

            return {
                success: true,
                processed,
                failed,
                remaining: pending.length - batch.length
            };
        } catch (error) {
            console.error('Process queue error:', error);
            throw error;
        }
    }
};

module.exports = notifications;
