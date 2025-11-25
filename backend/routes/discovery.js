const express = require('express');
const router = express.Router();
const db = require('../config/fileStorage');
const auth = require('../middleware/auth');
const matching = require('../utils/matching');

// @route   GET /api/discovery/startups
// @desc    Get matching startups for investor (with filters)
// @access  Private (Investor only)
router.get('/startups', auth, auth.requireRole('Investor'), async (req, res) => {
  try {
    const filters = {
      industryId: req.query.industryId ? parseInt(req.query.industryId) : null,
      stageId: req.query.stageId ? parseInt(req.query.stageId) : null,
      minFunding: req.query.minFunding ? parseFloat(req.query.minFunding) : null,
      maxFunding: req.query.maxFunding ? parseFloat(req.query.maxFunding) : null,
      location: req.query.location || null,
      minTeamSize: req.query.minTeamSize ? parseInt(req.query.minTeamSize) : null,
      ignoreIndustry: req.query.ignoreIndustry === 'true',
      ignoreStage: req.query.ignoreStage === 'true',
      limit: req.query.limit ? parseInt(req.query.limit) : null,
      featuredOnly: req.query.featured === 'true',
      hotOnly: req.query.hot === 'true',
      search: req.query.search || null
    };

  let startups = await matching.getMatchingStartups(req.user.userId, filters);

    // Apply text search filter if provided
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      startups = startups.filter(s => 
        s.company_name?.toLowerCase().includes(searchLower) ||
        s.elevator_pitch?.toLowerCase().includes(searchLower) ||
        s.location?.toLowerCase().includes(searchLower) ||
        s.industry_name?.toLowerCase().includes(searchLower)
      );
    }

    if (filters.featuredOnly) {
      startups = startups.filter(s => !!s.is_featured);
    }
    if (filters.hotOnly) {
      startups = startups.filter(s => !!s.is_hot);
    }

    res.json({
      success: true,
      count: startups.length,
      data: startups
    });
  } catch (error) {
    console.error('Get matching startups error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
});

// @route   GET /api/discovery/investors
// @desc    Get matching investors for startup (with filters)
// @access  Private (Startup only)
router.get('/investors', auth, auth.requireRole('Startup'), async (req, res) => {
  try {
    const filters = {
      investorType: req.query.investorType || null,
      minBudget: req.query.minBudget ? parseFloat(req.query.minBudget) : null,
      maxBudget: req.query.maxBudget ? parseFloat(req.query.maxBudget) : null,
      location: req.query.location || null,
      ignoreIndustry: req.query.ignoreIndustry === 'true',
      ignoreStage: req.query.ignoreStage === 'true',
      showAll: req.query.showAll === 'true',
      limit: req.query.limit ? parseInt(req.query.limit) : null,
      search: req.query.search || null
    };

  let investors = await matching.getMatchingInvestors(req.user.userId, filters);

    // Apply text search filter if provided
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      investors = investors.filter(i => 
        i.investor_name?.toLowerCase().includes(searchLower) ||
        i.investment_thesis?.toLowerCase().includes(searchLower) ||
        i.location?.toLowerCase().includes(searchLower) ||
        i.investor_type?.toLowerCase().includes(searchLower)
      );
    }

    res.json({
      success: true,
      count: investors.length,
      data: investors
    });
  } catch (error) {
    console.error('Get matching investors error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
});

// @route   GET /api/discovery/startup/:id
// @desc    Get single startup details
// @access  Private (Investor only)
router.get('/startup/:id', auth, auth.requireRole('Investor'), async (req, res) => {
  try {
    const startupProfile = await db.findOne('startupProfiles', { profile_id: parseInt(req.params.id) });

    if (!startupProfile) {
      return res.status(404).json({
        success: false,
        message: 'Startup not found'
      });
    }

    const user = await db.findOne('users', { user_id: startupProfile.user_id });
    if (!user || !user.is_active) {
      return res.status(404).json({
        success: false,
        message: 'Startup not found'
      });
    }

    // Get industry and stage details
    const industry = startupProfile.industry_id ? await db.findOne('industries', { industry_id: startupProfile.industry_id }) : null;
    const stage = startupProfile.funding_stage_id ? await db.findOne('fundingStages', { stage_id: startupProfile.funding_stage_id }) : null;

    // Calculate match score with current investor
    let matchScore = 0;
    const investorProfile = await db.findOne('investorProfiles', { user_id: req.user.userId });
    
    if (investorProfile) {
      let investorIndustries = [];
      let investorStages = [];
      
      try {
        investorIndustries = investorProfile.industries ? JSON.parse(investorProfile.industries) : [];
        investorStages = investorProfile.funding_stages ? JSON.parse(investorProfile.funding_stages) : [];
      } catch (e) {
        console.error('Error parsing investor preferences:', e);
      }

      // Use calculateMatchScore from matching utils
      if (typeof matching.calculateMatchScore === 'function') {
        matchScore = matching.calculateMatchScore(startupProfile, investorProfile, investorIndustries, investorStages);
      }
    }

    res.json({
      success: true,
      data: {
        ...startupProfile,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        industry_name: industry?.industry_name || null,
        stage_name: stage?.stage_name || null,
        matchScore
      }
    });
  } catch (error) {
    console.error('Get startup details error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/discovery/investor/:id
// @desc    Get single investor details
// @access  Private (Startup only)
router.get('/investor/:id', auth, auth.requireRole('Startup'), async (req, res) => {
  try {
    const investorProfile = await db.findOne('investorProfiles', { profile_id: parseInt(req.params.id) });

    if (!investorProfile) {
      return res.status(404).json({
        success: false,
        message: 'Investor not found'
      });
    }

    const user = await db.findOne('users', { user_id: investorProfile.user_id });
    if (!user || !user.is_active) {
      return res.status(404).json({
        success: false,
        message: 'Investor not found'
      });
    }

    // Parse investor preferences from JSON
    let industries = [];
    let stages = [];
    
    try {
  industries = investorProfile.industries ? (Array.isArray(investorProfile.industries) ? investorProfile.industries : JSON.parse(investorProfile.industries)) : [];
  stages = investorProfile.funding_stages ? (Array.isArray(investorProfile.funding_stages) ? investorProfile.funding_stages : JSON.parse(investorProfile.funding_stages)) : [];
    } catch (e) {
      console.error('Error parsing investor preferences:', e);
    }

    res.json({
      success: true,
      data: {
        ...investorProfile,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        industries,
        stages
      }
    });
  } catch (error) {
    console.error('Get investor details error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/discovery/match-stats
// @desc    Get match statistics for current user
// @access  Private
router.get('/match-stats', auth, async (req, res) => {
  try {
    const stats = await matching.getMatchStats(req.user.userId, req.user.roleName);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get match stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
