const fileStorage = require('../config/fileStorage');

/**
 * Analytics Utility Functions
 * File-based aggregation queries for dashboard statistics
 */

const analytics = {
    /**
     * Get startup analytics dashboard data
     */
    getStartupAnalytics: async (userId) => {
        try {
            // Get user stats
            const userStats = await fileStorage.findOne('user_stats', (stat) => stat.userId === userId);
            
            if (!userStats) {
                return null;
            }

            // Get user's videos
            const userVideos = await fileStorage.findMany('pitch_videos', (video) => video.userId === userId);
            
            // Calculate video stats
            const totalVideoViews = userVideos.reduce((sum, video) => sum + (video.viewsCount || 0), 0);
            const totalVideoComments = userVideos.reduce((sum, video) => sum + (video.commentsCount || 0), 0);
            const avgViewsPerVideo = userVideos.length > 0 ? totalVideoViews / userVideos.length : 0;

            // Get recent activity (last 7 days)
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const profileViews = await fileStorage.findMany('profile_views', (view) => 
                view.viewedProfileId === userId && new Date(view.viewedAt) >= sevenDaysAgo
            );
            const views_last_7_days = profileViews.length;

            const messages = await fileStorage.findMany('messages', (msg) => 
                msg.senderId === userId && new Date(msg.createdAt) >= sevenDaysAgo
            );
            const messages_last_7_days = messages.length;

            const comments = await fileStorage.findMany('video_comments', (comment) => 
                comment.userId === userId && new Date(comment.createdAt) >= sevenDaysAgo
            );
            const comments_last_7_days = comments.length;

            return {
                profile_completion_percentage: userStats.profileCompletionPercentage,
                total_profile_views: userStats.totalProfileViews,
                unique_profile_viewers: userStats.uniqueProfileViewers,
                total_messages_sent: userStats.totalMessagesSent,
                total_messages_received: userStats.totalMessagesReceived,
                total_videos_uploaded: userStats.totalVideosUploaded,
                total_videos_viewed: userStats.totalVideosViewed,
                total_comments_posted: userStats.totalCommentsPosted,
                total_files_shared: userStats.totalFilesShared,
                total_matches_saved: userStats.totalMatchesSaved,
                total_badges_earned: userStats.totalBadgesEarned,
                total_points: userStats.totalPoints,
                account_age_days: userStats.accountAgeDays,
                last_login_at: userStats.lastLoginAt,
                total_video_views: totalVideoViews,
                total_video_comments: totalVideoComments,
                avg_views_per_video: avgViewsPerVideo,
                views_last_7_days,
                messages_last_7_days,
                comments_last_7_days
            };
        } catch (error) {
            console.error('Get startup analytics error:', error);
            throw error;
        }
    },

    /**
     * Get investor analytics dashboard data
     */
    getInvestorAnalytics: async (userId) => {
        try {
            // Get user stats
            const userStats = await fileStorage.findOne('user_stats', (stat) => stat.userId === userId);
            
            if (!userStats) {
                return null;
            }

            // Get unique startups viewed
            const profileViews = await fileStorage.findMany('profile_views', (view) => view.viewerId === userId);
            const uniqueStartupsViewed = new Set(profileViews.map(view => view.viewedProfileId)).size;

            // Get recent activity (last 7 days)
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const recentViews = profileViews.filter(view => new Date(view.viewedAt) >= sevenDaysAgo);
            const views_last_7_days = recentViews.length;

            const messages = await fileStorage.findMany('messages', (msg) => 
                msg.senderId === userId && new Date(msg.createdAt) >= sevenDaysAgo
            );
            const messages_last_7_days = messages.length;

            const comments = await fileStorage.findMany('video_comments', (comment) => 
                comment.userId === userId && new Date(comment.createdAt) >= sevenDaysAgo
            );
            const comments_last_7_days = comments.length;

            return {
                profile_completion_percentage: userStats.profileCompletionPercentage,
                total_profile_views: userStats.totalProfileViews,
                unique_profile_viewers: userStats.uniqueProfileViewers,
                total_messages_sent: userStats.totalMessagesSent,
                total_messages_received: userStats.totalMessagesReceived,
                total_videos_viewed: userStats.totalVideosViewed,
                total_comments_posted: userStats.totalCommentsPosted,
                total_files_downloaded: userStats.totalFilesDownloaded,
                total_matches_saved: userStats.totalMatchesSaved,
                total_badges_earned: userStats.totalBadgesEarned,
                total_points: userStats.totalPoints,
                account_age_days: userStats.accountAgeDays,
                last_login_at: userStats.lastLoginAt,
                unique_startups_viewed: uniqueStartupsViewed,
                views_last_7_days,
                messages_last_7_days,
                comments_last_7_days
            };
        } catch (error) {
            console.error('Get investor analytics error:', error);
            throw error;
        }
    },

    /**
     * Get profile view timeline (last 30 days)
     */
    getProfileViewTimeline: async (userId, days = 30) => {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);

            const profileViews = await fileStorage.findMany('profile_views', (view) => 
                view.viewedProfileId === userId && new Date(view.viewedAt) >= cutoffDate
            );

            // Group by date
            const groupedByDate = {};
            profileViews.forEach(view => {
                const date = new Date(view.viewedAt).toISOString().split('T')[0];
                if (!groupedByDate[date]) {
                    groupedByDate[date] = {
                        viewers: new Set(),
                        count: 0
                    };
                }
                groupedByDate[date].viewers.add(view.viewerId);
                groupedByDate[date].count++;
            });

            // Convert to array format
            const results = Object.keys(groupedByDate)
                .sort()
                .map(date => ({
                    date,
                    views: groupedByDate[date].count,
                    unique_viewers: groupedByDate[date].viewers.size
                }));

            return results;
        } catch (error) {
            console.error('Get profile view timeline error:', error);
            throw error;
        }
    },

    /**
     * Get engagement timeline (messages, comments, etc)
     */
    getEngagementTimeline: async (userId, days = 30) => {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);

            const engagementMetrics = await fileStorage.findMany('engagement_metrics', (metric) => 
                metric.userId === userId && new Date(metric.metricDate) >= cutoffDate
            );

            // Sort by date
            const results = engagementMetrics
                .map(metric => ({
                    date: metric.metricDate,
                    profile_views: metric.profileViews,
                    messages_sent: metric.messagesSent,
                    messages_received: metric.messagesReceived,
                    videos_viewed: metric.videosViewed,
                    comments_posted: metric.commentsPosted,
                    files_downloaded: metric.filesDownloaded
                }))
                .sort((a, b) => new Date(a.date) - new Date(b.date));

            return results;
        } catch (error) {
            console.error('Get engagement timeline error:', error);
            throw error;
        }
    },

    /**
     * Get portfolio distribution by industry (for investors)
     */
    getPortfolioByIndustry: async (userId) => {
        try {
            // Get all profile views by this investor for startups
            const profileViews = await fileStorage.findMany('profile_views', (view) => 
                view.viewerId === userId && view.viewerRole === 'Investor' && view.viewedRole === 'Startup'
            );

            // Get users and startup profiles
            const users = await fileStorage.findMany('users', () => true);
            const startupProfiles = await fileStorage.findMany('startup_profiles', () => true);
            const industries = await fileStorage.findMany('industries', () => true);

            // Create lookup maps
            const userMap = {};
            users.forEach(u => { userMap[u.userId] = u; });

            const profileMap = {};
            startupProfiles.forEach(sp => { profileMap[sp.userId] = sp; });

            const industryMap = {};
            industries.forEach(i => { industryMap[i.industryId] = i; });

            // Group by industry
            const industryStats = {};
            profileViews.forEach(view => {
                const profile = profileMap[view.viewedProfileId];
                if (profile && profile.industryId) {
                    const industry = industryMap[profile.industryId];
                    if (industry) {
                        const industryName = industry.industryName;
                        if (!industryStats[industryName]) {
                            industryStats[industryName] = {
                                startups: new Set(),
                                totalViews: 0
                            };
                        }
                        industryStats[industryName].startups.add(view.viewedProfileId);
                        industryStats[industryName].totalViews++;
                    }
                }
            });

            // Convert to array and sort
            const results = Object.keys(industryStats).map(industryName => ({
                industry_name: industryName,
                startup_count: industryStats[industryName].startups.size,
                total_views: industryStats[industryName].totalViews
            })).sort((a, b) => b.startup_count - a.startup_count);

            return results;
        } catch (error) {
            console.error('Get portfolio by industry error:', error);
            throw error;
        }
    },

    /**
     * Get portfolio distribution by funding stage (for investors)
     */
    getPortfolioByStage: async (userId) => {
        try {
            // Get all profile views by this investor for startups
            const profileViews = await fileStorage.findMany('profile_views', (view) => 
                view.viewerId === userId && view.viewerRole === 'Investor' && view.viewedRole === 'Startup'
            );

            // Get startup profiles and funding stages
            const startupProfiles = await fileStorage.findMany('startup_profiles', () => true);
            const fundingStages = await fileStorage.findMany('funding_stages', () => true);

            // Create lookup maps
            const profileMap = {};
            startupProfiles.forEach(sp => { profileMap[sp.userId] = sp; });

            const stageMap = {};
            fundingStages.forEach(fs => { stageMap[fs.stageId] = fs; });

            // Group by funding stage
            const stageStats = {};
            profileViews.forEach(view => {
                const profile = profileMap[view.viewedProfileId];
                if (profile && profile.fundingStageId) {
                    const stage = stageMap[profile.fundingStageId];
                    if (stage) {
                        const stageName = stage.stageName;
                        if (!stageStats[stageName]) {
                            stageStats[stageName] = {
                                startups: new Set(),
                                totalViews: 0
                            };
                        }
                        stageStats[stageName].startups.add(view.viewedProfileId);
                        stageStats[stageName].totalViews++;
                    }
                }
            });

            // Convert to array and sort
            const results = Object.keys(stageStats).map(stageName => ({
                stage_name: stageName,
                startup_count: stageStats[stageName].startups.size,
                total_views: stageStats[stageName].totalViews
            })).sort((a, b) => b.startup_count - a.startup_count);

            return results;
        } catch (error) {
            console.error('Get portfolio by stage error:', error);
            throw error;
        }
    },

    /**
     * Get top viewers of a profile
     */
    getTopViewers: async (userId, limit = 10) => {
        try {
            // Get all views of this profile
            const profileViews = await fileStorage.findMany('profile_views', (view) => 
                view.viewedProfileId === userId
            );

            // Get users and profiles
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

            // Group by viewer
            const viewerStats = {};
            profileViews.forEach(view => {
                const viewerId = view.viewerId;
                if (!viewerStats[viewerId]) {
                    viewerStats[viewerId] = {
                        viewCount: 0,
                        lastViewed: null,
                        totalDuration: 0
                    };
                }
                viewerStats[viewerId].viewCount++;
                viewerStats[viewerId].totalDuration += view.viewDuration || 0;
                
                const viewDate = new Date(view.viewedAt);
                if (!viewerStats[viewerId].lastViewed || viewDate > new Date(viewerStats[viewerId].lastViewed)) {
                    viewerStats[viewerId].lastViewed = view.viewedAt;
                }
            });

            // Convert to array with user details
            const results = Object.keys(viewerStats).map(viewerId => {
                const user = userMap[viewerId];
                if (!user) return null;

                const startupProfile = startupMap[viewerId];
                const investorProfile = investorMap[viewerId];
                const name = startupProfile?.companyName || investorProfile?.investorName || user.email;

                return {
                    user_id: user.userId,
                    email: user.email,
                    role: user.roleName,
                    name,
                    view_count: viewerStats[viewerId].viewCount,
                    last_viewed: viewerStats[viewerId].lastViewed,
                    total_duration: viewerStats[viewerId].totalDuration
                };
            }).filter(item => item !== null)
              .sort((a, b) => b.view_count - a.view_count)
              .slice(0, limit);

            return results;
        } catch (error) {
            console.error('Get top viewers error:', error);
            throw error;
        }
    },

    /**
     * Get video performance statistics
     */
    getVideoPerformance: async (userId) => {
        try {
            // Get user's videos
            const userVideos = await fileStorage.findMany('pitch_videos', (video) => video.userId === userId);

            // Get comments and views for each video
            const videoComments = await fileStorage.findMany('video_comments', () => true);
            const videoViews = await fileStorage.findMany('video_views', () => true);

            const results = userVideos.map(video => {
                // Count unique commenters for this video
                const uniqueCommenters = new Set(
                    videoComments.filter(c => c.videoId === video.videoId).map(c => c.userId)
                ).size;

                // Count unique viewers for this video
                const uniqueViewers = new Set(
                    videoViews.filter(v => v.videoId === video.videoId).map(v => v.viewerId)
                ).size;

                // Calculate days since upload
                const uploadDate = new Date(video.uploadedAt);
                const now = new Date();
                const daysSinceUpload = Math.floor((now - uploadDate) / (1000 * 60 * 60 * 24));

                // Calculate average daily views
                const avgDailyViews = daysSinceUpload > 0 
                    ? ((video.viewsCount || 0) / daysSinceUpload).toFixed(2)
                    : (video.viewsCount || 0).toFixed(2);

                return {
                    video_id: video.videoId,
                    title: video.title,
                    views_count: video.viewsCount || 0,
                    comments_count: video.commentsCount || 0,
                    uploaded_at: video.uploadedAt,
                    days_since_upload: daysSinceUpload,
                    avg_daily_views: parseFloat(avgDailyViews),
                    unique_commenters: uniqueCommenters,
                    unique_viewers: uniqueViewers
                };
            }).sort((a, b) => b.views_count - a.views_count);

            return results;
        } catch (error) {
            console.error('Get video performance error:', error);
            throw error;
        }
    },

    /**
     * Get match quality distribution
     */
    getMatchQualityDistribution: async (userId) => {
        try {
            const savedMatches = await fileStorage.findMany('saved_matches', (match) => match.userId === userId);

            // Group by quality range
            const qualityGroups = {
                'Excellent (80-100)': [],
                'Good (60-79)': [],
                'Fair (40-59)': [],
                'Low (0-39)': []
            };

            savedMatches.forEach(match => {
                const score = match.matchScore || 0;
                if (score >= 80) {
                    qualityGroups['Excellent (80-100)'].push(score);
                } else if (score >= 60) {
                    qualityGroups['Good (60-79)'].push(score);
                } else if (score >= 40) {
                    qualityGroups['Fair (40-59)'].push(score);
                } else {
                    qualityGroups['Low (0-39)'].push(score);
                }
            });

            // Calculate stats for each group
            const results = Object.keys(qualityGroups)
                .map(range => {
                    const scores = qualityGroups[range];
                    const avgScore = scores.length > 0
                        ? (scores.reduce((sum, s) => sum + s, 0) / scores.length).toFixed(2)
                        : 0;

                    return {
                        quality_range: range,
                        match_count: scores.length,
                        avg_score: parseFloat(avgScore)
                    };
                })
                .filter(item => item.match_count > 0)
                .sort((a, b) => b.avg_score - a.avg_score);

            return results;
        } catch (error) {
            console.error('Get match quality distribution error:', error);
            throw error;
        }
    },

    /**
     * Get recent badges earned
     */
    getRecentBadges: async (userId, limit = 10) => {
        try {
            const userBadges = await fileStorage.findMany('user_badges', (ub) => ub.userId === userId);
            const badges = await fileStorage.findMany('badges', () => true);

            // Create badge lookup map
            const badgeMap = {};
            badges.forEach(b => { badgeMap[b.badgeId] = b; });

            // Join and sort
            const results = userBadges
                .map(ub => {
                    const badge = badgeMap[ub.badgeId];
                    if (!badge) return null;

                    return {
                        user_badge_id: ub.userBadgeId,
                        earned_at: ub.earnedAt,
                        badge_name: badge.badgeName,
                        badge_description: badge.badgeDescription,
                        badge_icon: badge.badgeIcon,
                        badge_category: badge.badgeCategory,
                        points_value: badge.pointsValue
                    };
                })
                .filter(item => item !== null)
                .sort((a, b) => new Date(b.earned_at) - new Date(a.earned_at))
                .slice(0, limit);

            return results;
        } catch (error) {
            console.error('Get recent badges error:', error);
            throw error;
        }
    },

    /**
     * Get leaderboard position for user
     */
    getLeaderboardPosition: async (userId) => {
        try {
            const leaderboardEntries = await fileStorage.findMany('leaderboard', (entry) => entry.userId === userId);

            // Get total users per category/period for context
            const allLeaderboard = await fileStorage.findMany('leaderboard', () => true);
            const categoryPeriodCounts = {};

            allLeaderboard.forEach(entry => {
                const key = `${entry.category}_${entry.period}`;
                categoryPeriodCounts[key] = (categoryPeriodCounts[key] || 0) + 1;
            });

            const results = leaderboardEntries.map(entry => ({
                category: entry.category,
                rank_position: entry.rankPosition,
                score: entry.score,
                period: entry.period,
                total_users: categoryPeriodCounts[`${entry.category}_${entry.period}`] || 0
            }));

            return results;
        } catch (error) {
            console.error('Get leaderboard position error:', error);
            throw error;
        }
    },

    /**
     * Get top performers in leaderboard
     */
    getLeaderboard: async (category, period = 'all-time', limit = 10) => {
        try {
            const leaderboardEntries = await fileStorage.findMany('leaderboard', (entry) => 
                entry.category === category && entry.period === period
            );

            // Get users and profiles
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

            // Join with user details
            const results = leaderboardEntries
                .map(entry => {
                    const user = userMap[entry.userId];
                    if (!user) return null;

                    const startupProfile = startupMap[entry.userId];
                    const investorProfile = investorMap[entry.userId];
                    const name = startupProfile?.companyName || investorProfile?.investorName || user.email;

                    return {
                        rank_position: entry.rankPosition,
                        score: entry.score,
                        user_id: user.userId,
                        email: user.email,
                        role: user.roleName,
                        name
                    };
                })
                .filter(item => item !== null)
                .sort((a, b) => a.rank_position - b.rank_position)
                .slice(0, limit);

            return results;
        } catch (error) {
            console.error('Get leaderboard error:', error);
            throw error;
        }
    },

    /**
     * Track profile view
     */
    trackProfileView: async (viewerId, viewedProfileId, viewerRole, viewedRole, duration = 0) => {
        try {
            await fileStorage.insert('profile_views', {
                viewerId,
                viewedProfileId,
                viewerRole,
                viewedRole,
                viewDuration: duration,
                viewedAt: new Date().toISOString()
            });

            return true;
        } catch (error) {
            console.error('Track profile view error:', error);
            throw error;
        }
    },

    /**
     * Update profile completion percentage
     * (Simplified - in real implementation would calculate based on filled fields)
     */
    updateProfileCompletion: async (userId) => {
        try {
            // Get user and their profile
            const user = await fileStorage.findOne('users', (u) => u.userId === userId);
            if (!user) return false;

            let profile;
            if (user.roleName === 'Startup') {
                profile = await fileStorage.findOne('startup_profiles', (p) => p.userId === userId);
            } else if (user.roleName === 'Investor') {
                profile = await fileStorage.findOne('investor_profiles', (p) => p.userId === userId);
            }

            // Calculate completion percentage (simplified)
            let completion = 20; // Base for having an account
            if (profile) {
                const fields = Object.keys(profile);
                const filledFields = fields.filter(key => {
                    const value = profile[key];
                    return value !== null && value !== undefined && value !== '';
                }).length;
                completion = Math.min(100, Math.round((filledFields / fields.length) * 100));
            }

            // Update user stats
            const userStats = await fileStorage.findOne('user_stats', (stat) => stat.userId === userId);
            if (userStats) {
                await fileStorage.update('user_stats', userStats.statId, {
                    profileCompletionPercentage: completion
                });
            }

            return true;
        } catch (error) {
            console.error('Update profile completion error:', error);
            throw error;
        }
    },

    /**
     * Generate daily snapshot for user
     * (Simplified - would track daily metrics)
     */
    generateDailySnapshot: async (userId) => {
        try {
            const today = new Date().toISOString().split('T')[0];
            
            // Check if snapshot already exists for today
            const existing = await fileStorage.findOne('engagement_metrics', (metric) => 
                metric.userId === userId && metric.metricDate === today
            );

            if (existing) {
                return true; // Already generated
            }

            // Get today's activity counts
            const todayStart = new Date(today);
            const profileViews = await fileStorage.findMany('profile_views', (view) => 
                view.viewedProfileId === userId && 
                new Date(view.viewedAt).toISOString().split('T')[0] === today
            );

            const messagesSent = await fileStorage.findMany('messages', (msg) => 
                msg.senderId === userId && 
                new Date(msg.createdAt).toISOString().split('T')[0] === today
            );

            const messagesReceived = await fileStorage.findMany('messages', (msg) => 
                msg.receiverId === userId && 
                new Date(msg.createdAt).toISOString().split('T')[0] === today
            );

            const videosViewed = await fileStorage.findMany('video_views', (view) => 
                view.viewerId === userId && 
                new Date(view.viewedAt).toISOString().split('T')[0] === today
            );

            const commentsPosted = await fileStorage.findMany('video_comments', (comment) => 
                comment.userId === userId && 
                new Date(comment.createdAt).toISOString().split('T')[0] === today
            );

            // Insert snapshot
            await fileStorage.insert('engagement_metrics', {
                userId,
                metricDate: today,
                profileViews: profileViews.length,
                messagesSent: messagesSent.length,
                messagesReceived: messagesReceived.length,
                videosViewed: videosViewed.length,
                commentsPosted: commentsPosted.length,
                filesDownloaded: 0 // Would need to track this
            });

            return true;
        } catch (error) {
            console.error('Generate daily snapshot error:', error);
            throw error;
        }
    },

    /**
     * Update leaderboard rankings
     * (Simplified - recalculates all rankings)
     */
    updateLeaderboard: async () => {
        try {
            const userStats = await fileStorage.findMany('user_stats', () => true);
            const users = await fileStorage.findMany('users', () => true);
            
            // Clear existing leaderboard
            const existingLeaderboard = await fileStorage.findMany('leaderboard', () => true);
            for (const entry of existingLeaderboard) {
                await fileStorage.delete('leaderboard', entry.leaderboardId);
            }

            // Most viewed profiles
            const mostViewed = userStats
                .filter(stat => stat.totalProfileViews > 0)
                .sort((a, b) => b.totalProfileViews - a.totalProfileViews);
            
            for (let i = 0; i < mostViewed.length; i++) {
                await fileStorage.insert('leaderboard', {
                    userId: mostViewed[i].userId,
                    category: 'most_viewed',
                    score: mostViewed[i].totalProfileViews,
                    rankPosition: i + 1,
                    period: 'all-time',
                    calculatedAt: new Date().toISOString()
                });
            }

            // Most active users
            const mostActive = userStats
                .map(stat => ({
                    ...stat,
                    activityScore: stat.totalMessagesSent + stat.totalCommentsPosted + stat.totalVideosViewed
                }))
                .filter(stat => stat.activityScore > 0)
                .sort((a, b) => b.activityScore - a.activityScore);
            
            for (let i = 0; i < mostActive.length; i++) {
                await fileStorage.insert('leaderboard', {
                    userId: mostActive[i].userId,
                    category: 'most_active',
                    score: mostActive[i].activityScore,
                    rankPosition: i + 1,
                    period: 'all-time',
                    calculatedAt: new Date().toISOString()
                });
            }

            // Top networkers
            const topNetworkers = userStats
                .filter(stat => stat.totalMatchesSaved > 0)
                .sort((a, b) => b.totalMatchesSaved - a.totalMatchesSaved);
            
            for (let i = 0; i < topNetworkers.length; i++) {
                await fileStorage.insert('leaderboard', {
                    userId: topNetworkers[i].userId,
                    category: 'top_networker',
                    score: topNetworkers[i].totalMatchesSaved,
                    rankPosition: i + 1,
                    period: 'all-time',
                    calculatedAt: new Date().toISOString()
                });
            }

            // Content creators (startups only)
            const userMap = {};
            users.forEach(u => { userMap[u.userId] = u; });

            const contentCreators = userStats
                .filter(stat => {
                    const user = userMap[stat.userId];
                    return user && user.roleName === 'Startup' && 
                           (stat.totalVideosUploaded > 0 || stat.totalFilesShared > 0);
                })
                .map(stat => ({
                    ...stat,
                    contentScore: stat.totalVideosUploaded * 10 + stat.totalFilesShared
                }))
                .sort((a, b) => b.contentScore - a.contentScore);
            
            for (let i = 0; i < contentCreators.length; i++) {
                await fileStorage.insert('leaderboard', {
                    userId: contentCreators[i].userId,
                    category: 'content_creator',
                    score: contentCreators[i].contentScore,
                    rankPosition: i + 1,
                    period: 'all-time',
                    calculatedAt: new Date().toISOString()
                });
            }

            return true;
        } catch (error) {
            console.error('Update leaderboard error:', error);
            throw error;
        }
    }
};

module.exports = analytics;
