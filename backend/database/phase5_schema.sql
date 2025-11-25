what-- ============================================
-- SWOT LINK - Phase 5 Database Schema
-- Admin Panel & Community Forum
-- ============================================

-- ============================================
-- 1. ADMIN USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS admin_users (
    admin_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    admin_level ENUM('super_admin', 'moderator', 'support') DEFAULT 'moderator',
    permissions JSON, -- Store specific permissions
    assigned_by INT,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    last_action_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES admin_users(admin_id) ON DELETE SET NULL,
    UNIQUE KEY unique_admin_user (user_id),
    INDEX idx_admin_level (admin_level),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 2. KYC DOCUMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS kyc_documents (
    document_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    document_type ENUM('identity', 'business_registration', 'tax_certificate', 'bank_statement', 'pitch_deck', 'financial_statement', 'other') NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INT NOT NULL, -- In bytes
    mime_type VARCHAR(100),
    verification_status ENUM('pending', 'approved', 'rejected', 'resubmit_required') DEFAULT 'pending',
    verified_by INT,
    verification_notes TEXT,
    verified_at TIMESTAMP NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expiry_date DATE NULL, -- For documents that expire
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (verified_by) REFERENCES admin_users(admin_id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_verification_status (verification_status),
    INDEX idx_document_type (document_type),
    INDEX idx_uploaded_at (uploaded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 3. USER VERIFICATION TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_verifications (
    verification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    verification_type ENUM('email', 'phone', 'identity', 'business', 'accredited_investor') NOT NULL,
    verification_status ENUM('pending', 'verified', 'failed', 'expired') DEFAULT 'pending',
    verification_method VARCHAR(100), -- e.g., 'document_upload', 'third_party_api'
    verification_data JSON, -- Store verification details
    verified_by INT,
    verified_at TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (verified_by) REFERENCES admin_users(admin_id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_verification_type (verification_type),
    INDEX idx_verification_status (verification_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 4. ADMIN ACTION LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS admin_action_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    admin_id INT NOT NULL,
    action_type VARCHAR(50) NOT NULL, -- e.g., 'user_suspend', 'document_approve', 'post_delete'
    target_type VARCHAR(50), -- e.g., 'user', 'document', 'post'
    target_id INT,
    action_details JSON, -- Store details of the action
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES admin_users(admin_id) ON DELETE CASCADE,
    INDEX idx_admin_id (admin_id),
    INDEX idx_action_type (action_type),
    INDEX idx_target (target_type, target_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 5. USER REPORTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_reports (
    report_id INT AUTO_INCREMENT PRIMARY KEY,
    reporter_id INT NOT NULL,
    reported_user_id INT,
    reported_content_type ENUM('user', 'post', 'comment', 'message', 'video') NOT NULL,
    reported_content_id INT,
    report_reason ENUM('spam', 'harassment', 'inappropriate_content', 'fraud', 'fake_profile', 'other') NOT NULL,
    report_description TEXT,
    status ENUM('pending', 'investigating', 'resolved', 'dismissed') DEFAULT 'pending',
    assigned_to INT,
    resolution_notes TEXT,
    resolved_by INT,
    resolved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reporter_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (reported_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES admin_users(admin_id) ON DELETE SET NULL,
    FOREIGN KEY (resolved_by) REFERENCES admin_users(admin_id) ON DELETE SET NULL,
    INDEX idx_reporter_id (reporter_id),
    INDEX idx_reported_user_id (reported_user_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 6. FORUM CATEGORIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS forum_categories (
    category_id INT AUTO_INCREMENT PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL UNIQUE,
    category_slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(50), -- Font Awesome class
    display_order INT DEFAULT 0,
    parent_category_id INT NULL, -- For subcategories
    is_active BOOLEAN DEFAULT TRUE,
    post_count INT DEFAULT 0,
    last_post_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_category_id) REFERENCES forum_categories(category_id) ON DELETE SET NULL,
    INDEX idx_parent_category (parent_category_id),
    INDEX idx_display_order (display_order),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 7. FORUM POSTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS forum_posts (
    post_id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_pinned BOOLEAN DEFAULT FALSE,
    is_locked BOOLEAN DEFAULT FALSE,
    view_count INT DEFAULT 0,
    reply_count INT DEFAULT 0,
    like_count INT DEFAULT 0,
    last_reply_at TIMESTAMP NULL,
    last_reply_by INT,
    status ENUM('active', 'hidden', 'deleted') DEFAULT 'active',
    moderated_by INT,
    moderation_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES forum_categories(category_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (last_reply_by) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (moderated_by) REFERENCES admin_users(admin_id) ON DELETE SET NULL,
    INDEX idx_category_id (category_id),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    INDEX idx_last_reply_at (last_reply_at),
    INDEX idx_is_pinned (is_pinned),
    FULLTEXT idx_search (title, content)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 8. FORUM REPLIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS forum_replies (
    reply_id INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT NOT NULL,
    user_id INT NOT NULL,
    parent_reply_id INT NULL, -- For nested replies
    content TEXT NOT NULL,
    like_count INT DEFAULT 0,
    is_solution BOOLEAN DEFAULT FALSE, -- Mark as accepted answer
    status ENUM('active', 'hidden', 'deleted') DEFAULT 'active',
    moderated_by INT,
    moderation_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES forum_posts(post_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (parent_reply_id) REFERENCES forum_replies(reply_id) ON DELETE CASCADE,
    FOREIGN KEY (moderated_by) REFERENCES admin_users(admin_id) ON DELETE SET NULL,
    INDEX idx_post_id (post_id),
    INDEX idx_user_id (user_id),
    INDEX idx_parent_reply_id (parent_reply_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    FULLTEXT idx_content_search (content)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 9. FORUM POST LIKES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS forum_post_likes (
    like_id INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT NOT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES forum_posts(post_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY unique_post_like (post_id, user_id),
    INDEX idx_post_id (post_id),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 10. FORUM REPLY LIKES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS forum_reply_likes (
    like_id INT AUTO_INCREMENT PRIMARY KEY,
    reply_id INT NOT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reply_id) REFERENCES forum_replies(reply_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY unique_reply_like (reply_id, user_id),
    INDEX idx_reply_id (reply_id),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 11. USER SUSPENSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_suspensions (
    suspension_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    suspended_by INT NOT NULL,
    reason TEXT NOT NULL,
    suspension_type ENUM('temporary', 'permanent') DEFAULT 'temporary',
    starts_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ends_at TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (suspended_by) REFERENCES admin_users(admin_id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_is_active (is_active),
    INDEX idx_ends_at (ends_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TRIGGERS
-- ============================================

-- Update forum post count when post created
DELIMITER $$

CREATE TRIGGER after_forum_post_insert
AFTER INSERT ON forum_posts
FOR EACH ROW
BEGIN
    UPDATE forum_categories
    SET post_count = post_count + 1,
        last_post_id = NEW.post_id
    WHERE category_id = NEW.category_id;
END$$

DELIMITER ;

-- Update forum post count when post deleted
DELIMITER $$

CREATE TRIGGER after_forum_post_delete
AFTER DELETE ON forum_posts
FOR EACH ROW
BEGIN
    UPDATE forum_categories
    SET post_count = GREATEST(post_count - 1, 0)
    WHERE category_id = OLD.category_id;
END$$

DELIMITER ;

-- Update reply count and last reply when reply created
DELIMITER $$

CREATE TRIGGER after_forum_reply_insert
AFTER INSERT ON forum_replies
FOR EACH ROW
BEGIN
    UPDATE forum_posts
    SET reply_count = reply_count + 1,
        last_reply_at = NEW.created_at,
        last_reply_by = NEW.user_id
    WHERE post_id = NEW.post_id;
END$$

DELIMITER ;

-- Update reply count when reply deleted
DELIMITER $$

CREATE TRIGGER after_forum_reply_delete
AFTER DELETE ON forum_replies
FOR EACH ROW
BEGIN
    UPDATE forum_posts
    SET reply_count = GREATEST(reply_count - 1, 0)
    WHERE post_id = OLD.post_id;
END$$

DELIMITER ;

-- Update like count when post liked
DELIMITER $$

CREATE TRIGGER after_post_like_insert
AFTER INSERT ON forum_post_likes
FOR EACH ROW
BEGIN
    UPDATE forum_posts
    SET like_count = like_count + 1
    WHERE post_id = NEW.post_id;
END$$

DELIMITER ;

-- Update like count when post unliked
DELIMITER $$

CREATE TRIGGER after_post_like_delete
AFTER DELETE ON forum_post_likes
FOR EACH ROW
BEGIN
    UPDATE forum_posts
    SET like_count = GREATEST(like_count - 1, 0)
    WHERE post_id = OLD.post_id;
END$$

DELIMITER ;

-- Update like count when reply liked
DELIMITER $$

CREATE TRIGGER after_reply_like_insert
AFTER INSERT ON forum_reply_likes
FOR EACH ROW
BEGIN
    UPDATE forum_replies
    SET like_count = like_count + 1
    WHERE reply_id = NEW.reply_id;
END$$

DELIMITER ;

-- Update like count when reply unliked
DELIMITER $$

CREATE TRIGGER after_reply_like_delete
AFTER DELETE ON forum_reply_likes
FOR EACH ROW
BEGIN
    UPDATE forum_replies
    SET like_count = GREATEST(like_count - 1, 0)
    WHERE reply_id = OLD.reply_id;
END$$

DELIMITER ;

-- Log admin actions when documents verified
DELIMITER $$

CREATE TRIGGER after_document_verification
AFTER UPDATE ON kyc_documents
FOR EACH ROW
BEGIN
    IF NEW.verification_status != OLD.verification_status AND NEW.verified_by IS NOT NULL THEN
        INSERT INTO admin_action_logs (admin_id, action_type, target_type, target_id, action_details)
        VALUES (
            NEW.verified_by,
            'document_verify',
            'kyc_document',
            NEW.document_id,
            JSON_OBJECT(
                'old_status', OLD.verification_status,
                'new_status', NEW.verification_status,
                'user_id', NEW.user_id
            )
        );
    END IF;
END$$

DELIMITER ;

-- ============================================
-- INSERT DEFAULT DATA
-- ============================================

-- Default forum categories
INSERT INTO forum_categories (category_name, category_slug, description, icon, display_order) VALUES
('General Discussion', 'general', 'General conversations about startups and investing', 'fa-solid fa-comments', 1),
('Fundraising Tips', 'fundraising', 'Share and discuss fundraising strategies', 'fa-solid fa-money-bill-trend-up', 2),
('Investor Insights', 'investor-insights', 'Investors share their perspectives', 'fa-solid fa-lightbulb', 3),
('Success Stories', 'success-stories', 'Share your wins and milestones', 'fa-solid fa-trophy', 4),
('Product Development', 'product-dev', 'Discuss product strategy and development', 'fa-solid fa-code', 5),
('Marketing & Growth', 'marketing', 'Marketing strategies and growth hacking', 'fa-solid fa-chart-line', 6),
('Legal & Compliance', 'legal', 'Legal questions and compliance issues', 'fa-solid fa-gavel', 7),
('Networking Events', 'events', 'Upcoming events and meetups', 'fa-solid fa-calendar', 8),
('Platform Feedback', 'feedback', 'Suggestions and bug reports for SWOT Link', 'fa-solid fa-bug', 9),
('Off-Topic', 'off-topic', 'Everything else', 'fa-solid fa-coffee', 10);

-- Add is_verified and is_suspended columns to users table if not exists
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP NULL,
ADD INDEX IF NOT EXISTS idx_is_verified (is_verified),
ADD INDEX IF NOT EXISTS idx_is_suspended (is_suspended);

-- Add admin_notes column to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS admin_notes TEXT;

COMMIT;
