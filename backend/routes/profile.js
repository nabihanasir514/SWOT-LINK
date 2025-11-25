const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/fileStorage');
const auth = require('../middleware/auth');

// Validation rules for startup profile
const startupProfileValidation = [
  body('companyName').trim().notEmpty().withMessage('Company name is required'),
  body('elevatorPitch').trim().notEmpty().withMessage('Elevator pitch is required'),
  body('industryId').isInt().withMessage('Valid industry is required'),
  body('fundingStageId').optional().isInt().withMessage('Valid funding stage required'),
  body('fundingGoal').optional().isFloat({ min: 0 }).withMessage('Valid funding goal required')
];

// Validation rules for investor profile
const investorProfileValidation = [
  body('investorName').trim().notEmpty().withMessage('Investor name is required'),
  body('investorType').isIn(['Angel', 'VC', 'Corporate', 'Private Equity', 'Other']).withMessage('Valid investor type required'),
  body('investmentThesis').trim().notEmpty().withMessage('Investment thesis is required'),
  body('budgetMin').optional().isFloat({ min: 0 }).withMessage('Valid minimum budget required'),
  body('budgetMax').optional().isFloat({ min: 0 }).withMessage('Valid maximum budget required')
];

// @route   POST /api/profile/startup
// @desc    Create/Update startup profile
// @access  Private (Startup only)
router.post('/startup', auth, auth.requireRole('Startup'), startupProfileValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {
      companyName, industryId, fundingStageId, elevatorPitch,
      strengths, weaknesses, opportunities, threats,
      fundingGoal, currency, website, foundedYear, teamSize, location
    } = req.body;

    // Check if profile exists
    const existing = await db.findOne('startupProfiles', { user_id: req.user.userId });

    let result;
    if (existing) {
      // Update existing profile
      await db.update('startupProfiles', 
        { user_id: req.user.userId },
        {
          company_name: companyName,
          industry_id: industryId,
          funding_stage_id: fundingStageId || null,
          elevator_pitch: elevatorPitch,
          strengths: strengths || null,
          weaknesses: weaknesses || null,
          opportunities: opportunities || null,
          threats: threats || null,
          funding_goal: fundingGoal || null,
          currency: currency || 'USD',
          website: website || null,
          founded_year: foundedYear || null,
          team_size: teamSize || null,
          location: location || null
        }
      );
      result = { profileId: existing.startup_profile_id };
    } else {
      // Create new profile
      const insertResult = await db.insert('startupProfiles', {
        user_id: req.user.userId,
        company_name: companyName,
        industry_id: industryId,
        funding_stage_id: fundingStageId || null,
        elevator_pitch: elevatorPitch,
        strengths: strengths || null,
        weaknesses: weaknesses || null,
        opportunities: opportunities || null,
        threats: threats || null,
        funding_goal: fundingGoal || null,
        currency: currency || 'USD',
        website: website || null,
        founded_year: foundedYear || null,
        team_size: teamSize || null,
        location: location || null
      }, 'startup_profile_id');
      result = { profileId: insertResult.insertId };
    }

    res.json({
      success: true,
      message: 'Startup profile saved successfully',
      data: result
    });
  } catch (error) {
    console.error('Startup profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error saving profile'
    });
  }
});

// @route   POST /api/profile/investor
// @desc    Create/Update investor profile
// @access  Private (Investor only)
router.post('/investor', auth, auth.requireRole('Investor'), investorProfileValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {
      investorName, investorType, investmentThesis,
      budgetMin, budgetMax, currency, website, company, location,
      yearsExperience, industries, fundingStages
    } = req.body;

    // Check if profile exists
    const existing = await db.findOne('investorProfiles', { user_id: req.user.userId });

    let profileId;
    if (existing) {
      // Update existing profile
      await db.update('investorProfiles',
        { user_id: req.user.userId },
        {
          investor_name: investorName,
          investor_type: investorType,
          investment_thesis: investmentThesis,
          budget_min: budgetMin || null,
          budget_max: budgetMax || null,
          currency: currency || 'USD',
          website: website || null,
          company: company || null,
          location: location || null,
          years_experience: yearsExperience || null,
          // Store industries and stages as JSON strings for simplicity
          preferred_industries: industries ? JSON.stringify(industries) : null,
          preferred_stages: fundingStages ? JSON.stringify(fundingStages) : null
        }
      );
      profileId = existing.investor_profile_id;
    } else {
      // Create new profile
      const insertResult = await db.insert('investorProfiles', {
        user_id: req.user.userId,
        investor_name: investorName,
        investor_type: investorType,
        investment_thesis: investmentThesis,
        budget_min: budgetMin || null,
        budget_max: budgetMax || null,
        currency: currency || 'USD',
        website: website || null,
        company: company || null,
        location: location || null,
        years_experience: yearsExperience || null,
        preferred_industries: industries ? JSON.stringify(industries) : null,
        preferred_stages: fundingStages ? JSON.stringify(fundingStages) : null
      }, 'investor_profile_id');
      profileId = insertResult.insertId;
    }

    res.json({
      success: true,
      message: 'Investor profile saved successfully',
      data: { profileId }
    });
  } catch (error) {
    console.error('Investor profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error saving profile'
    });
  }
});

// @route   GET /api/profile/startup
// @desc    Get startup profile
// @access  Private (Startup only)
router.get('/startup', auth, auth.requireRole('Startup'), async (req, res) => {
  try {
    const profile = await db.findOne('startupProfiles', { user_id: req.user.userId });

    if (!profile) {
      return res.json({
        success: true,
        data: null,
        message: 'No profile found'
      });
    }

    // Get industry name
    if (profile.industry_id) {
      const industry = await db.findOne('industries', { industry_id: profile.industry_id });
      profile.industry_name = industry ? industry.industry_name : null;
    }

    // Get funding stage name
    if (profile.funding_stage_id) {
      const stage = await db.findOne('fundingStages', { stage_id: profile.funding_stage_id });
      profile.stage_name = stage ? stage.stage_name : null;
    }

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('Get startup profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/profile/investor
// @desc    Get investor profile
// @access  Private (Investor only)
router.get('/investor', auth, auth.requireRole('Investor'), async (req, res) => {
  try {
    const profile = await db.findOne('investorProfiles', { user_id: req.user.userId });

    if (!profile) {
      return res.json({
        success: true,
        data: null,
        message: 'No profile found'
      });
    }

    // Parse stored JSON arrays
    if (profile.preferred_industries) {
      try {
        const industryIds = JSON.parse(profile.preferred_industries);
        const allIndustries = await db.getAll('industries');
        profile.industries = allIndustries.filter(i => industryIds.includes(i.industry_id));
      } catch (e) {
        profile.industries = [];
      }
    } else {
      profile.industries = [];
    }

    if (profile.preferred_stages) {
      try {
        const stageIds = JSON.parse(profile.preferred_stages);
        const allStages = await db.getAll('fundingStages');
        profile.fundingStages = allStages.filter(s => stageIds.includes(s.stage_id));
      } catch (e) {
        profile.fundingStages = [];
      }
    } else {
      profile.fundingStages = [];
    }

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('Get investor profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// ============================================
// PROFILE VIEWS TRACKING
// ============================================
router.post('/track-view/:profileUserId', auth, async (req, res) => {
  try {
    const viewerId = req.user.userId;
    const profileUserId = parseInt(req.params.profileUserId);

    if (viewerId === profileUserId) {
      return res.json({ success: true, message: 'Cannot track own profile view' });
    }

    await db.insert('profileViews', {
      viewer_id: viewerId,
      viewed_user_id: profileUserId,
      view_duration: req.body.duration || 0
    }, 'view_id');

    res.json({ success: true, message: 'Profile view tracked' });
  } catch (error) {
    console.error('Track profile view error:', error);
    res.status(500).json({ success: false, message: 'Failed to track view' });
  }
});

router.get('/views', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const views = await db.getAll('profileViews');
    const userViews = (views || []).filter(v => v.viewed_user_id === userId);

    const users = await db.getAll('users');
    const uMap = new Map(users.map(u => [u.user_id, u]));

    const enriched = userViews.map(v => {
      const viewer = uMap.get(v.viewer_id) || {};
      return {
        ...v,
        viewer_name: viewer.full_name || (viewer.email ? viewer.email.split('@')[0] : ''),
        viewer_role: viewer.role
      };
    }).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('Get profile views error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch profile views' });
  }
});

module.exports = router;
