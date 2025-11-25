const fileStorage = require('../config/fileStorage');

/**
 * Forum/Community Utility Functions (File Storage Version)
 * Bulletin board system for community discussions
 */

const forum = {
    /**
     * Get all categories with post counts
     */
    getCategories: async () => {
        try {
            const categories = await fileStorage.findMany('forum_categories', (c) => c.isActive === true || c.isActive === 1);
            const posts = await fileStorage.findMany('forum_posts', (p) => p.status === 'active');

            // Enrich categories with post counts and last post info
            const enrichedCategories = categories.map(category => {
                const categoryPosts = posts.filter(p => p.categoryId === category.categoryId);
                const lastPost = categoryPosts.length > 0 
                    ? posts.find(p => p.postId === category.lastPostId)
                    : null;

                return {
                    ...category,
                    active_post_count: categoryPosts.length,
                    last_post_title: lastPost?.title || null,
                    last_post_date: lastPost?.createdAt || null
                };
            });

            // Sort by display order
            enrichedCategories.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

            return enrichedCategories;
        } catch (error) {
            console.error('Get categories error:', error);
            throw error;
        }
    },

    /**
     * Get posts in a category
     */
    getCategoryPosts: async (categoryId, page = 1, limit = 20, sortBy = 'latest') => {
        try {
            // Get all active posts in category
            let posts = await fileStorage.findMany('forum_posts', (p) => 
                p.categoryId === categoryId && p.status === 'active'
            );

            // Get user info
            const users = await fileStorage.findMany('users', () => true);
            const startupProfiles = await fileStorage.findMany('startup_profiles', () => true);
            const investorProfiles = await fileStorage.findMany('investor_profiles', () => true);

            // Create lookup maps
            const userMap = {};
            users.forEach(u => { userMap[u.userId] = u; });

            const startupMap = {};
            startupProfiles.forEach(sp => { startupMap[sp.userId] = sp; });

            const investorMap = {};
            investorProfiles.forEach(ip => { investorMap[ip.userId] = ip; });

            // Enrich posts with author info
            posts = posts.map(post => {
                const author = userMap[post.userId];
                const startupProfile = startupMap[post.userId];
                const investorProfile = investorMap[post.userId];
                const authorName = startupProfile?.companyName || investorProfile?.investorName || author?.email || 'Unknown';

                const lastReplyUser = userMap[post.lastReplyBy];
                const lastReplyStartup = startupMap[post.lastReplyBy];
                const lastReplyInvestor = investorMap[post.lastReplyBy];
                const lastReplyName = lastReplyStartup?.companyName || lastReplyInvestor?.investorName || lastReplyUser?.email || null;

                return {
                    ...post,
                    author_email: author?.email || 'Unknown',
                    author_name: authorName,
                    author_role: author?.roleName || 'Unknown',
                    last_reply_email: lastReplyUser?.email || null,
                    last_reply_name: lastReplyName
                };
            });

            // Sort posts
            if (sortBy === 'popular') {
                posts.sort((a, b) => {
                    const aScore = (a.likeCount || 0) + (a.replyCount || 0);
                    const bScore = (b.likeCount || 0) + (b.replyCount || 0);
                    return bScore - aScore;
                });
            } else if (sortBy === 'active') {
                posts.sort((a, b) => {
                    const aDate = a.lastReplyAt ? new Date(a.lastReplyAt) : new Date(a.createdAt);
                    const bDate = b.lastReplyAt ? new Date(b.lastReplyAt) : new Date(b.createdAt);
                    return bDate - aDate;
                });
            } else { // latest
                posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            }

            // Separate pinned posts
            const pinnedPosts = posts.filter(p => p.isPinned);
            const regularPosts = posts.filter(p => !p.isPinned);
            posts = [...pinnedPosts, ...regularPosts];

            // Paginate
            const total = posts.length;
            const offset = (page - 1) * limit;
            const paginatedPosts = posts.slice(offset, offset + limit);

            return {
                posts: paginatedPosts,
                pagination: {
                    page,
                    limit,
                    total,
                    total_pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            console.error('Get category posts error:', error);
            throw error;
        }
    },

    /**
     * Get post details with replies
     */
    getPost: async (postId, userId = null) => {
        try {
            const post = await fileStorage.findOne('forum_posts', (p) => p.postId === postId);
            if (!post) return null;

            // Increment view count
            await fileStorage.update('forum_posts', postId, {
                ...post,
                viewCount: (post.viewCount || 0) + 1
            });

            // Get post author info
            const users = await fileStorage.findMany('users', () => true);
            const startupProfiles = await fileStorage.findMany('startup_profiles', () => true);
            const investorProfiles = await fileStorage.findMany('investor_profiles', () => true);

            const userMap = {};
            users.forEach(u => { userMap[u.userId] = u; });
            const startupMap = {};
            startupProfiles.forEach(sp => { startupMap[sp.userId] = sp; });
            const investorMap = {};
            investorProfiles.forEach(ip => { investorMap[ip.userId] = ip; });

            const author = userMap[post.userId];
            const startupProfile = startupMap[post.userId];
            const investorProfile = investorMap[post.userId];

            // Get replies
            const replies = await fileStorage.findMany('forum_replies', (r) => r.postId === postId);
            
            // Enrich replies with author info
            const enrichedReplies = replies.map(reply => {
                const replyAuthor = userMap[reply.userId];
                const replyStartup = startupMap[reply.userId];
                const replyInvestor = investorMap[reply.userId];
                
                return {
                    ...reply,
                    author_email: replyAuthor?.email || 'Unknown',
                    author_name: replyStartup?.companyName || replyInvestor?.investorName || replyAuthor?.email || 'Unknown',
                    author_role: replyAuthor?.roleName || 'Unknown'
                };
            });

            // Sort replies (oldest first for chronological discussion)
            enrichedReplies.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

            // Check if user liked this post
            let userLiked = false;
            if (userId) {
                const like = await fileStorage.findOne('forum_post_likes', (l) => 
                    l.postId === postId && l.userId === userId
                );
                userLiked = !!like;
            }

            return {
                post: {
                    ...post,
                    author_email: author?.email || 'Unknown',
                    author_name: startupProfile?.companyName || investorProfile?.investorName || author?.email || 'Unknown',
                    author_role: author?.roleName || 'Unknown',
                    user_liked: userLiked
                },
                replies: enrichedReplies
            };
        } catch (error) {
            console.error('Get post error:', error);
            throw error;
        }
    },

    /**
     * Create new post
     */
    createPost: async (userId, categoryId, title, content) => {
        try {
            const postId = await fileStorage.insert('forum_posts', {
                userId,
                categoryId,
                title,
                content,
                status: 'active',
                viewCount: 0,
                replyCount: 0,
                likeCount: 0,
                isPinned: false,
                isSolved: false,
                createdAt: new Date().toISOString()
            });

            // Update category's last post
            const category = await fileStorage.findOne('forum_categories', (c) => c.categoryId === categoryId);
            if (category) {
                await fileStorage.update('forum_categories', categoryId, {
                    ...category,
                    lastPostId: postId,
                    updatedAt: new Date().toISOString()
                });
            }

            return { postId };
        } catch (error) {
            console.error('Create post error:', error);
            throw error;
        }
    },

    /**
     * Update post
     */
    updatePost: async (postId, userId, updates) => {
        try {
            const post = await fileStorage.findOne('forum_posts', (p) => p.postId === postId);
            
            if (!post) {
                throw new Error('Post not found');
            }

            if (post.userId !== userId) {
                throw new Error('Not authorized to edit this post');
            }

            const allowedFields = ['title', 'content'];
            const updateData = {};

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key)) {
                    updateData[key] = value;
                }
            }

            await fileStorage.update('forum_posts', postId, {
                ...post,
                ...updateData,
                editedAt: new Date().toISOString()
            });

            return { success: true };
        } catch (error) {
            console.error('Update post error:', error);
            throw error;
        }
    },

    /**
     * Delete post (soft delete)
     */
    deletePost: async (postId, userId) => {
        try {
            const post = await fileStorage.findOne('forum_posts', (p) => p.postId === postId);
            
            if (!post) {
                throw new Error('Post not found');
            }

            if (post.userId !== userId) {
                throw new Error('Not authorized to delete this post');
            }

            await fileStorage.update('forum_posts', postId, {
                ...post,
                status: 'deleted',
                deletedAt: new Date().toISOString()
            });

            return { success: true };
        } catch (error) {
            console.error('Delete post error:', error);
            throw error;
        }
    },

    /**
     * Create reply to post
     */
    createReply: async (postId, userId, content, parentReplyId = null) => {
        try {
            const replyId = await fileStorage.insert('forum_replies', {
                postId,
                userId,
                parentReplyId,
                content,
                likeCount: 0,
                isSolution: false,
                createdAt: new Date().toISOString()
            });

            // Update post reply count and last reply info
            const post = await fileStorage.findOne('forum_posts', (p) => p.postId === postId);
            if (post) {
                await fileStorage.update('forum_posts', postId, {
                    ...post,
                    replyCount: (post.replyCount || 0) + 1,
                    lastReplyBy: userId,
                    lastReplyAt: new Date().toISOString()
                });
            }

            return { replyId };
        } catch (error) {
            console.error('Create reply error:', error);
            throw error;
        }
    },

    /**
     * Update reply
     */
    updateReply: async (replyId, userId, content) => {
        try {
            const reply = await fileStorage.findOne('forum_replies', (r) => r.replyId === replyId);
            
            if (!reply) {
                throw new Error('Reply not found');
            }

            if (reply.userId !== userId) {
                throw new Error('Not authorized to edit this reply');
            }

            await fileStorage.update('forum_replies', replyId, {
                ...reply,
                content,
                editedAt: new Date().toISOString()
            });

            return { success: true };
        } catch (error) {
            console.error('Update reply error:', error);
            throw error;
        }
    },

    /**
     * Delete reply (soft delete)
     */
    deleteReply: async (replyId, userId) => {
        try {
            const reply = await fileStorage.findOne('forum_replies', (r) => r.replyId === replyId);
            
            if (!reply) {
                throw new Error('Reply not found');
            }

            if (reply.userId !== userId) {
                throw new Error('Not authorized to delete this reply');
            }

            await fileStorage.delete('forum_replies', replyId);

            // Update post reply count
            const post = await fileStorage.findOne('forum_posts', (p) => p.postId === reply.postId);
            if (post) {
                await fileStorage.update('forum_posts', reply.postId, {
                    ...post,
                    replyCount: Math.max(0, (post.replyCount || 0) - 1)
                });
            }

            return { success: true };
        } catch (error) {
            console.error('Delete reply error:', error);
            throw error;
        }
    },

    /**
     * Toggle like on post
     */
    togglePostLike: async (postId, userId) => {
        try {
            const existingLike = await fileStorage.findOne('forum_post_likes', (l) => 
                l.postId === postId && l.userId === userId
            );

            const post = await fileStorage.findOne('forum_posts', (p) => p.postId === postId);
            if (!post) throw new Error('Post not found');

            if (existingLike) {
                // Unlike
                await fileStorage.delete('forum_post_likes', existingLike.likeId);
                await fileStorage.update('forum_posts', postId, {
                    ...post,
                    likeCount: Math.max(0, (post.likeCount || 0) - 1)
                });
                return { liked: false };
            } else {
                // Like
                await fileStorage.insert('forum_post_likes', {
                    postId,
                    userId,
                    createdAt: new Date().toISOString()
                });
                await fileStorage.update('forum_posts', postId, {
                    ...post,
                    likeCount: (post.likeCount || 0) + 1
                });
                return { liked: true };
            }
        } catch (error) {
            console.error('Toggle post like error:', error);
            throw error;
        }
    },

    /**
     * Toggle like on reply
     */
    toggleReplyLike: async (replyId, userId) => {
        try {
            const existingLike = await fileStorage.findOne('forum_reply_likes', (l) => 
                l.replyId === replyId && l.userId === userId
            );

            const reply = await fileStorage.findOne('forum_replies', (r) => r.replyId === replyId);
            if (!reply) throw new Error('Reply not found');

            if (existingLike) {
                // Unlike
                await fileStorage.delete('forum_reply_likes', existingLike.likeId);
                await fileStorage.update('forum_replies', replyId, {
                    ...reply,
                    likeCount: Math.max(0, (reply.likeCount || 0) - 1)
                });
                return { liked: false };
            } else {
                // Like
                await fileStorage.insert('forum_reply_likes', {
                    replyId,
                    userId,
                    createdAt: new Date().toISOString()
                });
                await fileStorage.update('forum_replies', replyId, {
                    ...reply,
                    likeCount: (reply.likeCount || 0) + 1
                });
                return { liked: true };
            }
        } catch (error) {
            console.error('Toggle reply like error:', error);
            throw error;
        }
    },

    /**
     * Mark reply as solution
     */
    markAsSolution: async (replyId, postId, userId) => {
        try {
            const post = await fileStorage.findOne('forum_posts', (p) => p.postId === postId);
            if (!post) throw new Error('Post not found');

            if (post.userId !== userId) {
                throw new Error('Only post author can mark solution');
            }

            const reply = await fileStorage.findOne('forum_replies', (r) => r.replyId === replyId);
            if (!reply) throw new Error('Reply not found');

            // Unmark any existing solutions for this post
            const replies = await fileStorage.findMany('forum_replies', (r) => r.postId === postId && r.isSolution);
            for (const r of replies) {
                await fileStorage.update('forum_replies', r.replyId, {
                    ...r,
                    isSolution: false
                });
            }

            // Mark this reply as solution
            await fileStorage.update('forum_replies', replyId, {
                ...reply,
                isSolution: true
            });

            // Mark post as solved
            await fileStorage.update('forum_posts', postId, {
                ...post,
                isSolved: true,
                solutionReplyId: replyId
            });

            return { success: true };
        } catch (error) {
            console.error('Mark as solution error:', error);
            throw error;
        }
    },

    /**
     * Search posts
     */
    searchPosts: async (query, page = 1, limit = 20) => {
        try {
            const searchLower = query.toLowerCase();
            
            let posts = await fileStorage.findMany('forum_posts', (p) => 
                p.status === 'active' && (
                    p.title?.toLowerCase().includes(searchLower) ||
                    p.content?.toLowerCase().includes(searchLower)
                )
            );

            // Sort by relevance (title match first, then content match)
            posts.sort((a, b) => {
                const aTitleMatch = a.title?.toLowerCase().includes(searchLower);
                const bTitleMatch = b.title?.toLowerCase().includes(searchLower);
                if (aTitleMatch && !bTitleMatch) return -1;
                if (!aTitleMatch && bTitleMatch) return 1;
                return new Date(b.createdAt) - new Date(a.createdAt);
            });

            // Paginate
            const total = posts.length;
            const offset = (page - 1) * limit;
            const paginatedPosts = posts.slice(offset, offset + limit);

            return {
                posts: paginatedPosts,
                pagination: {
                    page,
                    limit,
                    total,
                    total_pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            console.error('Search posts error:', error);
            throw error;
        }
    },

    /**
     * Get user's posts
     */
    getUserPosts: async (userId, page = 1, limit = 20) => {
        try {
            let posts = await fileStorage.findMany('forum_posts', (p) => 
                p.userId === userId && p.status === 'active'
            );

            // Sort by date (newest first)
            posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            // Paginate
            const total = posts.length;
            const offset = (page - 1) * limit;
            const paginatedPosts = posts.slice(offset, offset + limit);

            return {
                posts: paginatedPosts,
                pagination: {
                    page,
                    limit,
                    total,
                    total_pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            console.error('Get user posts error:', error);
            throw error;
        }
    },

    /**
     * Get recent forum activity
     */
    getRecentActivity: async (limit = 10) => {
        try {
            const posts = await fileStorage.findMany('forum_posts', (p) => p.status === 'active');
            const replies = await fileStorage.findMany('forum_replies', () => true);

            // Combine and sort by date
            const activity = [
                ...posts.map(p => ({ ...p, type: 'post', date: p.createdAt })),
                ...replies.map(r => ({ ...r, type: 'reply', date: r.createdAt }))
            ];

            activity.sort((a, b) => new Date(b.date) - new Date(a.date));

            return activity.slice(0, limit);
        } catch (error) {
            console.error('Get recent activity error:', error);
            throw error;
        }
    },

    /**
     * Report forum content
     */
    reportContent: async (reporterId, contentType, contentId, reason, description) => {
        try {
            await fileStorage.insert('content_reports', {
                reporterId,
                contentType,
                contentId,
                reason,
                description,
                status: 'pending',
                createdAt: new Date().toISOString()
            });

            return { success: true };
        } catch (error) {
            console.error('Report content error:', error);
            throw error;
        }
    }
};

module.exports = forum;
