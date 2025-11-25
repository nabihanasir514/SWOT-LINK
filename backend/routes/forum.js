const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const db = require('../config/fileStorage');

/**
 * Community Forum API Routes
 * Bulletin board system for discussions
 */

// ============================================
// FORUM CATEGORIES
// ============================================

/**
 * GET /api/forum/categories
 * Get all forum categories
 */
router.get('/categories', async (req, res) => {
    try {
        const categories = await forum.getCategories();

        res.json({
            success: true,
            categories
        });
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch categories'
        });
    }
});

/**
 * GET /api/forum/categories/:categoryId/posts
 * Get posts in a category
 */
router.get('/categories/:categoryId/posts', async (req, res) => {
    try {
        const categoryId = parseInt(req.params.categoryId);
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const sortBy = req.query.sort || 'latest'; // latest, popular, active

        const result = await forum.getCategoryPosts(categoryId, page, limit, sortBy);

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('Get category posts error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch posts'
        });
    }
});

// ============================================
// FORUM POSTS
// ============================================

/**
 * GET /api/forum/posts/:postId
 * Get post details with replies
 */
router.get('/posts/:postId', async (req, res) => {
    try {
        const postId = parseInt(req.params.postId);
        const userId = req.headers.authorization ? req.user?.userId : null;

        const postData = await forum.getPost(postId, userId);

        if (!postData) {
            return res.status(404).json({
                success: false,
                message: 'Post not found'
            });
        }

        res.json({
            success: true,
            ...postData
        });
    } catch (error) {
        console.error('Get post error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch post'
        });
    }
});

/**
 * POST /api/forum/posts
 * Create new post
 */
router.post('/posts', auth, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { category_id, title, content } = req.body;

        if (!category_id || !title || !content) {
            return res.status(400).json({
                success: false,
                message: 'Category, title, and content are required'
            });
        }

        if (title.length < 5 || title.length > 255) {
            return res.status(400).json({
                success: false,
                message: 'Title must be between 5 and 255 characters'
            });
        }

        if (content.length < 10) {
            return res.status(400).json({
                success: false,
                message: 'Content must be at least 10 characters'
            });
        }

        const result = await forum.createPost(userId, category_id, title, content);

        res.json({
            success: true,
            message: 'Post created successfully',
            post_id: result.post_id
        });
    } catch (error) {
        console.error('Create post error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create post'
        });
    }
});

/**
 * PUT /api/forum/posts/:postId
 * Update post
 */
router.put('/posts/:postId', auth, async (req, res) => {
    try {
        const postId = parseInt(req.params.postId);
        const userId = req.user.userId;
        const { title, content } = req.body;

        const result = await forum.updatePost(postId, userId, { title, content });

        if (!result.success) {
            return res.status(403).json(result);
        }

        res.json({
            success: true,
            message: 'Post updated successfully'
        });
    } catch (error) {
        console.error('Update post error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update post'
        });
    }
});

/**
 * DELETE /api/forum/posts/:postId
 * Delete post
 */
router.delete('/posts/:postId', auth, async (req, res) => {
    try {
        const postId = parseInt(req.params.postId);
        const userId = req.user.userId;

        const result = await forum.deletePost(postId, userId);

        if (!result.success) {
            return res.status(403).json(result);
        }

        res.json({
            success: true,
            message: 'Post deleted successfully'
        });
    } catch (error) {
        console.error('Delete post error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete post'
        });
    }
});

/**
 * POST /api/forum/posts/:postId/like
 * Like/Unlike post
 */
router.post('/posts/:postId/like', auth, async (req, res) => {
    try {
        const postId = parseInt(req.params.postId);
        const userId = req.user.userId;

        const result = await forum.togglePostLike(postId, userId);

        res.json({
            success: true,
            liked: result.liked
        });
    } catch (error) {
        console.error('Toggle post like error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to toggle like'
        });
    }
});

// ============================================
// FORUM REPLIES
// ============================================

/**
 * POST /api/forum/posts/:postId/replies
 * Create reply to post
 */
router.post('/posts/:postId/replies', auth, async (req, res) => {
    try {
        const postId = parseInt(req.params.postId);
        const userId = req.user.userId;
        const { content, parent_reply_id } = req.body;

        if (!content || content.length < 5) {
            return res.status(400).json({
                success: false,
                message: 'Reply must be at least 5 characters'
            });
        }

        const result = await forum.createReply(postId, userId, content, parent_reply_id);

        res.json({
            success: true,
            message: 'Reply posted successfully',
            reply_id: result.reply_id
        });
    } catch (error) {
        console.error('Create reply error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to post reply'
        });
    }
});

/**
 * PUT /api/forum/replies/:replyId
 * Update reply
 */
router.put('/replies/:replyId', auth, async (req, res) => {
    try {
        const replyId = parseInt(req.params.replyId);
        const userId = req.user.userId;
        const { content } = req.body;

        if (!content || content.length < 5) {
            return res.status(400).json({
                success: false,
                message: 'Reply must be at least 5 characters'
            });
        }

        const result = await forum.updateReply(replyId, userId, content);

        if (!result.success) {
            return res.status(403).json(result);
        }

        res.json({
            success: true,
            message: 'Reply updated successfully'
        });
    } catch (error) {
        console.error('Update reply error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update reply'
        });
    }
});

/**
 * DELETE /api/forum/replies/:replyId
 * Delete reply
 */
router.delete('/replies/:replyId', auth, async (req, res) => {
    try {
        const replyId = parseInt(req.params.replyId);
        const userId = req.user.userId;

        const result = await forum.deleteReply(replyId, userId);

        if (!result.success) {
            return res.status(403).json(result);
        }

        res.json({
            success: true,
            message: 'Reply deleted successfully'
        });
    } catch (error) {
        console.error('Delete reply error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete reply'
        });
    }
});

/**
 * POST /api/forum/replies/:replyId/like
 * Like/Unlike reply
 */
router.post('/replies/:replyId/like', auth, async (req, res) => {
    try {
        const replyId = parseInt(req.params.replyId);
        const userId = req.user.userId;

        const result = await forum.toggleReplyLike(replyId, userId);

        res.json({
            success: true,
            liked: result.liked
        });
    } catch (error) {
        console.error('Toggle reply like error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to toggle like'
        });
    }
});

/**
 * POST /api/forum/replies/:replyId/mark-solution
 * Mark reply as solution (post author only)
 */
router.post('/replies/:replyId/mark-solution', auth, async (req, res) => {
    try {
        const replyId = parseInt(req.params.replyId);
        const userId = req.user.userId;
        const { post_id } = req.body;

        if (!post_id) {
            return res.status(400).json({
                success: false,
                message: 'Post ID is required'
            });
        }

        const result = await forum.markAsSolution(replyId, post_id, userId);

        if (!result.success) {
            return res.status(403).json(result);
        }

        res.json({
            success: true,
            message: 'Reply marked as solution'
        });
    } catch (error) {
        console.error('Mark solution error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark as solution'
        });
    }
});

// ============================================
// SEARCH & DISCOVERY
// ============================================

/**
 * GET /api/forum/search
 * Search posts
 */
router.get('/search', async (req, res) => {
    try {
        const query = req.query.q;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        if (!query || query.length < 3) {
            return res.status(400).json({
                success: false,
                message: 'Search query must be at least 3 characters'
            });
        }

        const result = await forum.searchPosts(query, page, limit);

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('Search posts error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to search posts'
        });
    }
});

/**
 * GET /api/forum/recent
 * Get recent activity
 */
router.get('/recent', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const posts = await forum.getRecentActivity(limit);

        res.json({
            success: true,
            posts
        });
    } catch (error) {
        console.error('Get recent activity error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch recent activity'
        });
    }
});

/**
 * GET /api/forum/users/:userId/posts
 * Get user's posts
 */
router.get('/users/:userId/posts', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const result = await forum.getUserPosts(userId, page, limit);

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('Get user posts error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user posts'
        });
    }
});

// ============================================
// REPORTING & MODERATION
// ============================================

/**
 * POST /api/forum/report
 * Report content for moderation
 */
router.post('/report', auth, async (req, res) => {
    try {
        const reporterId = req.user.userId;
        const { content_type, content_id, reason, description } = req.body;

        if (!content_type || !content_id || !reason) {
            return res.status(400).json({
                success: false,
                message: 'Content type, ID, and reason are required'
            });
        }

        const result = await forum.reportContent(reporterId, content_type, content_id, reason, description);

        res.json({
            success: true,
            message: 'Content reported. Thank you for helping keep our community safe.'
        });
    } catch (error) {
        console.error('Report content error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to report content'
        });
    }
});

/**
 * PUT /api/forum/moderate/post/:postId
 * Moderate post (admin only)
 */
router.put('/moderate/post/:postId', auth, adminAuth, async (req, res) => {
    try {
        const postId = parseInt(req.params.postId);
        const adminId = req.admin.adminId;
        const { action, reason } = req.body; // action: 'hide', 'delete', 'pin', 'lock'

        const fileStorage = require('../config/fileStorage');

        const post = await fileStorage.findOne('forum_posts', (p) => p.postId === postId);
        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'Post not found'
            });
        }

        if (action === 'hide' || action === 'delete') {
            await fileStorage.update('forum_posts', postId, {
                ...post,
                status: action === 'hide' ? 'hidden' : 'deleted',
                moderatedBy: adminId,
                moderationReason: reason,
                moderatedAt: new Date().toISOString()
            });
        } else if (action === 'pin') {
            await fileStorage.update('forum_posts', postId, {
                ...post,
                isPinned: !post.isPinned
            });
        } else if (action === 'lock') {
            await fileStorage.update('forum_posts', postId, {
                ...post,
                isLocked: !post.isLocked
            });
        }

        // Log action
        await fileStorage.insert('admin_action_logs', {
            adminId,
            actionType: 'post_moderate',
            targetType: 'post',
            targetId: postId,
            actionDetails: JSON.stringify({ action, reason }),
            createdAt: new Date().toISOString()
        });

        res.json({
            success: true,
            message: 'Post moderated successfully'
        });
    } catch (error) {
        console.error('Moderate post error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to moderate post'
        });
    }
});

/**
 * PUT /api/forum/moderate/reply/:replyId
 * Moderate reply (admin only)
 */
router.put('/moderate/reply/:replyId', auth, adminAuth, async (req, res) => {
    try {
        const replyId = parseInt(req.params.replyId);
        const adminId = req.admin.adminId;
        const { action, reason } = req.body; // action: 'hide', 'delete'

        const fileStorage = require('../config/fileStorage');

        const reply = await fileStorage.findOne('forum_replies', (r) => r.replyId === replyId);
        if (!reply) {
            return res.status(404).json({
                success: false,
                message: 'Reply not found'
            });
        }

        await fileStorage.update('forum_replies', replyId, {
            ...reply,
            status: action === 'hide' ? 'hidden' : 'deleted',
            moderatedBy: adminId,
            moderationReason: reason,
            moderatedAt: new Date().toISOString()
        });

        // Log action
        await fileStorage.insert('admin_action_logs', {
            adminId,
            actionType: 'reply_moderate',
            targetType: 'reply',
            targetId: replyId,
            actionDetails: JSON.stringify({ action, reason }),
            createdAt: new Date().toISOString()
        });

        res.json({
            success: true,
            message: 'Reply moderated successfully'
        });
    } catch (error) {
        console.error('Moderate reply error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to moderate reply'
        });
    }
});

module.exports = router;
