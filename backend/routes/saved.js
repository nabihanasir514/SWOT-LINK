const express = require('express');
const router = express.Router();
const db = require('../config/fileStorage');
const auth = require('../middleware/auth');

// @route   POST /api/saved/save
// @desc    Save/bookmark a match
// @access  Private
router.post('/save', auth, async (req, res) => {
  try {
    const { targetUserId, targetType, notes } = req.body;

    if (!targetUserId || !targetType) {
      return res.status(400).json({
        success: false,
        message: 'Target user ID and type are required'
      });
    }

    // Check if already saved
    const existing = await db.findOne('savedMatches', {
      user_id: req.user.userId,
      target_user_id: parseInt(targetUserId)
    });

    if (existing) {
      // Update notes if already saved
      await db.update('savedMatches',
        { saved_id: existing.saved_id },
        { notes: notes || null }
      );

      return res.json({
        success: true,
        message: 'Match updated',
        data: { savedId: existing.saved_id }
      });
    }

    // Insert new saved match
    const newSave = await db.insert('savedMatches', {
      user_id: req.user.userId,
      target_user_id: parseInt(targetUserId),
      target_type: targetType,
      notes: notes || null,
      saved_at: new Date().toISOString()
    }, 'saved_id');

    res.json({
      success: true,
      message: 'Match saved successfully',
      data: { savedId: newSave.saved_id }
    });
  } catch (error) {
    console.error('Save match error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/saved/unsave/:targetUserId
// @desc    Remove a saved match
// @access  Private
router.delete('/unsave/:targetUserId', auth, async (req, res) => {
  try {
    await db.delete('savedMatches', {
      user_id: req.user.userId,
      target_user_id: parseInt(req.params.targetUserId)
    });

    res.json({
      success: true,
      message: 'Match removed from saved'
    });
  } catch (error) {
    console.error('Unsave match error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/saved/list
// @desc    Get all saved matches for current user
// @access  Private
router.get('/list', auth, async (req, res) => {
  try {
    const role = req.user.roleName;

    // Get all saved matches for this user
    const savedMatches = await db.findMany('savedMatches', {
      user_id: req.user.userId
    });

    // Sort by created_at descending
    savedMatches.sort((a, b) => new Date(b.saved_at || b.created_at) - new Date(a.saved_at || a.created_at));

    const saved = [];

    if (role === 'Investor') {
      // Get saved startups
      for (const match of savedMatches) {
        const user = await db.findOne('users', { user_id: match.target_user_id });
        if (!user) continue;

        const profile = await db.findOne('startupProfiles', { user_id: match.target_user_id });
        if (!profile) continue;

        const industry = profile.industry_id ? await db.findOne('industries', { industry_id: profile.industry_id }) : null;
        const stage = profile.funding_stage_id ? await db.findOne('fundingStages', { stage_id: profile.funding_stage_id }) : null;

        saved.push({
          saved_id: match.saved_id,
          notes: match.notes,
          created_at: match.saved_at || match.created_at,
          profile_id: profile.profile_id,
          company_name: profile.company_name,
          elevator_pitch: profile.elevator_pitch,
          funding_goal: profile.funding_goal,
          industry_id: profile.industry_id,
          industry_name: industry?.industry_name || null,
          funding_stage_id: profile.funding_stage_id,
          stage_name: stage?.stage_name || null,
          location: profile.location,
          team_size: profile.team_size,
          user_id: user.user_id,
          first_name: user.first_name,
          last_name: user.last_name
        });
      }
    } else {
      // Get saved investors
      for (const match of savedMatches) {
        const user = await db.findOne('users', { user_id: match.target_user_id });
        if (!user) continue;

        const profile = await db.findOne('investorProfiles', { user_id: match.target_user_id });
        if (!profile) continue;

        const investorData = {
          saved_id: match.saved_id,
          notes: match.notes,
          created_at: match.saved_at || match.created_at,
          profile_id: profile.profile_id,
          investor_name: profile.investor_name,
          investor_type: profile.investor_type,
          investment_thesis: profile.investment_thesis,
          budget_min: profile.budget_min,
          budget_max: profile.budget_max,
          location: profile.location,
          company: profile.company,
          user_id: user.user_id,
          first_name: user.first_name,
          last_name: user.last_name
        };

        // Parse investor preferences from JSON strings
        try {
          investorData.industries = profile.industries ? JSON.parse(profile.industries) : [];
          investorData.fundingStages = profile.funding_stages ? JSON.parse(profile.funding_stages) : [];
        } catch (e) {
          investorData.industries = [];
          investorData.fundingStages = [];
        }

        saved.push(investorData);
      }
    }

    res.json({
      success: true,
      count: saved.length,
      data: saved
    });
  } catch (error) {
    console.error('Get saved matches error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/saved/check/:targetUserId
// @desc    Check if a match is saved
// @access  Private
router.get('/check/:targetUserId', auth, async (req, res) => {
  try {
    const saved = await db.findOne('savedMatches', {
      user_id: req.user.userId,
      target_user_id: parseInt(req.params.targetUserId)
    });

    res.json({
      success: true,
      isSaved: !!saved
    });
  } catch (error) {
    console.error('Check saved error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/saved/track-view
// @desc    Track when a user views a profile
// @access  Private
router.post('/track-view', auth, async (req, res) => {
  try {
    const { viewedUserId } = req.body;

    if (!viewedUserId) {
      return res.status(400).json({
        success: false,
        message: 'Viewed user ID is required'
      });
    }

    // Insert view record
    await db.insert('profileViews', {
      viewer_user_id: req.user.userId,
      viewed_user_id: parseInt(viewedUserId),
      viewed_at: new Date().toISOString()
    }, 'view_id');

    // Update view count on profile
    const role = req.user.roleName === 'Investor' ? 'startupProfiles' : 'investorProfiles';

    const profile = await db.findOne(role, { user_id: parseInt(viewedUserId) });
    if (profile) {
      await db.update(role,
        { user_id: parseInt(viewedUserId) },
        {
          view_count: (profile.view_count || 0) + 1,
          last_viewed: new Date().toISOString()
        }
      );
    }

    res.json({
      success: true,
      message: 'View tracked'
    });
  } catch (error) {
    console.error('Track view error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
