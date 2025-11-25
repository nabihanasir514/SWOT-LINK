const db = require('../config/fileStorage');

// ============================================
// AWARD BADGE TO USER
// ============================================
async function awardBadge(userId, badgeId) {
  try {
    const existing = await db.findOne('userBadges', { user_id: userId, badge_id: badgeId });
    if (existing) return { alreadyAwarded: true };

    const badge = await db.findOne('badges', { badge_id: badgeId });
    if (!badge) return { error: 'Badge not found' };

    await db.insert('userBadges', {
      user_id: userId,
      badge_id: badgeId,
      points_awarded: badge.points_value || 0
    }, 'user_badge_id');

    // Update user total points
    const stats = await db.findOne('userStats', { user_id: userId });
    if (stats) {
      const newPoints = (stats.total_points || 0) + (badge.points_value || 0);
      await db.update('userStats', { user_id: userId }, { total_points: newPoints });
    }

    return { success: true, badge, points: badge.points_value };
  } catch (error) {
    console.error('Award badge error:', error);
    throw error;
  }
}

// ============================================
// CHECK AND AWARD BADGES BASED ON ACTIVITY
// ============================================
async function checkAndAwardBadges(userId) {
  try {
    const user = await db.findOne('users', { user_id: userId });
    if (!user) return { awarded: [] };

    const stats = await getOrCreateUserStats(userId);
    const allBadges = await db.getAll('badges');
    const userBadges = await db.getAll('userBadges');
    const earnedIds = new Set(userBadges.filter(ub => ub.user_id === userId).map(ub => ub.badge_id));

    const awarded = [];
    for (const badge of allBadges) {
      if (earnedIds.has(badge.badge_id)) continue;

      let criteria = badge.rule_criteria;
      if (typeof criteria === 'string') {
        try { criteria = JSON.parse(criteria); } catch { criteria = {}; }
      }

      if (await meetsCriteria(userId, user.role, stats, criteria)) {
        const result = await awardBadge(userId, badge.badge_id);
        if (result.success) awarded.push(badge);
      }
    }

    return { awarded };
  } catch (error) {
    console.error('Check and award badges error:', error);
    return { awarded: [] };
  }
}

// ============================================
// CHECK IF USER MEETS BADGE CRITERIA
// ============================================
async function meetsCriteria(userId, userRole, stats, criteria) {
  try {
    if (criteria.role && criteria.role !== userRole) return false;
    if (criteria.profile_completion && (stats.profile_completion_percentage || 0) < criteria.profile_completion) return false;

    // Videos
    if (criteria.videos_viewed) {
      const views = await db.getAll('videoViews');
      const userViews = views.filter(v => v.user_id === userId);
      if (userViews.length < criteria.videos_viewed) return false;
    }

    if (criteria.videos_uploaded && userRole === 'Startup') {
      const videos = await db.getAll('pitchVideos');
      const userVideos = videos.filter(v => v.user_id === userId);
      if (userVideos.length < criteria.videos_uploaded) return false;
    }

    // Messages
    if (criteria.messages_sent) {
      const messages = await db.getAll('messages');
      const sent = messages.filter(m => m.sender_id === userId);
      if (sent.length < criteria.messages_sent) return false;
    }

    // Matches saved
    if (criteria.matches_saved) {
      const matches = await db.getAll('savedMatches');
      const userMatches = matches.filter(m => m.user_id === userId);
      if (userMatches.length < criteria.matches_saved) return false;
    }

    return true;
  } catch (error) {
    console.error('Meets criteria error:', error);
    return false;
  }
}

// ============================================
// GET OR CREATE USER STATS
// ============================================
async function getOrCreateUserStats(userId) {
  let stats = await db.findOne('userStats', { user_id: userId });
  if (!stats) {
    stats = await db.insert('userStats', {
      user_id: userId,
      total_points: 0,
      profile_completion_percentage: 0,
      total_matches_saved: 0,
      total_messages_sent: 0,
      total_profile_views: 0
    }, 'stat_id');
  }
  return stats;
}

// ============================================
// GET USER GAMIFICATION SUMMARY
// ============================================
async function getGamificationSummary(userId) {
  try {
    const stats = await getOrCreateUserStats(userId);
    const userBadges = await db.getAll('userBadges');
    const badges = await db.getAll('badges');

    const earned = userBadges.filter(ub => ub.user_id === userId);
    const badgeDetails = earned.map(ub => {
      const badge = badges.find(b => b.badge_id === ub.badge_id);
      return { ...ub, ...badge };
    });

    // Leaderboard (top 10)
    const allStats = await db.getAll('userStats');
    const sorted = allStats.sort((a, b) => (b.total_points || 0) - (a.total_points || 0));
    const userRank = sorted.findIndex(s => s.user_id === userId) + 1;

    return {
      total_points: stats.total_points || 0,
      badges_earned: badgeDetails.length,
      badges: badgeDetails,
      rank: userRank,
      total_users: sorted.length
    };
  } catch (error) {
    console.error('Get gamification summary error:', error);
    throw error;
  }
}

// ============================================
// GET LEADERBOARD
// ============================================
async function getLeaderboard(limit = 10) {
  try {
    const allStats = await db.getAll('userStats');
    const users = await db.getAll('users');
    const sp = await db.getAll('startupProfiles');
    const ip = await db.getAll('investorProfiles');

    const uMap = new Map(users.map(u => [u.user_id, u]));
    const spMap = new Map(sp.map(p => [p.user_id, p]));
    const ipMap = new Map(ip.map(p => [p.user_id, p]));

    const sorted = allStats.sort((a, b) => (b.total_points || 0) - (a.total_points || 0)).slice(0, limit);

    const leaderboard = sorted.map((stat, index) => {
      const u = uMap.get(stat.user_id) || {};
      return {
        rank: index + 1,
        user_id: stat.user_id,
        username: u.full_name || (u.email ? u.email.split('@')[0] : ''),
        role: u.role || '',
        display_name: spMap.get(stat.user_id)?.company_name || ipMap.get(stat.user_id)?.investor_name || '',
        total_points: stat.total_points || 0
      };
    });

    return leaderboard;
  } catch (error) {
    console.error('Get leaderboard error:', error);
    throw error;
  }
}

module.exports = {
  awardBadge,
  checkAndAwardBadges,
  getGamificationSummary,
  getLeaderboard,
  getOrCreateUserStats
};
                    if (criteria.messages_sent) {
                        requirements.push(Math.min(100, (userStats.totalMessagesSent / criteria.messages_sent) * 100));
                    }
                    if (criteria.matches_saved) {
                        requirements.push(Math.min(100, (userStats.totalMatchesSaved / criteria.matches_saved) * 100));
                    }

                    progressPercentage = requirements.length > 0
                        ? requirements.reduce((sum, val) => sum + val, 0) / requirements.length
                        : 0;
                }

                return {
                    badge_id: badge.badgeId,
                    badge_name: badge.badgeName,
                    badge_description: badge.badgeDescription,
                    badge_icon: badge.badgeIcon,
                    badge_category: badge.badgeCategory,
                    points_value: badge.pointsValue,
                    is_earned: isEarned,
                    earned_at: isEarned ? userBadges.find(ub => ub.badgeId === badge.badgeId)?.earnedAt : null,
                    progress_percentage: Math.round(progressPercentage),
                    criteria: criteria
                };
            });

            return results;
        } catch (error) {
            console.error('Get badge progress error:', error);
            throw error;
        }
    },

    /**
     * Get user's gamification summary
     */
    getGamificationSummary: async (userId) => {
        try {
            // Get user stats
            const userStats = await fileStorage.findOne('user_stats', (stat) => stat.userId === userId);
            
            // Get user badges with details
            const userBadges = await fileStorage.findMany('user_badges', (ub) => ub.userId === userId);
            const allBadges = await fileStorage.findMany('badges', () => true);
            
            const badgeMap = {};
            allBadges.forEach(b => { badgeMap[b.badgeId] = b; });

            // Badge breakdown by category
            const categoryStats = {};
            userBadges.forEach(ub => {
                const badge = badgeMap[ub.badgeId];
                if (badge) {
                    const category = badge.badgeCategory;
                    if (!categoryStats[category]) {
                        categoryStats[category] = { badge_count: 0, total_points: 0 };
                    }
                    categoryStats[category].badge_count++;
                    categoryStats[category].total_points += badge.pointsValue || 0;
                }
            });

            const badgeBreakdown = Object.keys(categoryStats).map(category => ({
                badge_category: category,
                badge_count: categoryStats[category].badge_count,
                total_points: categoryStats[category].total_points
            }));

            // Recent badges
            const recentBadges = userBadges
                .map(ub => {
                    const badge = badgeMap[ub.badgeId];
                    return badge ? {
                        earned_at: ub.earnedAt,
                        badge_name: badge.badgeName,
                        badge_icon: badge.badgeIcon,
                        points_value: badge.pointsValue
                    } : null;
                })
                .filter(b => b !== null)
                .sort((a, b) => new Date(b.earned_at) - new Date(a.earned_at))
                .slice(0, 5);

            // Next badges to earn
            const badgeProgress = await gamification.getBadgeProgress(userId);
            const nextBadges = badgeProgress
                .filter(b => !b.is_earned && b.progress_percentage > 0)
                .sort((a, b) => b.progress_percentage - a.progress_percentage)
                .slice(0, 5);

            // Get leaderboard positions
            const leaderboard = await fileStorage.findMany('leaderboard', (entry) => 
                entry.userId === userId && entry.period === 'all-time'
            );
            
            const allLeaderboard = await fileStorage.findMany('leaderboard', () => true);
            const categoryPeriodCounts = {};
            allLeaderboard.forEach(entry => {
                const key = `${entry.category}_${entry.period}`;
                categoryPeriodCounts[key] = (categoryPeriodCounts[key] || 0) + 1;
            });

            const leaderboardPositions = leaderboard.map(entry => ({
                category: entry.category,
                rank_position: entry.rankPosition,
                total_users: categoryPeriodCounts[`${entry.category}_${entry.period}`] || 0
            }));

            return {
                stats: userStats || { 
                    total_badges_earned: 0, 
                    total_points: 0, 
                    profile_completion_percentage: 0 
                },
                badge_breakdown: badgeBreakdown,
                recent_badges: recentBadges,
                next_badges: nextBadges,
                leaderboard_positions: leaderboardPositions
            };
        } catch (error) {
            console.error('Get gamification summary error:', error);
            throw error;
        }
    },

    /**
     * Award manual badge (admin function)
     */
    awardBadge: async (userId, badgeId, adminId) => {
        try {
            // Check if badge already awarded
            const existing = await fileStorage.findOne('user_badges', (ub) => 
                ub.userId === userId && ub.badgeId === badgeId
            );

            if (existing) {
                return { success: false, message: 'Badge already awarded' };
            }

            // Award badge
            await fileStorage.insert('user_badges', {
                userId,
                badgeId,
                earnedAt: new Date().toISOString()
            });

            // Get badge details
            const badge = await fileStorage.findOne('badges', (b) => b.badgeId === badgeId);

            if (badge) {
                // Send notification
                sendNotification(userId, {
                    type: 'badge_earned',
                    badge: {
                        badge_id: badge.badgeId,
                        badge_name: badge.badgeName,
                        badge_icon: badge.badgeIcon,
                        points_value: badge.pointsValue
                    }
                });
            }

            return { success: true, badge };
        } catch (error) {
            console.error('Award badge error:', error);
            throw error;
        }
    }
};

module.exports = gamification;
