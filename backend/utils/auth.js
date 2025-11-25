/**
 * Authentication Utilities - File Storage Version
 * Handles user registration, login, and JWT token management using file-based storage
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/fileStorage');

/**
 * Register a new user
 */
async function registerUser(fullName, email, password, role) {
    try {
        // Check if user already exists
        const existingUser = await db.findOne('users', { email });
        if (existingUser) {
            return { success: false, message: 'Email already registered' };
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user object
        const userData = {
            full_name: fullName,
            email,
            password_hash: hashedPassword,
            role,
            is_verified: false,
            is_suspended: false,
            profile_completion: 0,
            last_login: null
        };

        // Insert user
        const result = await db.insert('users', userData, 'user_id');
        const userId = result.insertId;

        // Create role-specific profile
        if (role === 'Startup') {
            await db.insert('startupProfiles', {
                user_id: userId,
                company_name: null,
                location: null,
                industry_id: null,
                funding_stage_id: null,
                target_funding_amount: null,
                problem_statement: null,
                solution_overview: null,
                business_model: null,
                market_size: null,
                traction: null,
                team_size: null,
                website_url: null,
                pitch_deck_url: null
            }, 'startup_profile_id');
        } else if (role === 'Investor') {
            await db.insert('investorProfiles', {
                user_id: userId,
                investor_type: null,
                investment_range_min: null,
                investment_range_max: null,
                preferred_industries: null,
                preferred_stages: null,
                location: null,
                portfolio_description: null,
                investment_criteria: null,
                previous_investments: null,
                linkedin_url: null
            }, 'investor_profile_id');
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId, email, role },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );

        return {
            success: true,
            user: {
                userId,
                fullName,
                email,
                role
            },
            token
        };
    } catch (error) {
        console.error('Registration error:', error);
        return { success: false, message: 'Registration failed' };
    }
}

/**
 * Login user
 */
async function loginUser(email, password) {
    try {
        // Find user
        const user = await db.findOne('users', { email });
        if (!user) {
            return { success: false, message: 'Invalid email or password' };
        }

        // Check if suspended
        if (user.is_suspended) {
            return { success: false, message: 'Account suspended. Contact support.' };
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return { success: false, message: 'Invalid email or password' };
        }

        // Update last login
        await db.update('users', { user_id: user.user_id }, {
            last_login: new Date().toISOString()
        });

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.user_id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );

        return {
            success: true,
            user: {
                userId: user.user_id,
                fullName: user.full_name,
                email: user.email,
                role: user.role,
                profileCompletion: user.profile_completion,
                isVerified: user.is_verified
            },
            token
        };
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, message: 'Login failed' };
    }
}

/**
 * Get user by ID
 */
async function getUserById(userId) {
    try {
        const user = await db.findOne('users', { user_id: userId });
        if (!user) return null;

        // Remove sensitive data
        delete user.password_hash;
        return user;
    } catch (error) {
        console.error('Get user error:', error);
        return null;
    }
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (error) {
        return null;
    }
}

module.exports = {
    registerUser,
    loginUser,
    getUserById,
    verifyToken
};
