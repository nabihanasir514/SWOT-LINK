// API Configuration
const API_URL = 'http://localhost:3000/api';

// Get token and role
function getToken() {
  return localStorage.getItem('token');
}

function getRole() {
  return localStorage.getItem('role');
}

// Check authentication
function requireAuth() {
  const token = getToken();
  if (!token) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

// Logout function
function logout() {
  localStorage.clear();
  window.location.href = 'index.html';
}

// Current results storage
let currentResults = [];

// Initialize page
window.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth()) return;

  const role = getRole();
  
  // Setup logout
  const logoutLink = document.getElementById('logoutLink');
  if (logoutLink) {
    logoutLink.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
  }

  // Load filter options
  await loadFilterOptions();

  // Load initial results
  await loadResults();
});

// Load filter options (industries and stages)
async function loadFilterOptions() {
  try {
    const role = getRole();

    if (role === 'Investor') {
      // Load industries
      const industriesResponse = await fetch(`${API_URL}/dashboard/industries`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const industriesData = await industriesResponse.json();

      if (industriesData.success) {
        const select = document.getElementById('filterIndustry');
        industriesData.data.forEach(ind => {
          const option = document.createElement('option');
          option.value = ind.industry_id;
          option.textContent = ind.industry_name;
          select.appendChild(option);
        });
      }

      // Load funding stages
      const stagesResponse = await fetch(`${API_URL}/dashboard/funding-stages`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const stagesData = await stagesResponse.json();

      if (stagesData.success) {
        const select = document.getElementById('filterStage');
        stagesData.data.forEach(stage => {
          const option = document.createElement('option');
          option.value = stage.stage_id;
          option.textContent = stage.stage_name;
          select.appendChild(option);
        });
      }
    }
  } catch (error) {
    console.error('Error loading filter options:', error);
  }
}

// Load results based on role
async function loadResults() {
  const role = getRole();

  document.getElementById('loadingResults').style.display = 'block';
  document.getElementById('noResults').style.display = 'none';
  document.getElementById('resultsGrid').innerHTML = '';

  try {
    if (role === 'Investor') {
      await loadStartupsForInvestor();
    } else if (role === 'Startup') {
      await loadInvestorsForStartup();
    }
  } catch (error) {
    console.error('Error loading results:', error);
    document.getElementById('loadingResults').style.display = 'none';
    document.getElementById('noResults').style.display = 'block';
  }
}

// Load startups for investor
async function loadStartupsForInvestor() {
  try {
    const filters = getFilters();
    const queryParams = new URLSearchParams();

    if (filters.search) queryParams.append('search', filters.search);
    if (filters.industryId) queryParams.append('industryId', filters.industryId);
    if (filters.stageId) queryParams.append('stageId', filters.stageId);
    if (filters.minFunding) queryParams.append('minFunding', filters.minFunding);
    if (filters.maxFunding) queryParams.append('maxFunding', filters.maxFunding);
    if (filters.location) queryParams.append('location', filters.location);
    if (filters.minTeamSize) queryParams.append('minTeamSize', filters.minTeamSize);
    if (filters.ignoreIndustry) queryParams.append('ignoreIndustry', 'true');
    if (filters.ignoreStage) queryParams.append('ignoreStage', 'true');

    const response = await fetch(`${API_URL}/discovery/startups?${queryParams}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    const data = await response.json();

    document.getElementById('loadingResults').style.display = 'none';

    if (data.success && data.data.length > 0) {
      currentResults = data.data;
      displayStartups(data.data);
      document.getElementById('resultsCount').textContent = data.data.length;
    } else {
      document.getElementById('noResults').style.display = 'block';
      document.getElementById('resultsCount').textContent = '0';
    }
  } catch (error) {
    console.error('Error loading startups:', error);
    document.getElementById('loadingResults').style.display = 'none';
    document.getElementById('noResults').style.display = 'block';
  }
}

// Load investors for startup
async function loadInvestorsForStartup() {
  try {
    const filters = getFilters();
    const queryParams = new URLSearchParams();

    if (filters.search) queryParams.append('search', filters.search);
    if (filters.investorType) queryParams.append('investorType', filters.investorType);
    if (filters.minBudget) queryParams.append('minBudget', filters.minBudget);
    if (filters.maxBudget) queryParams.append('maxBudget', filters.maxBudget);
    if (filters.location) queryParams.append('location', filters.location);
    if (filters.showAll) queryParams.append('showAll', 'true');

    const response = await fetch(`${API_URL}/discovery/investors?${queryParams}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    const data = await response.json();

    document.getElementById('loadingResults').style.display = 'none';

    if (data.success && data.data.length > 0) {
      currentResults = data.data;
      displayInvestors(data.data);
      document.getElementById('resultsCount').textContent = data.data.length;
    } else {
      document.getElementById('noResults').style.display = 'block';
      document.getElementById('resultsCount').textContent = '0';
    }
  } catch (error) {
    console.error('Error loading investors:', error);
    document.getElementById('loadingResults').style.display = 'none';
    document.getElementById('noResults').style.display = 'block';
  }
}

// Get current filter values
function getFilters() {
  const role = getRole();
  const filters = {};

  // Get search input (common for both roles)
  const searchEl = document.getElementById('searchInput');
  if (searchEl && searchEl.value) filters.search = searchEl.value;

  if (role === 'Investor') {
    const industryEl = document.getElementById('filterIndustry');
    const stageEl = document.getElementById('filterStage');
    const minFundingEl = document.getElementById('filterMinFunding');
    const maxFundingEl = document.getElementById('filterMaxFunding');
    const locationEl = document.getElementById('filterLocation');
    const minTeamEl = document.getElementById('filterMinTeam');
    const ignoreIndustryEl = document.getElementById('ignoreIndustry');
    const ignoreStageEl = document.getElementById('ignoreStage');

    if (industryEl && industryEl.value) filters.industryId = industryEl.value;
    if (stageEl && stageEl.value) filters.stageId = stageEl.value;
    if (minFundingEl && minFundingEl.value) filters.minFunding = minFundingEl.value;
    if (maxFundingEl && maxFundingEl.value) filters.maxFunding = maxFundingEl.value;
    if (locationEl && locationEl.value) filters.location = locationEl.value;
    if (minTeamEl && minTeamEl.value) filters.minTeamSize = minTeamEl.value;
    if (ignoreIndustryEl) filters.ignoreIndustry = ignoreIndustryEl.checked;
    if (ignoreStageEl) filters.ignoreStage = ignoreStageEl.checked;
  } else {
    const typeEl = document.getElementById('filterInvestorType');
    const minBudgetEl = document.getElementById('filterMinBudget');
    const maxBudgetEl = document.getElementById('filterMaxBudget');
    const locationEl = document.getElementById('filterLocation');
    const showAllEl = document.getElementById('showAll');

    if (typeEl && typeEl.value) filters.investorType = typeEl.value;
    if (minBudgetEl && minBudgetEl.value) filters.minBudget = minBudgetEl.value;
    if (maxBudgetEl && maxBudgetEl.value) filters.maxBudget = maxBudgetEl.value;
    if (locationEl && locationEl.value) filters.location = locationEl.value;
    if (showAllEl) filters.showAll = showAllEl.checked;
  }

  return filters;
}

// Display startups
function displayStartups(startups) {
  const grid = document.getElementById('resultsGrid');
  grid.innerHTML = '';

  startups.forEach(startup => {
    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = `
      <div class="result-header">
        <h3>${escapeHtml(startup.company_name)}</h3>
        <div class="match-score ${getMatchClass(startup.matchScore)}">
          ${startup.matchScore}% Match
        </div>
      </div>
      <div class="result-meta">
        <span><i class="fa-solid fa-building"></i> ${escapeHtml(startup.industry_name || 'N/A')}</span>
        <span><i class="fa-solid fa-chart-line"></i> ${escapeHtml(startup.stage_name || 'N/A')}</span>
      </div>
      <p class="result-pitch">${escapeHtml(truncate(startup.elevator_pitch, 150))}</p>
      <div class="result-stats">
        <div class="stat">
          <i class="fa-solid fa-dollar-sign"></i>
          <span>$${formatNumber(startup.funding_goal || 0)}</span>
        </div>
        <div class="stat">
          <i class="fa-solid fa-users"></i>
          <span>${startup.team_size || 'N/A'} people</span>
        </div>
        <div class="stat">
          <i class="fa-solid fa-location-dot"></i>
          <span>${escapeHtml(startup.location || 'N/A')}</span>
        </div>
      </div>
      <div class="result-actions">
        <button class="btn-secondary" onclick="viewStartup(${startup.profile_id})">
          <i class="fa-solid fa-eye"></i> View Details
        </button>
        <button class="btn-primary" onclick="startChat(${startup.user_id}, '${escapeHtml(startup.company_name)}')" title="Start Chat">
          <i class="fa-solid fa-message"></i>
        </button>
        <button class="btn-icon" onclick="saveMatch(${startup.user_id}, 'Startup')" title="Save">
          <i class="fa-regular fa-bookmark"></i>
        </button>
      </div>
    `;
    grid.appendChild(card);
  });
}

// Display investors
function displayInvestors(investors) {
  const grid = document.getElementById('resultsGrid');
  grid.innerHTML = '';

  investors.forEach(investor => {
    const card = document.createElement('div');
    card.className = 'result-card';
    
    const industriesText = investor.industries && investor.industries.length > 0
      ? investor.industries.map(i => i.industry_name).join(', ')
      : 'No preferences set';

    card.innerHTML = `
      <div class="result-header">
        <h3>${escapeHtml(investor.investor_name)}</h3>
        <div class="match-score ${getMatchClass(investor.matchScore)}">
          ${investor.matchScore}% Match
        </div>
      </div>
      <div class="result-meta">
        <span><i class="fa-solid fa-briefcase"></i> ${escapeHtml(investor.investor_type)}</span>
        ${investor.company ? `<span><i class="fa-solid fa-building"></i> ${escapeHtml(investor.company)}</span>` : ''}
      </div>
      <p class="result-pitch">${escapeHtml(truncate(investor.investment_thesis, 150))}</p>
      <div class="result-stats">
        <div class="stat">
          <i class="fa-solid fa-dollar-sign"></i>
          <span>$${formatNumber(investor.budget_min || 0)} - $${formatNumber(investor.budget_max || 0)}</span>
        </div>
        <div class="stat">
          <i class="fa-solid fa-location-dot"></i>
          <span>${escapeHtml(investor.location || 'N/A')}</span>
        </div>
      </div>
      <div class="result-industries">
        <strong>Interested in:</strong> ${escapeHtml(industriesText)}
      </div>
      <div class="result-actions">
        <button class="btn-secondary" onclick="viewInvestor(${investor.profile_id})">
          <i class="fa-solid fa-eye"></i> View Details
        </button>
        <button class="btn-primary" onclick="startChat(${investor.user_id}, '${escapeHtml(investor.investor_name)}')" title="Start Chat">
          <i class="fa-solid fa-message"></i>
        </button>
        <button class="btn-icon" onclick="saveMatch(${investor.user_id}, 'Investor')" title="Save">
          <i class="fa-regular fa-bookmark"></i>
        </button>
      </div>
    `;
    grid.appendChild(card);
  });
}

// View startup details
async function viewStartup(profileId) {
  try {
    const response = await fetch(`${API_URL}/discovery/startup/${profileId}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    const data = await response.json();

    if (data.success) {
      showStartupModal(data.data);
      
      // Track view
      await fetch(`${API_URL}/saved/track-view`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ viewedUserId: data.data.user_id })
      });
    }
  } catch (error) {
    console.error('Error viewing startup:', error);
  }
}

// View investor details
async function viewInvestor(profileId) {
  try {
    const response = await fetch(`${API_URL}/discovery/investor/${profileId}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    const data = await response.json();

    if (data.success) {
      showInvestorModal(data.data);
      
      // Track view
      await fetch(`${API_URL}/saved/track-view`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ viewedUserId: data.data.user_id })
      });
    }
  } catch (error) {
    console.error('Error viewing investor:', error);
  }
}

// Show startup modal
function showStartupModal(startup) {
  const modal = document.getElementById('startupModal');
  const details = document.getElementById('startupDetails');

  details.innerHTML = `
    <h2>${escapeHtml(startup.company_name)}</h2>
    <div class="modal-meta">
      <span><i class="fa-solid fa-building"></i> ${escapeHtml(startup.industry_name || 'N/A')}</span>
      <span><i class="fa-solid fa-chart-line"></i> ${escapeHtml(startup.stage_name || 'N/A')}</span>
      <span><i class="fa-solid fa-location-dot"></i> ${escapeHtml(startup.location || 'N/A')}</span>
    </div>

    <div class="modal-section">
      <h3><i class="fa-solid fa-lightbulb"></i> Elevator Pitch</h3>
      <p>${escapeHtml(startup.elevator_pitch)}</p>
    </div>

    ${startup.strengths || startup.weaknesses || startup.opportunities || startup.threats ? `
    <div class="modal-section">
      <h3><i class="fa-solid fa-chart-simple"></i> SWOT Analysis</h3>
      <div class="swot-grid">
        ${startup.strengths ? `
        <div class="swot-item">
          <h4><i class="fa-solid fa-thumbs-up"></i> Strengths</h4>
          <p>${escapeHtml(startup.strengths)}</p>
        </div>` : ''}
        ${startup.weaknesses ? `
        <div class="swot-item">
          <h4><i class="fa-solid fa-thumbs-down"></i> Weaknesses</h4>
          <p>${escapeHtml(startup.weaknesses)}</p>
        </div>` : ''}
        ${startup.opportunities ? `
        <div class="swot-item">
          <h4><i class="fa-solid fa-lightbulb"></i> Opportunities</h4>
          <p>${escapeHtml(startup.opportunities)}</p>
        </div>` : ''}
        ${startup.threats ? `
        <div class="swot-item">
          <h4><i class="fa-solid fa-triangle-exclamation"></i> Threats</h4>
          <p>${escapeHtml(startup.threats)}</p>
        </div>` : ''}
      </div>
    </div>` : ''}

    <div class="modal-section">
      <h3><i class="fa-solid fa-dollar-sign"></i> Funding Information</h3>
      <div class="info-grid">
        <div class="info-item">
          <strong>Funding Goal:</strong>
          <span>$${formatNumber(startup.funding_goal || 0)}</span>
        </div>
        <div class="info-item">
          <strong>Team Size:</strong>
          <span>${startup.team_size || 'N/A'}</span>
        </div>
        <div class="info-item">
          <strong>Founded:</strong>
          <span>${startup.founded_year || 'N/A'}</span>
        </div>
        ${startup.website ? `
        <div class="info-item">
          <strong>Website:</strong>
          <span><a href="${escapeHtml(startup.website)}" target="_blank">${escapeHtml(startup.website)}</a></span>
        </div>` : ''}
      </div>
    </div>

    <div class="modal-actions">
      <button class="btn-primary" onclick="saveMatch(${startup.user_id}, 'Startup')">
        <i class="fa-solid fa-bookmark"></i> Save Startup
      </button>
      <button class="btn-secondary" onclick="closeModal()">Close</button>
    </div>
  `;

  modal.style.display = 'block';
}

// Show investor modal
function showInvestorModal(investor) {
  const modal = document.getElementById('investorModal');
  const details = document.getElementById('investorDetails');

  const industriesText = investor.industries && investor.industries.length > 0
    ? investor.industries.map(i => `<span class="tag">${escapeHtml(i.industry_name)}</span>`).join('')
    : '<span class="tag">No preferences</span>';

  const stagesText = investor.stages && investor.stages.length > 0
    ? investor.stages.map(s => `<span class="tag">${escapeHtml(s.stage_name)}</span>`).join('')
    : '<span class="tag">No preferences</span>';

  details.innerHTML = `
    <h2>${escapeHtml(investor.investor_name)}</h2>
    <div class="modal-meta">
      <span><i class="fa-solid fa-briefcase"></i> ${escapeHtml(investor.investor_type)}</span>
      ${investor.company ? `<span><i class="fa-solid fa-building"></i> ${escapeHtml(investor.company)}</span>` : ''}
      <span><i class="fa-solid fa-location-dot"></i> ${escapeHtml(investor.location || 'N/A')}</span>
    </div>

    <div class="modal-section">
      <h3><i class="fa-solid fa-file-lines"></i> Investment Thesis</h3>
      <p>${escapeHtml(investor.investment_thesis)}</p>
    </div>

    <div class="modal-section">
      <h3><i class="fa-solid fa-dollar-sign"></i> Investment Range</h3>
      <p class="budget-range">$${formatNumber(investor.budget_min || 0)} - $${formatNumber(investor.budget_max || 0)}</p>
    </div>

    <div class="modal-section">
      <h3><i class="fa-solid fa-building"></i> Preferred Industries</h3>
      <div class="tags-list">${industriesText}</div>
    </div>

    <div class="modal-section">
      <h3><i class="fa-solid fa-chart-line"></i> Preferred Funding Stages</h3>
      <div class="tags-list">${stagesText}</div>
    </div>

    ${investor.website || investor.years_experience ? `
    <div class="modal-section">
      <h3><i class="fa-solid fa-info-circle"></i> Additional Information</h3>
      <div class="info-grid">
        ${investor.years_experience ? `
        <div class="info-item">
          <strong>Experience:</strong>
          <span>${investor.years_experience} years</span>
        </div>` : ''}
        ${investor.website ? `
        <div class="info-item">
          <strong>Website:</strong>
          <span><a href="${escapeHtml(investor.website)}" target="_blank">${escapeHtml(investor.website)}</a></span>
        </div>` : ''}
      </div>
    </div>` : ''}

    <div class="modal-actions">
      <button class="btn-primary" onclick="saveMatch(${investor.user_id}, 'Investor')">
        <i class="fa-solid fa-bookmark"></i> Save Investor
      </button>
      <button class="btn-secondary" onclick="closeModal()">Close</button>
    </div>
  `;

  modal.style.display = 'block';
}

// Close modal
function closeModal() {
  const startupModal = document.getElementById('startupModal');
  const investorModal = document.getElementById('investorModal');
  if (startupModal) startupModal.style.display = 'none';
  if (investorModal) investorModal.style.display = 'none';
}

// Save/bookmark a match
async function saveMatch(targetUserId, targetType) {
  try {
    const response = await fetch(`${API_URL}/saved/save`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ targetUserId, targetType })
    });

    const data = await response.json();

    if (data.success) {
      alert(targetType === 'Startup' ? 'Startup saved!' : 'Investor saved!');
    }
  } catch (error) {
    console.error('Error saving match:', error);
    alert('Failed to save. Please try again.');
  }
}

// Apply filters
function applyFilters() {
  loadResults();
}

// Reset filters
function resetFilters() {
  const role = getRole();

  if (role === 'Investor') {
    document.getElementById('filterIndustry').value = '';
    document.getElementById('filterStage').value = '';
    document.getElementById('filterMinFunding').value = '';
    document.getElementById('filterMaxFunding').value = '';
    document.getElementById('filterLocation').value = '';
    document.getElementById('filterMinTeam').value = '';
    document.getElementById('ignoreIndustry').checked = false;
    document.getElementById('ignoreStage').checked = false;
  } else {
    document.getElementById('filterInvestorType').value = '';
    document.getElementById('filterMinBudget').value = '';
    document.getElementById('filterMaxBudget').value = '';
    document.getElementById('filterLocation').value = '';
    document.getElementById('showAll').checked = false;
  }

  loadResults();
}

// Sort results
function sortResults() {
  const sortBy = document.getElementById('sortBy').value;
  const role = getRole();

  let sorted = [...currentResults];

  if (sortBy === 'match') {
    sorted.sort((a, b) => b.matchScore - a.matchScore);
  } else if (sortBy === 'funding' && role === 'Investor') {
    sorted.sort((a, b) => (b.funding_goal || 0) - (a.funding_goal || 0));
  } else if (sortBy === 'budget' && role === 'Startup') {
    sorted.sort((a, b) => (b.budget_max || 0) - (a.budget_max || 0));
  } else if (sortBy === 'team' && role === 'Investor') {
    sorted.sort((a, b) => (b.team_size || 0) - (a.team_size || 0));
  } else if (sortBy === 'recent') {
    sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  currentResults = sorted;

  if (role === 'Investor') {
    displayStartups(sorted);
  } else {
    displayInvestors(sorted);
  }
}

// Utility functions
function getMatchClass(score) {
  if (score >= 80) return 'match-high';
  if (score >= 60) return 'match-medium';
  return 'match-low';
}

function formatNumber(num) {
  return new Intl.NumberFormat('en-US').format(num);
}

function truncate(str, length) {
  if (!str) return '';
  return str.length > length ? str.substring(0, length) + '...' : str;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Close modal when clicking outside
window.onclick = function(event) {
  const startupModal = document.getElementById('startupModal');
  const investorModal = document.getElementById('investorModal');
  if (event.target === startupModal) {
    startupModal.style.display = 'none';
  }
  if (event.target === investorModal) {
    investorModal.style.display = 'none';
  }
}

// Start chat with user
async function startChat(userId, displayName) {
  try {
    // Send initial message to create conversation
    const response = await fetch(`${API_URL}/messages/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({
        receiverId: userId,
        messageText: `Hi! I'm interested in connecting with you.`
      })
    });

    const data = await response.json();

    if (data.success) {
      // Redirect to messages page
      window.location.href = 'messages.html';
    } else {
      alert('Failed to start chat: ' + data.message);
    }
  } catch (error) {
    console.error('Error starting chat:', error);
    alert('Failed to start chat');
  }
}

