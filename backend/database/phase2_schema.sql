-- Phase 2: Matching & Discovery Tables

USE swot_link_db;

-- ============================================
-- Table: Saved Matches (Bookmarks)
-- ============================================
CREATE TABLE IF NOT EXISTS saved_matches (
    saved_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    target_user_id INT NOT NULL,
    target_type ENUM('Startup', 'Investor') NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (target_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY unique_save (user_id, target_user_id),
    INDEX idx_user (user_id),
    INDEX idx_target (target_user_id)
);

-- ============================================
-- Table: Match Views (Track who viewed whom)
-- ============================================
CREATE TABLE IF NOT EXISTS match_views (
    view_id INT PRIMARY KEY AUTO_INCREMENT,
    viewer_user_id INT NOT NULL,
    viewed_user_id INT NOT NULL,
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (viewer_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (viewed_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_viewer (viewer_user_id),
    INDEX idx_viewed (viewed_user_id),
    INDEX idx_viewed_at (viewed_at)
);

-- ============================================
-- Update Users Table - Add view counter
-- ============================================
ALTER TABLE startup_profiles 
ADD COLUMN IF NOT EXISTS view_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_viewed TIMESTAMP NULL;

ALTER TABLE investor_profiles 
ADD COLUMN IF NOT EXISTS view_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_viewed TIMESTAMP NULL;
