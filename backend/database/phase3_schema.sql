-- ============================================
-- SWOT LINK - Phase 3 Database Schema
-- Interaction & Deal Flow
-- ============================================

-- ============================================
-- 1. PITCH VIDEOS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS pitch_videos (
    video_id INT AUTO_INCREMENT PRIMARY KEY,
    startup_id INT NOT NULL,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    video_url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500),
    duration INT, -- Duration in seconds
    file_size BIGINT, -- Size in bytes
    views_count INT DEFAULT 0,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (startup_id) REFERENCES startup_profiles(profile_id) ON DELETE CASCADE,
    INDEX idx_startup_id (startup_id),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 2. VIDEO COMMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS video_comments (
    comment_id INT AUTO_INCREMENT PRIMARY KEY,
    video_id INT NOT NULL,
    user_id INT NOT NULL,
    comment_text TEXT NOT NULL,
    parent_comment_id INT DEFAULT NULL, -- For threaded replies
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (video_id) REFERENCES pitch_videos(video_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (parent_comment_id) REFERENCES video_comments(comment_id) ON DELETE CASCADE,
    INDEX idx_video_id (video_id),
    INDEX idx_user_id (user_id),
    INDEX idx_parent_comment (parent_comment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 3. VIDEO VIEWS TABLE (Analytics)
-- ============================================
CREATE TABLE IF NOT EXISTS video_views (
    view_id INT AUTO_INCREMENT PRIMARY KEY,
    video_id INT NOT NULL,
    viewer_id INT NOT NULL,
    watch_duration INT DEFAULT 0, -- Seconds watched
    completed BOOLEAN DEFAULT FALSE,
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (video_id) REFERENCES pitch_videos(video_id) ON DELETE CASCADE,
    FOREIGN KEY (viewer_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_video_id (video_id),
    INDEX idx_viewer_id (viewer_id),
    UNIQUE KEY unique_video_viewer (video_id, viewer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 4. MESSAGES TABLE (Direct Messaging)
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
    message_id INT AUTO_INCREMENT PRIMARY KEY,
    sender_id INT NOT NULL,
    receiver_id INT NOT NULL,
    message_text TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_sender_id (sender_id),
    INDEX idx_receiver_id (receiver_id),
    INDEX idx_created_at (created_at),
    INDEX idx_conversation (sender_id, receiver_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 5. CONVERSATIONS TABLE (Metadata)
-- ============================================
CREATE TABLE IF NOT EXISTS conversations (
    conversation_id INT AUTO_INCREMENT PRIMARY KEY,
    user1_id INT NOT NULL,
    user2_id INT NOT NULL,
    last_message_id INT,
    last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user1_unread_count INT DEFAULT 0,
    user2_unread_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user1_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (user2_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (last_message_id) REFERENCES messages(message_id) ON DELETE SET NULL,
    UNIQUE KEY unique_conversation (user1_id, user2_id),
    INDEX idx_user1_id (user1_id),
    INDEX idx_user2_id (user2_id),
    INDEX idx_last_message_at (last_message_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 6. DEAL ROOM FILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS deal_room_files (
    file_id INT AUTO_INCREMENT PRIMARY KEY,
    startup_id INT NOT NULL,
    uploader_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    file_type VARCHAR(100), -- application/pdf, image/png, etc.
    file_size BIGINT, -- Size in bytes
    file_category VARCHAR(50), -- 'financials', 'legal', 'pitch_deck', 'other'
    description TEXT,
    is_confidential BOOLEAN DEFAULT TRUE,
    download_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (startup_id) REFERENCES startup_profiles(profile_id) ON DELETE CASCADE,
    FOREIGN KEY (uploader_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_startup_id (startup_id),
    INDEX idx_uploader_id (uploader_id),
    INDEX idx_file_category (file_category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 7. FILE PERMISSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS file_permissions (
    permission_id INT AUTO_INCREMENT PRIMARY KEY,
    file_id INT NOT NULL,
    investor_id INT NOT NULL,
    granted_by INT NOT NULL, -- Startup user who granted access
    can_view BOOLEAN DEFAULT TRUE,
    can_download BOOLEAN DEFAULT TRUE,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL, -- Optional expiration date
    revoked_at TIMESTAMP NULL,
    FOREIGN KEY (file_id) REFERENCES deal_room_files(file_id) ON DELETE CASCADE,
    FOREIGN KEY (investor_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY unique_file_investor (file_id, investor_id),
    INDEX idx_file_id (file_id),
    INDEX idx_investor_id (investor_id),
    INDEX idx_granted_by (granted_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 8. FILE ACCESS LOGS TABLE (Audit Trail)
-- ============================================
CREATE TABLE IF NOT EXISTS file_access_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    file_id INT NOT NULL,
    user_id INT NOT NULL,
    action_type ENUM('view', 'download', 'denied') NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (file_id) REFERENCES deal_room_files(file_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_file_id (file_id),
    INDEX idx_user_id (user_id),
    INDEX idx_accessed_at (accessed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 9. NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    notification_type VARCHAR(50) NOT NULL, -- 'new_message', 'video_comment', 'file_shared', etc.
    reference_id INT, -- ID of the related entity (message_id, video_id, file_id, etc.)
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    link_url VARCHAR(500),
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_is_read (is_read),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TRIGGER: Update conversation metadata on new message
-- ============================================
DELIMITER $$

CREATE TRIGGER after_message_insert
AFTER INSERT ON messages
FOR EACH ROW
BEGIN
    DECLARE conv_exists INT;
    DECLARE user1 INT;
    DECLARE user2 INT;
    
    -- Ensure user1_id < user2_id for consistency
    IF NEW.sender_id < NEW.receiver_id THEN
        SET user1 = NEW.sender_id;
        SET user2 = NEW.receiver_id;
    ELSE
        SET user1 = NEW.receiver_id;
        SET user2 = NEW.sender_id;
    END IF;
    
    -- Check if conversation exists
    SELECT COUNT(*) INTO conv_exists 
    FROM conversations 
    WHERE user1_id = user1 AND user2_id = user2;
    
    IF conv_exists = 0 THEN
        -- Create new conversation
        INSERT INTO conversations (user1_id, user2_id, last_message_id, last_message_at)
        VALUES (user1, user2, NEW.message_id, NEW.created_at);
    ELSE
        -- Update existing conversation
        IF NEW.sender_id = user1 THEN
            UPDATE conversations 
            SET last_message_id = NEW.message_id,
                last_message_at = NEW.created_at,
                user2_unread_count = user2_unread_count + 1
            WHERE user1_id = user1 AND user2_id = user2;
        ELSE
            UPDATE conversations 
            SET last_message_id = NEW.message_id,
                last_message_at = NEW.created_at,
                user1_unread_count = user1_unread_count + 1
            WHERE user1_id = user1 AND user2_id = user2;
        END IF;
    END IF;
    
    -- Create notification for receiver
    INSERT INTO notifications (user_id, notification_type, reference_id, title, message, link_url)
    VALUES (
        NEW.receiver_id,
        'new_message',
        NEW.message_id,
        'New Message',
        CONCAT('You have a new message from ', (SELECT COALESCE(company_name, investor_name, username) FROM users u LEFT JOIN startup_profiles sp ON u.user_id = sp.user_id LEFT JOIN investor_profiles ip ON u.user_id = ip.user_id WHERE u.user_id = NEW.sender_id LIMIT 1)),
        '/messages.html'
    );
END$$

DELIMITER ;

-- ============================================
-- TRIGGER: Update video views count
-- ============================================
DELIMITER $$

CREATE TRIGGER after_video_view_insert
AFTER INSERT ON video_views
FOR EACH ROW
BEGIN
    UPDATE pitch_videos 
    SET views_count = views_count + 1 
    WHERE video_id = NEW.video_id;
END$$

DELIMITER ;

-- ============================================
-- TRIGGER: Update file download count
-- ============================================
DELIMITER $$

CREATE TRIGGER after_file_download_log
AFTER INSERT ON file_access_logs
FOR EACH ROW
BEGIN
    IF NEW.action_type = 'download' THEN
        UPDATE deal_room_files 
        SET download_count = download_count + 1 
        WHERE file_id = NEW.file_id;
    END IF;
END$$

DELIMITER ;

-- ============================================
-- TRIGGER: Notify on video comment
-- ============================================
DELIMITER $$

CREATE TRIGGER after_video_comment_insert
AFTER INSERT ON video_comments
FOR EACH ROW
BEGIN
    DECLARE video_owner_id INT;
    
    -- Get the video owner
    SELECT user_id INTO video_owner_id
    FROM pitch_videos
    WHERE video_id = NEW.video_id;
    
    -- Only notify if commenter is not the video owner
    IF NEW.user_id != video_owner_id THEN
        INSERT INTO notifications (user_id, notification_type, reference_id, title, message, link_url)
        VALUES (
            video_owner_id,
            'video_comment',
            NEW.video_id,
            'New Comment on Your Pitch Video',
            CONCAT((SELECT username FROM users WHERE user_id = NEW.user_id), ' commented on your pitch video'),
            CONCAT('/pitch-room.html?video=', NEW.video_id)
        );
    END IF;
END$$

DELIMITER ;

-- ============================================
-- TRIGGER: Notify on file permission granted
-- ============================================
DELIMITER $$

CREATE TRIGGER after_file_permission_granted
AFTER INSERT ON file_permissions
FOR EACH ROW
BEGIN
    DECLARE file_name_var VARCHAR(255);
    
    -- Get the file name
    SELECT file_name INTO file_name_var
    FROM deal_room_files
    WHERE file_id = NEW.file_id;
    
    INSERT INTO notifications (user_id, notification_type, reference_id, title, message, link_url)
    VALUES (
        NEW.investor_id,
        'file_shared',
        NEW.file_id,
        'New Document Shared',
        CONCAT('A startup has shared "', file_name_var, '" with you'),
        '/deal-room.html'
    );
END$$

DELIMITER ;

-- ============================================
-- Sample Data for Testing
-- ============================================

-- Note: This is just schema. Sample data should be added after 
-- actual user profiles and startups are created through the application.

COMMIT;
