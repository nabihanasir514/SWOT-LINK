// API Configuration
// Dynamic API base: if pages are served from backend (http://localhost:3000) use same origin, otherwise fall back
let API_URL = 'http://localhost:3000/api';
try {
  const origin = window.location.origin;
  if (origin && origin.startsWith('http')) {
    API_URL = `${origin.replace(/\/$/, '')}/api`;
  }
} catch (_) { /* ignore */ }

async function safeJson(response) {
  try { return await response.json(); } catch { return {}; }
}

// Helper function to get token from localStorage
function getToken() {
  return localStorage.getItem('token');
}

// Helper function to save user data
function saveUserData(data) {
  localStorage.setItem('token', data.token);
  localStorage.setItem('userId', data.userId);
  localStorage.setItem('email', data.email);
  localStorage.setItem('firstName', data.firstName);
  localStorage.setItem('lastName', data.lastName);
  localStorage.setItem('role', data.role);
}

// Helper function to clear user data
function clearUserData() {
  localStorage.removeItem('token');
  localStorage.removeItem('userId');
  localStorage.removeItem('email');
  localStorage.removeItem('firstName');
  localStorage.removeItem('lastName');
  localStorage.removeItem('role');
}

// Helper function to show error message
function showError(elementId, message) {
  const errorElement = document.getElementById(elementId);
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    setTimeout(() => {
      errorElement.style.display = 'none';
    }, 5000);
  }
}

// Helper function to show success message
function showSuccess(elementId, message) {
  const successElement = document.getElementById(elementId);
  if (successElement) {
    successElement.textContent = message;
    successElement.style.display = 'block';
    setTimeout(() => {
      successElement.style.display = 'none';
    }, 3000);
  }
}

// Check if user is logged in
function checkAuth() {
  const token = getToken();
  const role = localStorage.getItem('role');
  
  if (token && role) {
    // Redirect to appropriate dashboard if on auth pages
    if (window.location.pathname.includes('login.html') || 
        window.location.pathname.includes('signup.html')) {
      redirectToDashboard(role);
    }
  }
}

// Redirect to dashboard based on role
function redirectToDashboard(role) {
  if (role === 'Startup') {
    window.location.href = 'startup-dashboard.html';
  } else if (role === 'Investor') {
    window.location.href = 'investor-dashboard.html';
  }
}

// Handle Signup Form
if (document.getElementById('signupForm')) {
  document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (password !== confirmPassword) {
      showError('error-message', 'Passwords do not match');
      return;
    }
    
    const formData = {
      email: document.getElementById('email').value.trim(),
      password: password,
      firstName: document.getElementById('firstName').value.trim(),
      lastName: document.getElementById('lastName').value.trim(),
      role: document.getElementById('role').value,
      phone: document.getElementById('phone').value.trim() || null
    };
    
    try {
      const url = `${API_URL}/auth/register`;
      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      } catch (primaryErr) {
        // Fallback: if running from same origin but API_URL differs
        if (window.location.origin === 'http://localhost:3000') {
          response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
          });
        } else {
          throw primaryErr;
        }
      }
      const data = await safeJson(response);
      
      if (response.ok && data.success) {
        // data.user contains user info per backend
        saveUserData({
          token: data.token,
          userId: data.user.userId,
          email: data.user.email,
          firstName: data.user.fullName?.split(' ')[0] || '',
          lastName: data.user.fullName?.split(' ').slice(1).join(' ') || '',
          role: data.user.role
        });
        showSuccess('success-message', 'Account created successfully! Redirecting...');
        setTimeout(() => {
          redirectToDashboard(data.user.role);
        }, 1200);
      } else {
        const errorMsg = data.message || data.errors?.[0]?.msg || 'Signup failed';
        showError('error-message', errorMsg);
      }
    } catch (error) {
      console.error('Signup error:', error);
      showError('error-message', `Network error. Ensure backend running at http://localhost:3000 (error: ${error.message || error})`);
    }
  });
}

// Handle Login Form
if (document.getElementById('loginForm')) {
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
      email: document.getElementById('email').value,
      password: document.getElementById('password').value
    };
    
    try {
      const url = `${API_URL}/auth/login`;
      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      } catch (primaryErr) {
        if (window.location.origin === 'http://localhost:3000') {
          response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
          });
        } else {
          throw primaryErr;
        }
      }
      const data = await safeJson(response);
      
      if (response.ok && data.success) {
        saveUserData({
          token: data.token,
          userId: data.user.userId,
          email: data.user.email,
          firstName: data.user.fullName?.split(' ')[0] || '',
          lastName: data.user.fullName?.split(' ').slice(1).join(' ') || '',
          role: data.user.role
        });
        showSuccess('success-message', 'Login successful! Redirecting...');
        setTimeout(() => {
          redirectToDashboard(data.user.role);
        }, 1200);
      } else {
        showError('error-message', data.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      showError('error-message', `Network error. Ensure backend running at http://localhost:3000 (error: ${error.message || error})`);
    }
  });
}

// Check authentication on page load
checkAuth();
