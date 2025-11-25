const express = require('express');
const router = express.Router();
const db = require('../config/fileStorage');
const auth = require('../middleware/auth');
const matching = require('../utils/matching');

// @route   GET /api/dashboard/startup
// @desc    Get startup dashboard data
// @access  Private (Startup only)
router.get('/startup', auth, auth.requireRole('Startup'), async (req, res) => {
  try {
    // Get startup profile
    const profile = await db.findOne('startupProfiles', { user_id: req.user.userId });
    const hasProfile = !!profile;

    if (hasProfile && profile.industry_id) {
      const industry = await db.findOne('industries', { industry_id: profile.industry_id });
      profile.industry_name = industry ? industry.industry_name : null;
    }

    if (hasProfile && profile.funding_stage_id) {
      const stage = await db.findOne('fundingStages', { stage_id: profile.funding_stage_id });
      profile.stage_name = stage ? stage.stage_name : null;
    }

    // Get match stats if profile exists
    let matchStats = { totalMatches: 0, topMatches: 0 };
    if (hasProfile) {
      try {
        matchStats = await matching.getMatchStats(req.user.userId, 'Startup');
      } catch (err) {
        console.error('Error getting match stats:', err);
      }
    }

    // Get saved count
    const savedMatches = await db.findMany('savedMatches', { user_id: req.user.userId });
    
    // Get messages count - count messages sent or received by this user
    const allMessages = await db.getAll('messages');
    const messageCount = allMessages.filter(m => 
      m.sender_id === req.user.userId || m.receiver_id === req.user.userId
    ).length;

    res.json({
      success: true,
      data: {
        user: {
          fullName: req.user.fullName,
          email: req.user.email
        },
        hasProfile,
        profile: hasProfile ? profile : null,
        stats: {
          profileViews: hasProfile ? profile.view_count || 0 : 0,
          investorMatches: matchStats.totalMatches,
          savedInvestors: savedMatches.length,
          messages: messageCount
        }
      }
    });
  } catch (error) {
    console.error('Startup dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/dashboard/investor
// @desc    Get investor dashboard data
// @access  Private (Investor only)
router.get('/investor', auth, auth.requireRole('Investor'), async (req, res) => {
  try {
    // Get investor profile
    const profile = await db.findOne('investorProfiles', { user_id: req.user.userId });
    const hasProfile = !!profile;

    let industries = [];
    let stages = [];
    let matchStats = { totalMatches: 0, topMatches: 0 };

    if (hasProfile) {
      // Parse industry preferences from JSON
      if (profile.preferred_industries) {
        try {
          const industryIds = JSON.parse(profile.preferred_industries);
          const allIndustries = await db.getAll('industries');
          industries = allIndustries.filter(i => industryIds.includes(i.industry_id));
        } catch (e) {
          industries = [];
        }
      }

      // Parse funding stage preferences from JSON
      if (profile.preferred_stages) {
        try {
          const stageIds = JSON.parse(profile.preferred_stages);
          const allStages = await db.getAll('fundingStages');
          stages = allStages.filter(s => stageIds.includes(s.stage_id));
        } catch (e) {
          stages = [];
        }
      }

      // Get match stats
      try {
        matchStats = await matching.getMatchStats(req.user.userId, 'Investor');
      } catch (err) {
        console.error('Error getting match stats:', err);
      }
    }

    // Get saved count
    const savedMatches = await db.findMany('savedMatches', { user_id: req.user.userId });
    
    // Get messages count - count messages sent or received by this user
    const allMessages = await db.getAll('messages');
    const messageCount = allMessages.filter(m => 
      m.sender_id === req.user.userId || m.receiver_id === req.user.userId
    ).length;

    res.json({
      success: true,
      data: {
        user: {
          fullName: req.user.fullName,
          email: req.user.email
        },
        hasProfile,
        profile: hasProfile ? {
          ...profile,
          industries,
          fundingStages: stages
        } : null,
        stats: {
          startupMatches: matchStats.totalMatches,
          savedStartups: savedMatches.length,
          profileViews: hasProfile ? profile.view_count || 0 : 0,
          messages: messageCount
        }
      }
    });
  } catch (error) {
    console.error('Investor dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/dashboard/industries
// @desc    Get all industries
// @access  Private
router.get('/industries', auth, async (req, res) => {
  try {
    const industries = await db.query('industries', (data) => {
      return data.sort((a, b) => a.industry_name.localeCompare(b.industry_name));
    });

    res.json({
      success: true,
      data: industries
    });
  } catch (error) {
    console.error('Get industries error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/dashboard/funding-stages
// @desc    Get all funding stages
// @access  Private
router.get('/funding-stages', auth, async (req, res) => {
  try {
    const stages = await db.query('fundingStages', (data) => {
      return data.sort((a, b) => (a.typical_range_min || 0) - (b.typical_range_min || 0));
    });

    res.json({
      success: true,
      data: stages
    });
  } catch (error) {
    console.error('Get funding stages error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
