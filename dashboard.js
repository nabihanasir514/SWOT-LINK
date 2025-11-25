// API Configuration
const API_URL = 'http://localhost:3000/api';

// Get token from localStorage
function getToken() {
  return localStorage.getItem('token');
}

// Get user role
function getRole() {
  return localStorage.getItem('role');
}

// Check authentication
function requireAuth() {
  const token = getToken();
  const role = getRole();
  
  if (!token) {
    window.location.href = 'login.html';
    return false;
  }
  
  // Check if user is on the right dashboard
  const isStartupDashboard = window.location.pathname.includes('startup-dashboard');
  const isInvestorDashboard = window.location.pathname.includes('investor-dashboard');
  
  if (isStartupDashboard && role !== 'Startup') {
    window.location.href = 'investor-dashboard.html';
    return false;
  }
  
  if (isInvestorDashboard && role !== 'Investor') {
    window.location.href = 'startup-dashboard.html';
    return false;
  }
  
  return true;
}

// Logout function
function logout() {
  localStorage.clear();
  window.location.href = 'index.html';
}

// Show/Hide views
function showDashboard() {
  document.getElementById('dashboardView').style.display = 'block';
  document.getElementById('profileView').style.display = 'none';
}

function showProfile() {
  document.getElementById('dashboardView').style.display = 'none';
  document.getElementById('profileView').style.display = 'block';
}

// Load dashboard data for Startup
async function loadStartupDashboard() {
  try {
    const response = await fetch(`${API_URL}/dashboard/startup`, {
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
  const { user, hasProfile, profile, stats } = result.data;

  // Update user name (support fullName or firstName)
  const displayName = user.firstName || (user.fullName ? user.fullName.split(' ')[0] : '');
  document.getElementById('userName').textContent = displayName || 'User';
      
      // Update stats
      document.getElementById('profileViews').textContent = stats.profileViews;
      document.getElementById('investorMatches').textContent = stats.investorMatches;
      document.getElementById('messages').textContent = stats.messages;
      
      // Show profile status
      if (hasProfile) {
        document.getElementById('noProfile').style.display = 'none';
        document.getElementById('hasProfile').style.display = 'block';
        
        document.getElementById('companyName').textContent = profile.company_name;
        document.getElementById('industryName').textContent = profile.industry_name || 'N/A';
        document.getElementById('stageName').textContent = profile.stage_name || 'N/A';
        document.getElementById('elevatorPitch').textContent = profile.elevator_pitch;
        document.getElementById('fundingGoal').textContent = profile.funding_goal 
          ? `$${parseFloat(profile.funding_goal).toLocaleString()} ${profile.currency}`
          : 'Not specified';
          
        // Populate form for editing
        populateStartupForm(profile);
      } else {
        document.getElementById('noProfile').style.display = 'block';
        document.getElementById('hasProfile').style.display = 'none';
      }
    } else {
      console.error('Failed to load dashboard:', result.message);
    }
  } catch (error) {
    console.error('Dashboard load error:', error);
  }
}

// Load dashboard data for Investor
async function loadInvestorDashboard() {
  try {
    const response = await fetch(`${API_URL}/dashboard/investor`, {
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
  const { user, hasProfile, profile, stats } = result.data;

  // Update user name (support fullName or firstName)
  const displayName = user.firstName || (user.fullName ? user.fullName.split(' ')[0] : '');
  document.getElementById('userName').textContent = displayName || 'User';
      
      // Update stats
      document.getElementById('startupMatches').textContent = stats.startupMatches;
      document.getElementById('savedStartups').textContent = stats.savedStartups;
      document.getElementById('messages').textContent = stats.messages;
      
      // Show profile status
      if (hasProfile) {
        document.getElementById('noProfile').style.display = 'none';
        document.getElementById('hasProfile').style.display = 'block';
        
        document.getElementById('investorNameDisplay').textContent = profile.investor_name;
        document.getElementById('investorTypeDisplay').textContent = profile.investor_type;
        document.getElementById('investmentThesisDisplay').textContent = profile.investment_thesis;
        
        const budgetRange = profile.budget_min && profile.budget_max
          ? `$${parseFloat(profile.budget_min).toLocaleString()} - $${parseFloat(profile.budget_max).toLocaleString()} ${profile.currency}`
          : 'Not specified';
        document.getElementById('budgetRange').textContent = budgetRange;
        
        // Display industries
        const industriesList = document.getElementById('industriesList');
        if (profile.industries && profile.industries.length > 0) {
          industriesList.innerHTML = profile.industries
            .map(ind => `<span class="tag">${ind.industry_name}</span>`)
            .join('');
        } else {
          industriesList.innerHTML = '<span class="tag">No preferences set</span>';
        }
        
        // Populate form for editing
        populateInvestorForm(profile);
      } else {
        document.getElementById('noProfile').style.display = 'block';
        document.getElementById('hasProfile').style.display = 'none';
      }
    } else {
      console.error('Failed to load dashboard:', result.message);
    }
  } catch (error) {
    console.error('Dashboard load error:', error);
  }
}

// Load industries and funding stages
async function loadOptions() {
  try {
    // Load industries
    const industriesResponse = await fetch(`${API_URL}/dashboard/industries`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const industriesData = await industriesResponse.json();
    
    if (industriesData.success) {
      const industrySelect = document.getElementById('industry');
      if (industrySelect) {
        industrySelect.innerHTML = '<option value="">Select industry</option>' +
          industriesData.data.map(ind => 
            `<option value="${ind.industry_id}">${ind.industry_name}</option>`
          ).join('');
      }
      
      // For investor checkboxes
      const industriesCheckboxes = document.getElementById('industriesCheckboxes');
      if (industriesCheckboxes) {
        industriesCheckboxes.innerHTML = industriesData.data.map(ind =>
          `<label class="checkbox-item">
            <input type="checkbox" name="industries" value="${ind.industry_id}">
            ${ind.industry_name}
          </label>`
        ).join('');
      }
    }
    
    // Load funding stages
    const stagesResponse = await fetch(`${API_URL}/dashboard/funding-stages`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const stagesData = await stagesResponse.json();
    
    if (stagesData.success) {
      const stageSelect = document.getElementById('fundingStage');
      if (stageSelect) {
        stageSelect.innerHTML = '<option value="">Select stage</option>' +
          stagesData.data.map(stage => 
            `<option value="${stage.stage_id}">${stage.stage_name}</option>`
          ).join('');
      }
      
      // For investor checkboxes
      const stagesCheckboxes = document.getElementById('stagesCheckboxes');
      if (stagesCheckboxes) {
        stagesCheckboxes.innerHTML = stagesData.data.map(stage =>
          `<label class="checkbox-item">
            <input type="checkbox" name="fundingStages" value="${stage.stage_id}">
            ${stage.stage_name}
          </label>`
        ).join('');
      }
    }
  } catch (error) {
    console.error('Error loading options:', error);
  }
}

// Populate startup form with existing data
function populateStartupForm(profile) {
  document.getElementById('companyNameInput').value = profile.company_name || '';
  document.getElementById('industry').value = profile.industry_id || '';
  document.getElementById('fundingStage').value = profile.funding_stage_id || '';
  document.getElementById('elevatorPitchInput').value = profile.elevator_pitch || '';
  document.getElementById('strengths').value = profile.strengths || '';
  document.getElementById('weaknesses').value = profile.weaknesses || '';
  document.getElementById('opportunities').value = profile.opportunities || '';
  document.getElementById('threats').value = profile.threats || '';
  document.getElementById('fundingGoalInput').value = profile.funding_goal || '';
  document.getElementById('foundedYear').value = profile.founded_year || '';
  document.getElementById('teamSize').value = profile.team_size || '';
  document.getElementById('location').value = profile.location || '';
  document.getElementById('website').value = profile.website || '';
}

// Populate investor form with existing data
function populateInvestorForm(profile) {
  document.getElementById('investorNameInput').value = profile.investor_name || '';
  document.getElementById('investorType').value = profile.investor_type || '';
  document.getElementById('investmentThesisInput').value = profile.investment_thesis || '';
  document.getElementById('budgetMin').value = profile.budget_min || '';
  document.getElementById('budgetMax').value = profile.budget_max || '';
  document.getElementById('company').value = profile.company || '';
  document.getElementById('location').value = profile.location || '';
  document.getElementById('website').value = profile.website || '';
  document.getElementById('yearsExperience').value = profile.years_experience || '';
  
  // Check industry checkboxes
  if (profile.industries) {
    profile.industries.forEach(ind => {
      const checkbox = document.querySelector(`input[name="industries"][value="${ind.industry_id}"]`);
      if (checkbox) checkbox.checked = true;
    });
  }
  
  // Check stage checkboxes
  if (profile.fundingStages) {
    profile.fundingStages.forEach(stage => {
      const checkbox = document.querySelector(`input[name="fundingStages"][value="${stage.stage_id}"]`);
      if (checkbox) checkbox.checked = true;
    });
  }
}

// Handle startup profile form submission
if (document.getElementById('startupProfileForm')) {
  document.getElementById('startupProfileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
      companyName: document.getElementById('companyNameInput').value,
      industryId: parseInt(document.getElementById('industry').value),
      fundingStageId: document.getElementById('fundingStage').value ? 
        parseInt(document.getElementById('fundingStage').value) : null,
      elevatorPitch: document.getElementById('elevatorPitchInput').value,
      strengths: document.getElementById('strengths').value || null,
      weaknesses: document.getElementById('weaknesses').value || null,
      opportunities: document.getElementById('opportunities').value || null,
      threats: document.getElementById('threats').value || null,
      fundingGoal: document.getElementById('fundingGoalInput').value ? 
        parseFloat(document.getElementById('fundingGoalInput').value) : null,
      foundedYear: document.getElementById('foundedYear').value ? 
        parseInt(document.getElementById('foundedYear').value) : null,
      teamSize: document.getElementById('teamSize').value ? 
        parseInt(document.getElementById('teamSize').value) : null,
      location: document.getElementById('location').value || null,
      website: document.getElementById('website').value || null
    };
    
    try {
      const response = await fetch(`${API_URL}/profile/startup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        document.getElementById('profile-success').textContent = 'Profile saved successfully!';
        document.getElementById('profile-success').style.display = 'block';
        setTimeout(() => {
          document.getElementById('profile-success').style.display = 'none';
          showDashboard();
          loadStartupDashboard();
        }, 2000);
      } else {
        document.getElementById('profile-error').textContent = result.message || 'Failed to save profile';
        document.getElementById('profile-error').style.display = 'block';
      }
    } catch (error) {
      console.error('Save profile error:', error);
      document.getElementById('profile-error').textContent = 'Network error. Please try again.';
      document.getElementById('profile-error').style.display = 'block';
    }
  });
}

// Handle investor profile form submission
if (document.getElementById('investorProfileForm')) {
  document.getElementById('investorProfileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get selected industries
    const selectedIndustries = Array.from(
      document.querySelectorAll('input[name="industries"]:checked')
    ).map(cb => parseInt(cb.value));
    
    // Get selected funding stages
    const selectedStages = Array.from(
      document.querySelectorAll('input[name="fundingStages"]:checked')
    ).map(cb => parseInt(cb.value));
    
    const formData = {
      investorName: document.getElementById('investorNameInput').value,
      investorType: document.getElementById('investorType').value,
      investmentThesis: document.getElementById('investmentThesisInput').value,
      budgetMin: document.getElementById('budgetMin').value ? 
        parseFloat(document.getElementById('budgetMin').value) : null,
      budgetMax: document.getElementById('budgetMax').value ? 
        parseFloat(document.getElementById('budgetMax').value) : null,
      company: document.getElementById('company').value || null,
      location: document.getElementById('location').value || null,
      website: document.getElementById('website').value || null,
      yearsExperience: document.getElementById('yearsExperience').value ? 
        parseInt(document.getElementById('yearsExperience').value) : null,
      industries: selectedIndustries,
      fundingStages: selectedStages
    };
    
    try {
      const response = await fetch(`${API_URL}/profile/investor`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        document.getElementById('profile-success').textContent = 'Profile saved successfully!';
        document.getElementById('profile-success').style.display = 'block';
        setTimeout(() => {
          document.getElementById('profile-success').style.display = 'none';
          showDashboard();
          loadInvestorDashboard();
        }, 2000);
      } else {
        document.getElementById('profile-error').textContent = result.message || 'Failed to save profile';
        document.getElementById('profile-error').style.display = 'block';
      }
    } catch (error) {
      console.error('Save profile error:', error);
      document.getElementById('profile-error').textContent = 'Network error. Please try again.';
      document.getElementById('profile-error').style.display = 'block';
    }
  });
}

// Setup navigation
if (document.getElementById('logoutLink')) {
  document.getElementById('logoutLink').addEventListener('click', (e) => {
    e.preventDefault();
    logout();
  });
}

// Top navigation handlers
const dashboardLink = document.getElementById('dashboardLink');
if (dashboardLink) {
  dashboardLink.addEventListener('click', (e) => {
    e.preventDefault();
    showDashboard();
  });
}

const profileLink = document.getElementById('profileLink');
if (profileLink) {
  profileLink.addEventListener('click', (e) => {
    e.preventDefault();
    showProfile();
  });
}

const matchesLink = document.getElementById('matchesLink');
if (matchesLink) {
  matchesLink.addEventListener('click', (e) => {
    e.preventDefault();
    const role = getRole();
    if (role === 'Startup') {
      window.location.href = 'startup-discovery.html';
    } else if (role === 'Investor') {
      window.location.href = 'investor-discovery.html';
    } else {
      // Fallback to login if role not set
      window.location.href = 'login.html';
    }
  });
}

// Initialize dashboard on page load
if (requireAuth()) {
  loadOptions();
  
  const role = getRole();
  if (role === 'Startup') {
    loadStartupDashboard();
  } else if (role === 'Investor') {
    loadInvestorDashboard();
  }
}
