const db = require('../config/fileStorage');

/**
 * Calculate match score between a startup and investor
 * Returns a score from 0-100 based on compatibility
 */
function calculateMatchScore(startup, investor, investorIndustries, investorStages) {
  let score = 0;
  let maxScore = 0;

  // 1. Industry Match (40 points max)
  maxScore += 40;
  if (startup.industry_id && Array.isArray(investorIndustries) && investorIndustries.some(ind => ind.industry_id === startup.industry_id)) {
    score += 40; // Perfect match
  }

  // 2. Funding Stage Match (30 points max)
  maxScore += 30;
  if (startup.funding_stage_id && Array.isArray(investorStages) && investorStages.some(stage => stage.stage_id === startup.funding_stage_id)) {
    score += 30; // Perfect match
  }

  // 3. Budget Match (30 points max)
  maxScore += 30;
  if (startup.funding_goal && investor.budget_min && investor.budget_max) {
    if (startup.funding_goal >= investor.budget_min && startup.funding_goal <= investor.budget_max) {
      score += 30; // Within budget range
    } else if (startup.funding_goal < investor.budget_min) {
      // Below budget - partial points based on proximity
      const proximity = investor.budget_min > 0 ? (startup.funding_goal / investor.budget_min) : 0;
      score += Math.max(0, Math.min(30, Math.floor(30 * proximity)));
    } else if (startup.funding_goal > investor.budget_max) {
      // Above budget - partial points based on how much over (cap at 15)
      const overage = investor.budget_max > 0 ? (investor.budget_max / startup.funding_goal) : 0;
      score += Math.max(0, Math.min(15, Math.floor(15 * overage)));
    }
  }

  // 4. Location Proximity (10 points max)
  // Lightweight weighting: if both sides have a location string and share a token (city/country),
  // grant points. This is optional and does not penalize if absent.
  maxScore += 10;
  try {
    const sLoc = (startup.location || '').toLowerCase();
    const iLoc = (investor.location || '').toLowerCase();
    if (sLoc && iLoc) {
      const tokens = new Set(sLoc.split(/[,\s]+/).filter(Boolean));
      const overlap = iLoc.split(/[,\s]+/).some(t => tokens.has(t));
      if (overlap) score += 10;
    }
  } catch (_) { /* noop */ }

  // Calculate percentage
  return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
}

exports.calculateMatchScore = calculateMatchScore;

/**
 * Get matching startups for an investor
 */
exports.getMatchingStartups = async (investorUserId, filters = {}) => {
  try {
    // Get investor profile (camelCase collection name)
    const investorProfile = await db.findOne('investorProfiles', { user_id: investorUserId });
    if (!investorProfile) throw new Error('Investor profile not found');

    // Helper to parse stored JSON arrays (may already be array)
    const parsePref = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      try { return JSON.parse(val); } catch { return []; }
    };

    const investorIndustries = parsePref(investorProfile.industries);
    const investorStages = parsePref(investorProfile.funding_stages);

    // Bulk load datasets to avoid repetitive file IO
    const [allStartupsRaw, users, industries, stages] = await Promise.all([
      db.getAll('startupProfiles'),
      db.getAll('users'),
      db.getAll('industries'),
      db.getAll('fundingStages')
    ]);

    const userActiveMap = new Map(users.map(u => [u.user_id, u]));
    const industryMap = new Map(industries.map(i => [i.industry_id, i]));
    const stageMap = new Map(stages.map(s => [s.stage_id, s]));

    const matchingStartups = (allStartupsRaw || []).filter(startup => {
      const user = userActiveMap.get(startup.user_id);
      if (!user || user.is_active !== true) return false;

      // Budget constraints
      if (investorProfile.budget_min && startup.funding_goal < investorProfile.budget_min) return false;
      if (investorProfile.budget_max && startup.funding_goal > investorProfile.budget_max) return false;

      // Industry preference
      if (!filters.ignoreIndustry && investorIndustries.length && startup.industry_id) {
        if (!investorIndustries.some(ind => ind.industry_id === startup.industry_id)) return false;
      }

      // Stage preference
      if (!filters.ignoreStage && investorStages.length && startup.funding_stage_id) {
        if (!investorStages.some(st => st.stage_id === startup.funding_stage_id)) return false;
      }

      // UI filters
      if (filters.industryId && startup.industry_id !== filters.industryId) return false;
      if (filters.stageId && startup.funding_stage_id !== filters.stageId) return false;
      if (filters.minFunding && startup.funding_goal < filters.minFunding) return false;
      if (filters.maxFunding && startup.funding_goal > filters.maxFunding) return false;
      if (filters.location && startup.location && !startup.location.toLowerCase().includes(filters.location.toLowerCase())) return false;
      if (filters.minTeamSize && startup.team_size < filters.minTeamSize) return false;
      return true;
    });

    const startupsWithScores = matchingStartups.map(startup => {
      const user = userActiveMap.get(startup.user_id) || {};
      const industry = startup.industry_id ? industryMap.get(startup.industry_id) : null;
      const stage = startup.funding_stage_id ? stageMap.get(startup.funding_stage_id) : null;
      const matchScore = calculateMatchScore(startup, investorProfile, investorIndustries, investorStages);
      return {
        ...startup,
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        is_verified: !!user.is_verified,
        industry_name: industry?.industry_name || null,
        stage_name: stage?.stage_name || null,
        matchScore
      };
    }).sort((a, b) => b.matchScore - a.matchScore);

    return filters.limit ? startupsWithScores.slice(0, parseInt(filters.limit)) : startupsWithScores;
  } catch (error) {
    console.error('getMatchingStartups error:', error);
    return [];
  }
};

/**
 * Get matching investors for a startup
 */
exports.getMatchingInvestors = async (startupUserId, filters = {}) => {
  try {
    const startupProfile = await db.findOne('startupProfiles', { user_id: startupUserId });
    if (!startupProfile) throw new Error('Startup profile not found');

    // Load reference data
    const [industries, stages, investorProfiles, users] = await Promise.all([
      db.getAll('industries'),
      db.getAll('fundingStages'),
      db.getAll('investorProfiles'),
      db.getAll('users')
    ]);

    const industryMap = new Map(industries.map(i => [i.industry_id, i]));
    const stageMap = new Map(stages.map(s => [s.stage_id, s]));
    const userMap = new Map(users.map(u => [u.user_id, u]));

    startupProfile.industry_name = startupProfile.industry_id ? industryMap.get(startupProfile.industry_id)?.industry_name || null : null;
    startupProfile.stage_name = startupProfile.funding_stage_id ? stageMap.get(startupProfile.funding_stage_id)?.stage_name || null : null;

    const activeInvestors = (investorProfiles || []).filter(inv => {
      const user = userMap.get(inv.user_id);
      return user && user.is_active === true;
    });

    const parsePref = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      try { return JSON.parse(val); } catch { return []; }
    };

    const investorsWithDetails = activeInvestors.map(investor => {
      const user = userMap.get(investor.user_id) || {};
      const industriesPref = parsePref(investor.industries);
      const stagesPref = parsePref(investor.funding_stages);

      // Base filters
      if (startupProfile.funding_goal && investor.budget_max && investor.budget_max < startupProfile.funding_goal) return null;
      if (filters.investorType && investor.investor_type !== filters.investorType) return null;
      if (filters.minBudget && investor.budget_min < filters.minBudget) return null;
      if (filters.maxBudget && investor.budget_max > filters.maxBudget) return null;
      if (filters.location && investor.location && !investor.location.toLowerCase().includes(filters.location.toLowerCase())) return null;

      let isMatch = true;
      if (!filters.ignoreIndustry && industriesPref.length && startupProfile.industry_id) {
        if (!industriesPref.some(ind => ind.industry_id === startupProfile.industry_id)) isMatch = false;
      }
      if (!filters.ignoreStage && stagesPref.length && startupProfile.funding_stage_id) {
        if (!stagesPref.some(st => st.stage_id === startupProfile.funding_stage_id)) isMatch = false;
      }

      const matchScore = calculateMatchScore(startupProfile, investor, industriesPref, stagesPref);
      return {
        ...investor,
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        is_verified: !!user.is_verified,
        industries: industriesPref,
        stages: stagesPref,
        matchScore,
        isMatch
      };
    }).filter(Boolean);

    const filtered = filters.showAll ? investorsWithDetails : investorsWithDetails.filter(inv => inv.isMatch);
    filtered.sort((a, b) => b.matchScore - a.matchScore);
    return filters.limit ? filtered.slice(0, parseInt(filters.limit)) : filtered;
  } catch (error) {
    console.error('getMatchingInvestors error:', error);
    return [];
  }
};

/**
 * Get match statistics
 */
exports.getMatchStats = async (userId, userRole) => {
  try {
    let matches = [];
    if (userRole === 'Investor') {
      matches = await exports.getMatchingStartups(userId, {});
    } else if (userRole === 'Startup') {
      matches = await exports.getMatchingInvestors(userId, {});
    }
    const totalMatches = matches.length;
    const topMatches = matches.filter(m => m.matchScore >= 80).length;
    return { totalMatches, topMatches, goodMatches: totalMatches - topMatches };
  } catch (error) {
    console.error('getMatchStats error:', error);
    return { totalMatches: 0, topMatches: 0, goodMatches: 0 };
  }
};

module.exports = exports;
