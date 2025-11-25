-- SWOT Link Database Schema
-- Phase 1: Foundation & User Management

-- Create Database
CREATE DATABASE IF NOT EXISTS swot_link_db;
USE swot_link_db;

-- ============================================
-- Table: Roles
-- ============================================
CREATE TABLE IF NOT EXISTS roles (
    role_id INT PRIMARY KEY AUTO_INCREMENT,
    role_name ENUM('Startup', 'Investor', 'Admin') NOT NULL UNIQUE,
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default roles
INSERT INTO roles (role_name, description) VALUES
    ('Startup', 'Startup seeking funding'),
    ('Investor', 'Investor looking to invest'),
    ('Admin', 'System administrator');

-- ============================================
-- Table: Users
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role_id INT NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    FOREIGN KEY (role_id) REFERENCES roles(role_id),
    INDEX idx_email (email),
    INDEX idx_role (role_id)
);

-- ============================================
-- Table: Industries
-- ============================================
CREATE TABLE IF NOT EXISTS industries (
    industry_id INT PRIMARY KEY AUTO_INCREMENT,
    industry_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert common industries
INSERT INTO industries (industry_name, description) VALUES
    ('Technology', 'Software, hardware, IT services'),
    ('Healthcare', 'Medical devices, pharmaceuticals, health services'),
    ('Finance', 'Fintech, banking, insurance'),
    ('E-commerce', 'Online retail, marketplaces'),
    ('Education', 'Edtech, online learning, training'),
    ('Real Estate', 'Property tech, construction'),
    ('Food & Beverage', 'Restaurants, food delivery, food tech'),
    ('Energy', 'Renewable energy, clean tech'),
    ('Transportation', 'Logistics, mobility, automotive'),
    ('Entertainment', 'Media, gaming, content creation'),
    ('Agriculture', 'Agtech, farming innovations'),
    ('Manufacturing', 'Industrial, production, supply chain'),
    ('Other', 'Other industries');

-- ============================================
-- Table: Funding Stages
-- ============================================
CREATE TABLE IF NOT EXISTS funding_stages (
    stage_id INT PRIMARY KEY AUTO_INCREMENT,
    stage_name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    typical_range_min DECIMAL(15, 2),
    typical_range_max DECIMAL(15, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert funding stages
INSERT INTO funding_stages (stage_name, description, typical_range_min, typical_range_max) VALUES
    ('Pre-Seed', 'Initial funding to develop idea', 10000, 500000),
    ('Seed', 'Early-stage funding for product development', 500000, 2000000),
    ('Series A', 'Scaling product and market fit', 2000000, 15000000),
    ('Series B', 'Expanding market reach', 15000000, 50000000),
    ('Series C+', 'Later stage growth funding', 50000000, 500000000),
    ('Bridge', 'Short-term funding between rounds', 100000, 5000000);

-- ============================================
-- Table: Startup Profiles
-- ============================================
CREATE TABLE IF NOT EXISTS startup_profiles (
    profile_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE,
    company_name VARCHAR(255) NOT NULL,
    industry_id INT,
    funding_stage_id INT,
    elevator_pitch TEXT NOT NULL,
    
    -- Manual SWOT Analysis fields
    strengths TEXT,
    weaknesses TEXT,
    opportunities TEXT,
    threats TEXT,
    
    -- Funding Information
    funding_goal DECIMAL(15, 2),
    currency VARCHAR(10) DEFAULT 'USD',
    
    -- Additional Information
    website VARCHAR(255),
    founded_year INT,
    team_size INT,
    location VARCHAR(255),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (industry_id) REFERENCES industries(industry_id),
    FOREIGN KEY (funding_stage_id) REFERENCES funding_stages(stage_id),
    INDEX idx_industry (industry_id),
    INDEX idx_funding_stage (funding_stage_id)
);

-- ============================================
-- Table: Investor Profiles
-- ============================================
CREATE TABLE IF NOT EXISTS investor_profiles (
    profile_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE,
    investor_name VARCHAR(255) NOT NULL,
    investor_type ENUM('Angel', 'VC', 'Corporate', 'Private Equity', 'Other') NOT NULL,
    
    -- Investment Thesis
    investment_thesis TEXT NOT NULL,
    
    -- Budget Range
    budget_min DECIMAL(15, 2),
    budget_max DECIMAL(15, 2),
    currency VARCHAR(10) DEFAULT 'USD',
    
    -- Additional Information
    website VARCHAR(255),
    company VARCHAR(255),
    location VARCHAR(255),
    years_experience INT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- ============================================
-- Table: Investor Industry Preferences
-- ============================================
CREATE TABLE IF NOT EXISTS investor_industry_preferences (
    preference_id INT PRIMARY KEY AUTO_INCREMENT,
    investor_profile_id INT NOT NULL,
    industry_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (investor_profile_id) REFERENCES investor_profiles(profile_id) ON DELETE CASCADE,
    FOREIGN KEY (industry_id) REFERENCES industries(industry_id),
    UNIQUE KEY unique_preference (investor_profile_id, industry_id),
    INDEX idx_investor (investor_profile_id),
    INDEX idx_industry (industry_id)
);

-- ============================================
-- Table: Investor Funding Stage Preferences
-- ============================================
CREATE TABLE IF NOT EXISTS investor_stage_preferences (
    preference_id INT PRIMARY KEY AUTO_INCREMENT,
    investor_profile_id INT NOT NULL,
    stage_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (investor_profile_id) REFERENCES investor_profiles(profile_id) ON DELETE CASCADE,
    FOREIGN KEY (stage_id) REFERENCES funding_stages(stage_id),
    UNIQUE KEY unique_stage_preference (investor_profile_id, stage_id),
    INDEX idx_investor (investor_profile_id),
    INDEX idx_stage (stage_id)
);
