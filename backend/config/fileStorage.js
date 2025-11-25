/**
 * File-based Data Storage System
 * Replaces MySQL database with JSON file storage
 */

const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILES = {
    users: path.join(DATA_DIR, 'users.json'),
    startupProfiles: path.join(DATA_DIR, 'startup_profiles.json'),
    investorProfiles: path.join(DATA_DIR, 'investor_profiles.json'),
    industries: path.join(DATA_DIR, 'industries.json'),
    fundingStages: path.join(DATA_DIR, 'funding_stages.json'),
    savedMatches: path.join(DATA_DIR, 'saved_matches.json'),
    pitchVideos: path.join(DATA_DIR, 'pitch_videos.json'),
    videoViews: path.join(DATA_DIR, 'video_views.json'),
    videoComments: path.join(DATA_DIR, 'video_comments.json'),
    messages: path.join(DATA_DIR, 'messages.json'),
    conversations: path.join(DATA_DIR, 'conversations.json'),
    dealRooms: path.join(DATA_DIR, 'deal_rooms.json'),
    dealRoomFiles: path.join(DATA_DIR, 'deal_room_files.json'),
    filePermissions: path.join(DATA_DIR, 'file_permissions.json'),
    notifications: path.join(DATA_DIR, 'notifications.json'),
    profileViews: path.join(DATA_DIR, 'profile_views.json'),
    engagementMetrics: path.join(DATA_DIR, 'engagement_metrics.json'),
    badges: path.join(DATA_DIR, 'badges.json'),
    userBadges: path.join(DATA_DIR, 'user_badges.json'),
    userStats: path.join(DATA_DIR, 'user_stats.json'),
    notificationPreferences: path.join(DATA_DIR, 'notification_preferences.json'),
    notificationQueue: path.join(DATA_DIR, 'notification_queue.json'),
    adminUsers: path.join(DATA_DIR, 'admin_users.json'),
    kycDocuments: path.join(DATA_DIR, 'kyc_documents.json'),
    userVerifications: path.join(DATA_DIR, 'user_verifications.json'),
    adminActionLogs: path.join(DATA_DIR, 'admin_action_logs.json'),
    userReports: path.join(DATA_DIR, 'user_reports.json'),
    userSuspensions: path.join(DATA_DIR, 'user_suspensions.json'),
    forumCategories: path.join(DATA_DIR, 'forum_categories.json'),
    forumPosts: path.join(DATA_DIR, 'forum_posts.json'),
    forumReplies: path.join(DATA_DIR, 'forum_replies.json'),
    forumPostLikes: path.join(DATA_DIR, 'forum_post_likes.json'),
    forumReplyLikes: path.join(DATA_DIR, 'forum_reply_likes.json')
};

// Initialize data directory and files
async function initializeDataStorage() {
    try {
        // Create data directory if it doesn't exist
        await fs.mkdir(DATA_DIR, { recursive: true });

        // Initialize each data file with empty array or default data
        for (const [key, filePath] of Object.entries(DATA_FILES)) {
            try {
                await fs.access(filePath);
            } catch {
                // File doesn't exist, create it
                let initialData = [];

                // Add default data for specific files
                if (key === 'industries') {
                    initialData = [
                        { industry_id: 1, industry_name: 'Technology' },
                        { industry_id: 2, industry_name: 'Healthcare' },
                        { industry_id: 3, industry_name: 'Finance' },
                        { industry_id: 4, industry_name: 'E-commerce' },
                        { industry_id: 5, industry_name: 'Education' },
                        { industry_id: 6, industry_name: 'Real Estate' },
                        { industry_id: 7, industry_name: 'Energy' },
                        { industry_id: 8, industry_name: 'Transportation' },
                        { industry_id: 9, industry_name: 'Food & Beverage' },
                        { industry_id: 10, industry_name: 'Entertainment' }
                    ];
                } else if (key === 'fundingStages') {
                    initialData = [
                        { stage_id: 1, stage_name: 'Pre-Seed' },
                        { stage_id: 2, stage_name: 'Seed' },
                        { stage_id: 3, stage_name: 'Series A' },
                        { stage_id: 4, stage_name: 'Series B' },
                        { stage_id: 5, stage_name: 'Series C+' },
                        { stage_id: 6, stage_name: 'Growth' }
                    ];
                } else if (key === 'badges') {
                    initialData = [
                        { badge_id: 1, badge_name: 'Profile Complete', badge_description: 'Complete your profile 100%', badge_icon: 'fa-solid fa-user-check', badge_category: 'Profile', points_value: 50, rule_criteria: '{"profile_completion": 100}' },
                        { badge_id: 2, badge_name: 'Active Investor', badge_description: 'View more than 50 startup pitches', badge_icon: 'fa-solid fa-fire', badge_category: 'Engagement', points_value: 100, rule_criteria: '{"videos_viewed": 50, "role": "Investor"}' },
                        { badge_id: 3, badge_name: 'Active Startup', badge_description: 'Upload your first pitch video', badge_icon: 'fa-solid fa-video', badge_category: 'Content', points_value: 75, rule_criteria: '{"videos_uploaded": 1, "role": "Startup"}' },
                        { badge_id: 4, badge_name: 'Networker', badge_description: 'Save 10 or more matches', badge_icon: 'fa-solid fa-handshake', badge_category: 'Network', points_value: 80, rule_criteria: '{"matches_saved": 10}' },
                        { badge_id: 5, badge_name: 'Communicator', badge_description: 'Send 50 messages', badge_icon: 'fa-solid fa-comments', badge_category: 'Engagement', points_value: 60, rule_criteria: '{"messages_sent": 50}' }
                    ];
                } else if (key === 'forumCategories') {
                    initialData = [
                        { category_id: 1, category_name: 'General Discussion', category_slug: 'general', description: 'General conversations about startups and investing', icon: 'fa-solid fa-comments', display_order: 1, is_active: true, post_count: 0 },
                        { category_id: 2, category_name: 'Fundraising Tips', category_slug: 'fundraising', description: 'Share and discuss fundraising strategies', icon: 'fa-solid fa-money-bill-trend-up', display_order: 2, is_active: true, post_count: 0 },
                        { category_id: 3, category_name: 'Investor Insights', category_slug: 'investor-insights', description: 'Investors share their perspectives', icon: 'fa-solid fa-lightbulb', display_order: 3, is_active: true, post_count: 0 },
                        { category_id: 4, category_name: 'Success Stories', category_slug: 'success-stories', description: 'Share your wins and milestones', icon: 'fa-solid fa-trophy', display_order: 4, is_active: true, post_count: 0 },
                        { category_id: 5, category_name: 'Platform Feedback', category_slug: 'feedback', description: 'Suggestions and bug reports for SWOT Link', icon: 'fa-solid fa-bug', display_order: 5, is_active: true, post_count: 0 }
                    ];
                }

                await fs.writeFile(filePath, JSON.stringify(initialData, null, 2));
            }
        }

        console.log('File-based data storage initialized successfully');
    } catch (error) {
        console.error('Error initializing data storage:', error);
        throw error;
    }
}

// Generic read function
async function readData(dataFile) {
    try {
        const data = await fs.readFile(DATA_FILES[dataFile], 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading ${dataFile}:`, error);
        return [];
    }
}

// Generic write function
async function writeData(dataFile, data) {
    try {
        await fs.writeFile(DATA_FILES[dataFile], JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error(`Error writing ${dataFile}:`, error);
        return false;
    }
}

// Get next ID for a collection
function getNextId(data, idField = 'id') {
    if (data.length === 0) return 1;
    const ids = data.map(item => item[idField] || 0);
    return Math.max(...ids) + 1;
}

// Simulated query methods (similar to SQL)
const db = {
    // Initialize storage
    initialize: initializeDataStorage,

    // Query single item
    async findOne(dataFile, condition) {
        const data = await readData(dataFile);
        return data.find(item => {
            for (const [key, value] of Object.entries(condition)) {
                if (item[key] !== value) return false;
            }
            return true;
        });
    },

    // Query multiple items
    async findMany(dataFile, condition = {}) {
        const data = await readData(dataFile);
        if (Object.keys(condition).length === 0) return data;

        return data.filter(item => {
            for (const [key, value] of Object.entries(condition)) {
                if (item[key] !== value) return false;
            }
            return true;
        });
    },

    // Insert new item
    async insert(dataFile, newItem, idField = 'id') {
        const data = await readData(dataFile);
        const id = getNextId(data, idField);
        const itemWithId = { [idField]: id, ...newItem, created_at: new Date().toISOString() };
        data.push(itemWithId);
        await writeData(dataFile, data);
        return { insertId: id, ...itemWithId };
    },

    // Update item
    async update(dataFile, condition, updates) {
        const data = await readData(dataFile);
        let updated = false;

        const updatedData = data.map(item => {
            let matches = true;
            for (const [key, value] of Object.entries(condition)) {
                if (item[key] !== value) {
                    matches = false;
                    break;
                }
            }

            if (matches) {
                updated = true;
                return { ...item, ...updates, updated_at: new Date().toISOString() };
            }
            return item;
        });

        if (updated) {
            await writeData(dataFile, updatedData);
        }
        return updated;
    },

    // Delete item
    async delete(dataFile, condition) {
        const data = await readData(dataFile);
        const filteredData = data.filter(item => {
            for (const [key, value] of Object.entries(condition)) {
                if (item[key] === value) return false;
            }
            return true;
        });

        await writeData(dataFile, filteredData);
        return data.length - filteredData.length; // Return count of deleted items
    },

    // Count items
    async count(dataFile, condition = {}) {
        const items = await this.findMany(dataFile, condition);
        return items.length;
    },

    // Custom query for complex operations
    async query(dataFile, queryFn) {
        const data = await readData(dataFile);
        return queryFn(data);
    },

    // Get all data from a file
    async getAll(dataFile) {
        return await readData(dataFile);
    }
};

module.exports = db;
