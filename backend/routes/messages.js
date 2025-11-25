const express = require('express');
const router = express.Router();
const db = require('../config/fileStorage');
const auth = require('../middleware/auth');

// ============================================
// GET ALL CONVERSATIONS
// ============================================
router.get('/conversations', auth, async (req, res) => {
  try {
    const userId = req.user.userId;

    const allConvs = await db.getAll('conversations');
    let conversations = (allConvs || []).filter(conv => conv.user1_id === userId || conv.user2_id === userId);

    const users = await db.getAll('users');
    const userMap = new Map(users.map(u => [u.user_id, u]));

    const messages = await db.getAll('messages');
    const messageMap = new Map(messages.map(m => [m.message_id, m]));

    const startupProfiles = await db.getAll('startupProfiles');
    const investorProfiles = await db.getAll('investorProfiles');
    const spMap = new Map(startupProfiles.map(p => [p.user_id, p]));
    const ipMap = new Map(investorProfiles.map(p => [p.user_id, p]));

    conversations = conversations.map(conv => {
      const otherUserId = conv.user1_id === userId ? conv.user2_id : conv.user1_id;
      const otherUser = userMap.get(otherUserId) || {};
      const lastMessage = conv.last_message_id ? messageMap.get(conv.last_message_id) : null;
      const sp = spMap.get(otherUserId);
      const ip = ipMap.get(otherUserId);

      return {
        ...conv,
        last_message: lastMessage?.message_text || null,
        other_username: otherUser.full_name || (otherUser.email ? otherUser.email.split('@')[0] : ''),
        other_user_id: otherUserId,
        other_role: otherUser.role || '',
        other_display_name: sp?.company_name || ip?.investor_name || '',
        unread_count: conv.user1_id === userId ? (conv.user1_unread_count || 0) : (conv.user2_unread_count || 0)
      };
    }).sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));

    res.json({ success: true, data: conversations });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch conversations' });
  }
});

// ============================================
// GET MESSAGES WITH USER
// ============================================
router.get('/messages/:otherUserId', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { otherUserId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const otherUserIdInt = parseInt(otherUserId);

    const allMessages = await db.getAll('messages');
    let messages = (allMessages || []).filter(msg =>
      (msg.sender_id === userId && msg.receiver_id === otherUserIdInt) ||
      (msg.sender_id === otherUserIdInt && msg.receiver_id === userId)
    );

    // Enrich with user info
    const users = await db.getAll('users');
    const spList = await db.getAll('startupProfiles');
    const ipList = await db.getAll('investorProfiles');
    const uMap = new Map(users.map(u => [u.user_id, u]));
    const spMap = new Map(spList.map(p => [p.user_id, p]));
    const ipMap = new Map(ipList.map(p => [p.user_id, p]));

    messages = messages.map(msg => {
      const u = uMap.get(msg.sender_id) || {};
      return {
        ...msg,
        username: u.full_name || (u.email ? u.email.split('@')[0] : ''),
        role: u.role || '',
        display_name: (spMap.get(msg.sender_id)?.company_name) || (ipMap.get(msg.sender_id)?.investor_name) || ''
      };
    });

    // Sort by created_at descending
    messages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Apply pagination
    const paginatedMessages = messages.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    // Mark messages as read
    for (const msg of messages) {
      if (msg.receiver_id === userId && msg.sender_id === otherUserIdInt && !msg.is_read) {
        await db.update('messages', { message_id: msg.message_id }, { is_read: true, read_at: new Date().toISOString() });
      }
    }

    // Update conversation unread count
    const user1 = Math.min(userId, otherUserIdInt);
    const user2 = Math.max(userId, otherUserIdInt);
    
    const conversation = await db.findOne('conversations', {
      user1_id: user1,
      user2_id: user2
    });

    if (conversation) {
      if (userId === user1) {
        await db.update('conversations',
          { conversation_id: conversation.conversation_id },
          { user1_unread_count: 0 }
        );
      } else {
        await db.update('conversations',
          { conversation_id: conversation.conversation_id },
          { user2_unread_count: 0 }
        );
      }
    }

    // Get other user info
    const otherUser = await db.findOne('users', { user_id: otherUserIdInt });
    const startupProfile = await db.findOne('startupProfiles', { user_id: otherUserIdInt });
    const investorProfile = await db.findOne('investorProfiles', { user_id: otherUserIdInt });

    res.json({
      success: true,
      data: {
        messages: paginatedMessages.reverse(), // Reverse to show oldest first
        otherUser: otherUser ? {
          user_id: otherUser.user_id,
          username: otherUser.full_name || (otherUser.email ? otherUser.email.split('@')[0] : ''),
          role: otherUser.role,
          display_name: startupProfile?.company_name || investorProfile?.investor_name || ''
        } : null
      }
    });

  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages'
    });
  }
});

// ============================================
// SEND MESSAGE
// ============================================
router.post('/send', auth, async (req, res) => {
  try {
    const { receiverId, messageText } = req.body;
    const senderId = req.user.userId;

    if (!receiverId || !messageText || messageText.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Receiver ID and message text are required'
      });
    }

    // Verify receiver exists
    const receiver = await db.findOne('users', { user_id: parseInt(receiverId) });

    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: 'Receiver not found'
      });
    }

    // Insert message
    const newMessage = await db.insert('messages', {
      sender_id: senderId,
      receiver_id: parseInt(receiverId),
      message_text: messageText,
      is_read: false,
      created_at: new Date().toISOString()
    }, 'message_id');

    // Update or create conversation
    const user1 = Math.min(senderId, parseInt(receiverId));
    const user2 = Math.max(senderId, parseInt(receiverId));

    let conversation = await db.findOne('conversations', {
      user1_id: user1,
      user2_id: user2
    });

    if (conversation) {
      // Update existing conversation
      const updates = {
        last_message_id: newMessage.message_id,
        last_message_at: newMessage.created_at
      };
      
      // Increment unread count for receiver
      if (parseInt(receiverId) === user1) {
        updates.user1_unread_count = (conversation.user1_unread_count || 0) + 1;
      } else {
        updates.user2_unread_count = (conversation.user2_unread_count || 0) + 1;
      }

      await db.update('conversations',
        { conversation_id: conversation.conversation_id },
        updates
      );
    } else {
      // Create new conversation
      await db.insert('conversations', {
        user1_id: user1,
        user2_id: user2,
        last_message_id: newMessage.message_id,
        last_message_at: newMessage.created_at,
        user1_unread_count: parseInt(receiverId) === user1 ? 1 : 0,
        user2_unread_count: parseInt(receiverId) === user2 ? 1 : 0,
        created_at: new Date().toISOString()
      }, 'conversation_id');
    }

    // Enrich message with user info
    const user = await db.findOne('users', { user_id: senderId });
    const startupProfile = await db.findOne('startupProfiles', { user_id: senderId });
    const investorProfile = await db.findOne('investorProfiles', { user_id: senderId });

    const enrichedMessage = {
      ...newMessage,
      username: user?.full_name || (user?.email ? user.email.split('@')[0] : ''),
      role: user?.role || '',
      display_name: startupProfile?.company_name || investorProfile?.investor_name || ''
    };

    res.json({
      success: true,
      message: 'Message sent successfully',
      data: enrichedMessage
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
});

// ============================================
// MARK MESSAGE AS READ
// ============================================
router.put('/mark-read/:messageId', auth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.userId;

    await db.update('messages', { message_id: parseInt(messageId), receiver_id: userId }, {
      is_read: true,
      read_at: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Message marked as read'
    });

  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark message as read'
    });
  }
});

// ============================================
// DELETE MESSAGE (Sender only)
// ============================================
router.delete('/message/:messageId', auth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.userId;

    // Verify ownership
    const message = await db.findOne('messages', { message_id: parseInt(messageId) });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    if (message.sender_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to delete this message'
      });
    }

    await db.delete('messages', { message_id: parseInt(messageId) });

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });

  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete message'
    });
  }
});

// ============================================
// GET UNREAD COUNT
// ============================================
router.get('/unread-count', auth, async (req, res) => {
  try {
    const userId = req.user.userId;

    const allMessages = await db.getAll('messages');
    const unreadMessages = (allMessages || []).filter(msg => msg.receiver_id === userId && !msg.is_read);

    res.json({
      success: true,
      data: {
        unreadCount: unreadMessages.length
      }
    });

  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unread count'
    });
  }
});

// ============================================
// SEARCH USERS TO MESSAGE
// ============================================
router.get('/search-users', auth, async (req, res) => {
  try {
    const { query } = req.query;
    const userId = req.user.userId;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const searchLower = query.toLowerCase();

    // Get all users except current user
    const allUsers = await db.getAll('users');
    const sp = await db.getAll('startupProfiles');
    const ip = await db.getAll('investorProfiles');
    const spMap = new Map(sp.map(p => [p.user_id, p]));
    const ipMap = new Map(ip.map(p => [p.user_id, p]));

    let users = (allUsers || []).filter(u => u.user_id !== userId).map(user => {
      const startupProfile = spMap.get(user.user_id);
      const investorProfile = ipMap.get(user.user_id);

      const uname = user.full_name || (user.email ? user.email.split('@')[0] : '');
      const company = startupProfile?.company_name || '';
      const invName = investorProfile?.investor_name || '';
      const match = (uname.toLowerCase().includes(searchLower)) ||
                    (company.toLowerCase().includes(searchLower)) ||
                    (invName.toLowerCase().includes(searchLower));

      return {
        user_id: user.user_id,
        username: uname,
        role: user.role,
        display_name: company || invName || '',
        _match: match
      };
    }).filter(u => u._match);

    // Remove _match field and limit results
    users = users.map(({ _match, ...user }) => user).slice(0, 20);

    res.json({
      success: true,
      data: users
    });

  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search users'
    });
  }
});

module.exports = router;
