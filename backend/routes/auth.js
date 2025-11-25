const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { registerUser, loginUser, getUserById } = require('../utils/auth');

// Validation rules
const signupValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  // Accept either fullName OR firstName+lastName
  body('fullName').optional().isString().trim(),
  body('firstName').optional().isString().trim(),
  body('lastName').optional().isString().trim(),
  body('role').isIn(['Startup', 'Investor']).withMessage('Role must be Startup or Investor')
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
];

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
async function handleRegister(req, res) {
  try {
    console.log('[AUTH] Register attempt');
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.warn('[AUTH] Register validation failed', errors.array());
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email, password, fullName, firstName, lastName, role } = req.body;
    const resolvedFullName = fullName && fullName.trim().length > 0
      ? fullName.trim()
      : `${(firstName || '').trim()} ${(lastName || '').trim()}`.trim();

    if (!resolvedFullName) {
      return res.status(400).json({ success: false, message: 'Full name is required' });
    }

    // Register user
  const result = await registerUser(resolvedFullName, email, password, role);
  console.log('[AUTH] Register result:', result.success ? 'success' : 'fail');

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(201).json(result);
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
}

// Support both /register and /signup
router.post('/register', signupValidation, handleRegister);
router.post('/signup', signupValidation, handleRegister);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', loginValidation, async (req, res) => {
  try {
    console.log('[AUTH] Login attempt');
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.warn('[AUTH] Login validation failed', errors.array());
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Login user
  const result = await loginUser(email, password);
  console.log('[AUTH] Login result:', result.success ? 'success' : 'fail');

    if (!result.success) {
      return res.status(401).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user info
// @access  Private
router.get('/me', require('../middleware/auth'), async (req, res) => {
  try {
    const user = await getUserById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
