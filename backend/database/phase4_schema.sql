-- ============================================
-- SWOT LINK - Phase 4 Database Schema
-- Analytics & Engagement
-- ============================================

-- ============================================
-- 1. PROFILE VIEWS TABLE (Analytics)
-- ============================================
CREATE TABLE IF NOT EXISTS profile_views (
    view_id INT AUTO_INCREMENT PRIMARY KEY,
    viewer_id INT NOT NULL,
    viewed_profile_id INT NOT NULL,
    viewer_role ENUM('Startup', 'Investor') NOT NULL,
    viewed_role ENUM('Startup', 'Investor') NOT NULL,
    view_duration INT DEFAULT 0, -- Seconds spent viewing profile
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (viewer_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (viewed_profile_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_viewer_id (viewer_id),
    INDEX idx_viewed_profile_id (viewed_profile_id),
    INDEX idx_viewed_at (viewed_at),
    INDEX idx_viewer_role (viewer_role),
    INDEX idx_viewed_role (viewed_role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 2. ENGAGEMENT METRICS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS engagement_metrics (
    metric_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    metric_date DATE NOT NULL,
    profile_views INT DEFAULT 0,
    profile_clicks INT DEFAULT 0,
    messages_sent INT DEFAULT 0,
    messages_received INT DEFAULT 0,
    videos_uploaded INT DEFAULT 0,
    videos_viewed INT DEFAULT 0,
    comments_posted INT DEFAULT 0,
    files_shared INT DEFAULT 0,
    files_downloaded INT DEFAULT 0,
    matches_saved INT DEFAULT 0,
    login_count INT DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_date (user_id, metric_date),
    INDEX idx_user_id (user_id),
    INDEX idx_metric_date (metric_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 3. BADGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS badges (
    badge_id INT AUTO_INCREMENT PRIMARY KEY,
    badge_name VARCHAR(100) NOT NULL UNIQUE,
    badge_description TEXT,
    badge_icon VARCHAR(100), -- Font Awesome class or emoji
    badge_category ENUM('Profile', 'Engagement', 'Network', 'Content', 'Special') DEFAULT 'Engagement',
    points_value INT DEFAULT 0,
    rule_criteria JSON, -- Store rule conditions as JSON
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 4. USER BADGES TABLE (Achievements)
-- ============================================
CREATE TABLE IF NOT EXISTS user_badges (
    user_badge_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    badge_id INT NOT NULL,
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    progress_data JSON, -- Store progress towards badge
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (badge_id) REFERENCES badges(badge_id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_badge (user_id, badge_id),
    INDEX idx_user_id (user_id),
    INDEX idx_earned_at (earned_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 5. USER STATS TABLE (Aggregated)
-- ============================================
CREATE TABLE IF NOT EXISTS user_stats (
    stat_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    profile_completion_percentage INT DEFAULT 0,
    total_profile_views INT DEFAULT 0,
    unique_profile_viewers INT DEFAULT 0,
    total_messages_sent INT DEFAULT 0,
    total_messages_received INT DEFAULT 0,
    total_videos_uploaded INT DEFAULT 0,
    total_videos_viewed INT DEFAULT 0,
    total_comments_posted INT DEFAULT 0,
    total_files_shared INT DEFAULT 0,
    total_files_downloaded INT DEFAULT 0,
    total_matches_saved INT DEFAULT 0,
    total_badges_earned INT DEFAULT 0,
    total_points INT DEFAULT 0,
    account_age_days INT DEFAULT 0,
    last_login_at TIMESTAMP NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_stats (user_id),
    INDEX idx_profile_completion (profile_completion_percentage),
    INDEX idx_total_points (total_points)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 6. NOTIFICATION PREFERENCES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notification_preferences (
    preference_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    email_notifications BOOLEAN DEFAULT TRUE,
    sms_notifications BOOLEAN DEFAULT FALSE,
    push_notifications BOOLEAN DEFAULT TRUE,
    notify_new_message BOOLEAN DEFAULT TRUE,
    notify_profile_view BOOLEAN DEFAULT TRUE,
    notify_file_shared BOOLEAN DEFAULT TRUE,
    notify_comment BOOLEAN DEFAULT TRUE,
    notify_badge_earned BOOLEAN DEFAULT TRUE,
    notify_match_found BOOLEAN DEFAULT TRUE,
    notify_daily_summary BOOLEAN DEFAULT FALSE,
    notify_weekly_report BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_preferences (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 7. NOTIFICATION QUEUE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notification_queue (
    queue_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    notification_channel ENUM('email', 'sms', 'push', 'in-app') NOT NULL,
    recipient_email VARCHAR(255),
    recipient_phone VARCHAR(20),
    subject VARCHAR(255),
    message TEXT NOT NULL,
    template_data JSON,
    status ENUM('pending', 'sent', 'failed') DEFAULT 'pending',
    attempts INT DEFAULT 0,
    scheduled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP NULL,
    error_message TEXT,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_scheduled_at (scheduled_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 8. ANALYTICS SNAPSHOTS TABLE (Historical)
-- ============================================
CREATE TABLE IF NOT EXISTS analytics_snapshots (
    snapshot_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    snapshot_date DATE NOT NULL,
    snapshot_type ENUM('daily', 'weekly', 'monthly') NOT NULL,
    metrics_data JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_snapshot (user_id, snapshot_date, snapshot_type),
    INDEX idx_user_id (user_id),
    INDEX idx_snapshot_date (snapshot_date),
    INDEX idx_snapshot_type (snapshot_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 9. LEADERBOARD TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS leaderboard (
    rank_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    category ENUM('most_viewed', 'most_active', 'top_networker', 'content_creator') NOT NULL,
    score INT DEFAULT 0,
    rank_position INT DEFAULT 0,
    period ENUM('weekly', 'monthly', 'all-time') DEFAULT 'all-time',
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_category (category),
    INDEX idx_rank_position (rank_position),
    INDEX idx_period (period)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- INSERT DEFAULT BADGES
-- ============================================
INSERT INTO badges (badge_name, badge_description, badge_icon, badge_category, points_value, rule_criteria) VALUES
('Profile Complete', 'Complete your profile 100%', 'fa-solid fa-user-check', 'Profile', 50, '{"profile_completion": 100}'),
('Active Investor', 'View more than 50 startup pitches', 'fa-solid fa-fire', 'Engagement', 100, '{"videos_viewed": 50, "role": "Investor"}'),
('Active Startup', 'Upload your first pitch video', 'fa-solid fa-video', 'Content', 75, '{"videos_uploaded": 1, "role": "Startup"}'),
('Networker', 'Save 10 or more matches', 'fa-solid fa-handshake', 'Network', 80, '{"matches_saved": 10}'),
('Early Bird', 'One of the first 100 users', 'fa-solid fa-medal', 'Special', 150, '{"user_id": "<= 100"}'),
('Communicator', 'Send 50 messages', 'fa-solid fa-comments', 'Engagement', 60, '{"messages_sent": 50}'),
('Popular Profile', 'Get 100 profile views', 'fa-solid fa-star', 'Profile', 90, '{"profile_views": 100}'),
('Content Sharer', 'Share 5 files in deal room', 'fa-solid fa-folder-open', 'Content', 70, '{"files_shared": 5, "role": "Startup"}'),
('Engaged Viewer', 'Comment on 20 pitch videos', 'fa-solid fa-comment-dots', 'Engagement', 65, '{"comments_posted": 20}'),
('Super Connector', 'Message 20 different users', 'fa-solid fa-network-wired', 'Network', 120, '{"unique_connections": 20}');

-- ============================================
-- TRIGGER: Track profile views
-- ============================================
DELIMITER $$

CREATE TRIGGER after_profile_view_insert
AFTER INSERT ON profile_views
FOR EACH ROW
BEGIN
    -- Update user stats for viewed profile
    INSERT INTO user_stats (user_id, total_profile_views, unique_profile_viewers)
    VALUES (NEW.viewed_profile_id, 1, 1)
    ON DUPLICATE KEY UPDATE 
        total_profile_views = total_profile_views + 1,
        unique_profile_viewers = (
            SELECT COUNT(DISTINCT viewer_id) 
            FROM profile_views 
            WHERE viewed_profile_id = NEW.viewed_profile_id
        );
    
    -- Update daily engagement metrics
    INSERT INTO engagement_metrics (user_id, metric_date, profile_views)
    VALUES (NEW.viewed_profile_id, CURDATE(), 1)
    ON DUPLICATE KEY UPDATE profile_views = profile_views + 1;
    
    -- Send notification if preferences allow
    IF EXISTS (
        SELECT 1 FROM notification_preferences 
        WHERE user_id = NEW.viewed_profile_id 
        AND notify_profile_view = TRUE
    ) THEN
        -- Get view count for today
        SET @today_views = (
            SELECT COUNT(*) FROM profile_views 
            WHERE viewed_profile_id = NEW.viewed_profile_id 
            AND DATE(viewed_at) = CURDATE()
        );
        
        -- Notify on milestones (10, 50, 100 views)
        IF @today_views IN (10, 50, 100) THEN
            INSERT INTO notifications (user_id, notification_type, reference_id, title, message, link_url)
            VALUES (
                NEW.viewed_profile_id,
                'profile_milestone',
                NEW.view_id,
                'Profile Views Milestone',
                CONCAT('Your profile has been viewed ', @today_views, ' times today!'),
                '/analytics.html'
            );
        END IF;
    END IF;
END$$

DELIMITER ;

-- ============================================
-- TRIGGER: Update engagement metrics on message
-- ============================================
DELIMITER $$

CREATE TRIGGER after_message_for_metrics
AFTER INSERT ON messages
FOR EACH ROW
BEGIN
    -- Update sender metrics
    INSERT INTO engagement_metrics (user_id, metric_date, messages_sent)
    VALUES (NEW.sender_id, CURDATE(), 1)
    ON DUPLICATE KEY UPDATE messages_sent = messages_sent + 1;
    
    INSERT INTO user_stats (user_id, total_messages_sent)
    VALUES (NEW.sender_id, 1)
    ON DUPLICATE KEY UPDATE total_messages_sent = total_messages_sent + 1;
    
    -- Update receiver metrics
    INSERT INTO engagement_metrics (user_id, metric_date, messages_received)
    VALUES (NEW.receiver_id, CURDATE(), 1)
    ON DUPLICATE KEY UPDATE messages_received = messages_received + 1;
    
    INSERT INTO user_stats (user_id, total_messages_received)
    VALUES (NEW.receiver_id, 1)
    ON DUPLICATE KEY UPDATE total_messages_received = total_messages_received + 1;
END$$

DELIMITER ;

-- ============================================
-- TRIGGER: Update metrics on video upload
-- ============================================
DELIMITER $$

CREATE TRIGGER after_video_upload_metrics
AFTER INSERT ON pitch_videos
FOR EACH ROW
BEGIN
    INSERT INTO engagement_metrics (user_id, metric_date, videos_uploaded)
    VALUES (NEW.user_id, CURDATE(), 1)
    ON DUPLICATE KEY UPDATE videos_uploaded = videos_uploaded + 1;
    
    INSERT INTO user_stats (user_id, total_videos_uploaded)
    VALUES (NEW.user_id, 1)
    ON DUPLICATE KEY UPDATE total_videos_uploaded = total_videos_uploaded + 1;
END$$

DELIMITER ;

-- ============================================
-- TRIGGER: Update metrics on comment
-- ============================================
DELIMITER $$

CREATE TRIGGER after_comment_metrics
AFTER INSERT ON video_comments
FOR EACH ROW
BEGIN
    INSERT INTO engagement_metrics (user_id, metric_date, comments_posted)
    VALUES (NEW.user_id, CURDATE(), 1)
    ON DUPLICATE KEY UPDATE comments_posted = comments_posted + 1;
    
    INSERT INTO user_stats (user_id, total_comments_posted)
    VALUES (NEW.user_id, 1)
    ON DUPLICATE KEY UPDATE total_comments_posted = total_comments_posted + 1;
END$$

DELIMITER ;

-- ============================================
-- TRIGGER: Update metrics on badge earned
-- ============================================
DELIMITER $$

CREATE TRIGGER after_badge_earned
AFTER INSERT ON user_badges
FOR EACH ROW
BEGIN
    DECLARE badge_points INT;
    
    -- Get badge points
    SELECT points_value INTO badge_points
    FROM badges WHERE badge_id = NEW.badge_id;
    
    -- Update user stats
    INSERT INTO user_stats (user_id, total_badges_earned, total_points)
    VALUES (NEW.user_id, 1, badge_points)
    ON DUPLICATE KEY UPDATE 
        total_badges_earned = total_badges_earned + 1,
        total_points = total_points + badge_points;
    
    -- Send notification
    IF EXISTS (
        SELECT 1 FROM notification_preferences 
        WHERE user_id = NEW.user_id 
        AND notify_badge_earned = TRUE
    ) THEN
        INSERT INTO notifications (user_id, notification_type, reference_id, title, message, link_url)
        SELECT 
            NEW.user_id,
            'badge_earned',
            NEW.user_badge_id,
            'New Badge Earned!',
            CONCAT('Congratulations! You earned the "', b.badge_name, '" badge (+', b.points_value, ' points)'),
            '/analytics.html'
        FROM badges b
        WHERE b.badge_id = NEW.badge_id;
    END IF;
END$$

DELIMITER ;

-- ============================================
-- STORED PROCEDURE: Check and Award Badges
-- ============================================
DELIMITER $$

CREATE PROCEDURE check_and_award_badges(IN target_user_id INT)
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE current_badge_id INT;
    DECLARE badge_criteria JSON;
    DECLARE badge_cursor CURSOR FOR SELECT badge_id, rule_criteria FROM badges;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    OPEN badge_cursor;
    
    read_loop: LOOP
        FETCH badge_cursor INTO current_badge_id, badge_criteria;
        IF done THEN
            LEAVE read_loop;
        END IF;
        
        -- Check if user already has this badge
        IF NOT EXISTS (
            SELECT 1 FROM user_badges 
            WHERE user_id = target_user_id 
            AND badge_id = current_badge_id
        ) THEN
            -- Award badge based on criteria (simplified logic)
            -- In production, you'd parse JSON and check conditions dynamically
            INSERT IGNORE INTO user_badges (user_id, badge_id)
            VALUES (target_user_id, current_badge_id);
        END IF;
    END LOOP;
    
    CLOSE badge_cursor;
END$$

DELIMITER ;

-- ============================================
-- STORED PROCEDURE: Calculate Profile Completion
-- ============================================
DELIMITER $$

CREATE PROCEDURE calculate_profile_completion(IN target_user_id INT)
BEGIN
    DECLARE user_role VARCHAR(20);
    DECLARE completion_percentage INT DEFAULT 0;
    DECLARE fields_filled INT DEFAULT 0;
    DECLARE total_fields INT DEFAULT 0;
    
    -- Get user role
    SELECT role INTO user_role FROM users WHERE user_id = target_user_id;
    
    IF user_role = 'Startup' THEN
        SET total_fields = 12; -- Company name, industry, stage, pitch, SWOT(4), funding, team, location, website
        
        SELECT 
            (CASE WHEN company_name IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN industry_id IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN funding_stage_id IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN elevator_pitch IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN strengths IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN weaknesses IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN opportunities IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN threats IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN funding_goal IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN team_size IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN location IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN website IS NOT NULL THEN 1 ELSE 0 END)
        INTO fields_filled
        FROM startup_profiles
        WHERE user_id = target_user_id;
        
    ELSEIF user_role = 'Investor' THEN
        SET total_fields = 8; -- Name, type, thesis, budget(2), location, experience, company, preferences
        
        SELECT 
            (CASE WHEN investor_name IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN investor_type IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN investment_thesis IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN budget_min IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN budget_max IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN location IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN years_experience IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN company IS NOT NULL THEN 1 ELSE 0 END)
        INTO fields_filled
        FROM investor_profiles
        WHERE user_id = target_user_id;
    END IF;
    
    -- Calculate percentage
    SET completion_percentage = ROUND((fields_filled / total_fields) * 100);
    
    -- Update user stats
    INSERT INTO user_stats (user_id, profile_completion_percentage)
    VALUES (target_user_id, completion_percentage)
    ON DUPLICATE KEY UPDATE profile_completion_percentage = completion_percentage;
    
    SELECT completion_percentage as profile_completion;
END$$

DELIMITER ;

-- ============================================
-- STORED PROCEDURE: Generate Daily Snapshot
-- ============================================
DELIMITER $$

CREATE PROCEDURE generate_daily_snapshot(IN target_user_id INT)
BEGIN
    DECLARE snapshot_data JSON;
    
    -- Aggregate metrics
    SELECT JSON_OBJECT(
        'profile_views', COALESCE(SUM(profile_views), 0),
        'messages_sent', COALESCE(SUM(messages_sent), 0),
        'messages_received', COALESCE(SUM(messages_received), 0),
        'videos_viewed', COALESCE(SUM(videos_viewed), 0),
        'comments_posted', COALESCE(SUM(comments_posted), 0),
        'files_downloaded', COALESCE(SUM(files_downloaded), 0),
        'date', CURDATE()
    ) INTO snapshot_data
    FROM engagement_metrics
    WHERE user_id = target_user_id
    AND metric_date = CURDATE();
    
    -- Insert snapshot
    INSERT INTO analytics_snapshots (user_id, snapshot_date, snapshot_type, metrics_data)
    VALUES (target_user_id, CURDATE(), 'daily', snapshot_data)
    ON DUPLICATE KEY UPDATE metrics_data = snapshot_data;
END$$

DELIMITER ;

-- ============================================
-- Create notification preferences for existing users
-- ============================================
INSERT INTO notification_preferences (user_id)
SELECT user_id FROM users
WHERE NOT EXISTS (
    SELECT 1 FROM notification_preferences np WHERE np.user_id = users.user_id
);

-- ============================================
-- Initialize user stats for existing users
-- ============================================
INSERT INTO user_stats (user_id)
SELECT user_id FROM users
WHERE NOT EXISTS (
    SELECT 1 FROM user_stats us WHERE us.user_id = users.user_id
);

COMMIT;
