const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const db = require('../config/fileStorage');

// ============================================
// GET ALL CATEGORIES
// ============================================
router.get('/categories', async (req, res) => {
  try {
    const categories = await db.getAll('forumCategories');
    const posts = await db.getAll('forumPosts');

    const enriched = (categories || []).filter(c => c.is_active).map(cat => ({
      ...cat,
      post_count: posts.filter(p => p.category_id === cat.category_id).length
    })).sort((a, b) => a.display_order - b.display_order);

    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch categories' });
  }
});

// ============================================
// GET POSTS IN CATEGORY
// ============================================
router.get('/categories/:categoryId/posts', async (req, res) => {
  try {
    const categoryId = parseInt(req.params.categoryId);
    const sortBy = req.query.sort || 'latest';

    const allPosts = await db.getAll('forumPosts');
    let posts = (allPosts || []).filter(p => p.category_id === categoryId);

    const users = await db.getAll('users');
    const replies = await db.getAll('forumReplies');
    const likes = await db.getAll('forumPostLikes');

    const uMap = new Map(users.map(u => [u.user_id, u]));

    posts = posts.map(p => {
      const author = uMap.get(p.user_id) || {};
      const postReplies = replies.filter(r => r.post_id === p.post_id);
      const postLikes = likes.filter(l => l.post_id === p.post_id);
      return {
        ...p,
        author_name: author.full_name || (author.email ? author.email.split('@')[0] : ''),
        replies_count: postReplies.length,
        likes_count: postLikes.length
      };
    });

    // Sort
    if (sortBy === 'popular') {
      posts.sort((a, b) => b.likes_count - a.likes_count);
    } else {
      posts.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }

    res.json({ success: true, data: posts });
  } catch (error) {
    console.error('Get category posts error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch posts' });
  }
});

// ============================================
// GET SINGLE POST WITH REPLIES
// ============================================
router.get('/posts/:postId', async (req, res) => {
  try {
    const postId = parseInt(req.params.postId);
    const post = await db.findOne('forumPosts', { post_id: postId });
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    const users = await db.getAll('users');
    const replies = await db.getAll('forumReplies');
    const postLikes = await db.getAll('forumPostLikes');
    const replyLikes = await db.getAll('forumReplyLikes');

    const uMap = new Map(users.map(u => [u.user_id, u]));
    const author = uMap.get(post.user_id) || {};

    const postReplies = replies.filter(r => r.post_id === postId).map(r => {
      const rAuthor = uMap.get(r.user_id) || {};
      const rLikes = replyLikes.filter(l => l.reply_id === r.reply_id);
      return {
        ...r,
        author_name: rAuthor.full_name || (rAuthor.email ? rAuthor.email.split('@')[0] : ''),
        likes_count: rLikes.length
      };
    }).sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));

    const pLikes = postLikes.filter(l => l.post_id === postId);

    const enriched = {
      ...post,
      author_name: author.full_name || (author.email ? author.email.split('@')[0] : ''),
      likes_count: pLikes.length,
      replies_count: postReplies.length,
      replies: postReplies
    };

    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch post' });
  }
});

// ============================================
// CREATE POST
// ============================================
router.post('/posts', auth, async (req, res) => {
  try {
    const { category_id, title, content } = req.body;
    const userId = req.user.userId;

    if (!category_id || !title || !content) {
      return res.status(400).json({ success: false, message: 'Category, title, and content are required' });
    }

    const category = await db.findOne('forumCategories', { category_id: parseInt(category_id) });
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const created = await db.insert('forumPosts', {
      category_id: parseInt(category_id),
      user_id: userId,
      title: title.trim(),
      content: content.trim(),
      views_count: 0,
      is_pinned: false
    }, 'post_id');

    res.json({ success: true, message: 'Post created successfully', data: created });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ success: false, message: 'Failed to create post' });
  }
});

// ============================================
// UPDATE POST
// ============================================
router.put('/posts/:postId', auth, async (req, res) => {
  try {
    const postId = parseInt(req.params.postId);
    const userId = req.user.userId;
    const { title, content } = req.body;

    const post = await db.findOne('forumPosts', { post_id: postId });
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    if (post.user_id !== userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized to edit this post' });
    }

    const updates = {};
    if (title) updates.title = title.trim();
    if (content) updates.content = content.trim();

    await db.update('forumPosts', { post_id: postId }, updates);
    res.json({ success: true, message: 'Post updated successfully' });
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ success: false, message: 'Failed to update post' });
  }
});

// ============================================
// DELETE POST
// ============================================
router.delete('/posts/:postId', auth, async (req, res) => {
  try {
    const postId = parseInt(req.params.postId);
    const userId = req.user.userId;

    const post = await db.findOne('forumPosts', { post_id: postId });
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    if (post.user_id !== userId && req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized to delete this post' });
    }

    await db.delete('forumPosts', { post_id: postId });
    res.json({ success: true, message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete post' });
  }
});

// ============================================
// CREATE REPLY
// ============================================
router.post('/posts/:postId/replies', auth, async (req, res) => {
  try {
    const postId = parseInt(req.params.postId);
    const { content } = req.body;
    const userId = req.user.userId;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Reply content is required' });
    }

    const post = await db.findOne('forumPosts', { post_id: postId });
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    const created = await db.insert('forumReplies', {
      post_id: postId,
      user_id: userId,
      content: content.trim()
    }, 'reply_id');

    res.json({ success: true, message: 'Reply posted successfully', data: created });
  } catch (error) {
    console.error('Create reply error:', error);
    res.status(500).json({ success: false, message: 'Failed to post reply' });
  }
});

// ============================================
// LIKE POST
// ============================================
router.post('/posts/:postId/like', auth, async (req, res) => {
  try {
    const postId = parseInt(req.params.postId);
    const userId = req.user.userId;

    const existing = await db.findOne('forumPostLikes', { post_id: postId, user_id: userId });
    if (existing) {
      return res.json({ success: true, message: 'Already liked' });
    }

    await db.insert('forumPostLikes', { post_id: postId, user_id: userId }, 'like_id');
    res.json({ success: true, message: 'Post liked' });
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ success: false, message: 'Failed to like post' });
  }
});

// ============================================
// UNLIKE POST
// ============================================
router.delete('/posts/:postId/like', auth, async (req, res) => {
  try {
    const postId = parseInt(req.params.postId);
    const userId = req.user.userId;

    await db.delete('forumPostLikes', { post_id: postId, user_id: userId });
    res.json({ success: true, message: 'Post unliked' });
  } catch (error) {
    console.error('Unlike post error:', error);
    res.status(500).json({ success: false, message: 'Failed to unlike post' });
  }
});

// ============================================
// LIKE REPLY
// ============================================
router.post('/replies/:replyId/like', auth, async (req, res) => {
  try {
    const replyId = parseInt(req.params.replyId);
    const userId = req.user.userId;

    const existing = await db.findOne('forumReplyLikes', { reply_id: replyId, user_id: userId });
    if (existing) {
      return res.json({ success: true, message: 'Already liked' });
    }

    await db.insert('forumReplyLikes', { reply_id: replyId, user_id: userId }, 'like_id');
    res.json({ success: true, message: 'Reply liked' });
  } catch (error) {
    console.error('Like reply error:', error);
    res.status(500).json({ success: false, message: 'Failed to like reply' });
  }
});

// ============================================
// UNLIKE REPLY
// ============================================
router.delete('/replies/:replyId/like', auth, async (req, res) => {
  try {
    const replyId = parseInt(req.params.replyId);
    const userId = req.user.userId;

    await db.delete('forumReplyLikes', { reply_id: replyId, user_id: userId });
    res.json({ success: true, message: 'Reply unliked' });
  } catch (error) {
    console.error('Unlike reply error:', error);
    res.status(500).json({ success: false, message: 'Failed to unlike reply' });
  }
});

module.exports = router;
