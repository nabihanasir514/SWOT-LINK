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

let currentVideoId = null;
let videoPlayer = null;

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

  // Setup dashboard link
  const dashboardLink = document.getElementById('dashboardLink');
  if (dashboardLink) {
    dashboardLink.href = role === 'Startup' ? 'startup-dashboard.html' : 'investor-dashboard.html';
  }

  // Setup discover link
  const discoverLink = document.getElementById('discoverLink');
  if (discoverLink) {
    discoverLink.href = role === 'Startup' ? 'startup-discovery.html' : 'investor-discovery.html';
  }

  // Show upload button for startups
  if (role === 'Startup') {
    document.getElementById('uploadBtn').style.display = 'inline-flex';
    document.getElementById('myVideosSection').style.display = 'block';
    
    // Setup upload button
    document.getElementById('uploadBtn').addEventListener('click', () => {
      document.getElementById('uploadModal').style.display = 'block';
    });

    // Setup upload form
    document.getElementById('uploadForm').addEventListener('submit', handleVideoUpload);
    
    // Load my videos
    await loadMyVideos();
  }

  // Load filter options
  await loadFilterOptions();

  // Load videos
  await loadVideos();
});

// Load filter options
async function loadFilterOptions() {
  try {
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
  } catch (error) {
    console.error('Error loading filter options:', error);
  }
}

// Load videos
async function loadVideos() {
  try {
    document.getElementById('loadingVideos').style.display = 'block';
    document.getElementById('noVideos').style.display = 'none';
    document.getElementById('videosGrid').innerHTML = '';

    const filters = getFilters();
    const queryParams = new URLSearchParams();

    if (filters.industryId) queryParams.append('industryId', filters.industryId);
    if (filters.stageId) queryParams.append('stageId', filters.stageId);
    if (filters.search) queryParams.append('search', filters.search);
    if (filters.sortBy) queryParams.append('sortBy', filters.sortBy);

    const response = await fetch(`${API_URL}/pitch-room/videos?${queryParams}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    const data = await response.json();

    document.getElementById('loadingVideos').style.display = 'none';

    if (data.success && data.data.length > 0) {
      displayVideos(data.data);
    } else {
      document.getElementById('noVideos').style.display = 'block';
    }
  } catch (error) {
    console.error('Error loading videos:', error);
    document.getElementById('loadingVideos').style.display = 'none';
    document.getElementById('noVideos').style.display = 'block';
  }
}

// Load my videos (Startup only)
async function loadMyVideos() {
  try {
    const response = await fetch(`${API_URL}/pitch-room/my-videos`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    const data = await response.json();

    const container = document.getElementById('myVideosList');
    container.innerHTML = '';

    if (data.success && data.data.length > 0) {
      data.data.forEach(video => {
        const card = createMyVideoCard(video);
        container.appendChild(card);
      });
    } else {
      container.innerHTML = '<p style="text-align: center; color: #999;">No videos uploaded yet</p>';
    }
  } catch (error) {
    console.error('Error loading my videos:', error);
  }
}

// Create my video card
function createMyVideoCard(video) {
  const card = document.createElement('div');
  card.className = 'my-video-card';
  card.innerHTML = `
    <div class="video-thumbnail">
      <i class="fa-solid fa-play-circle"></i>
    </div>
    <div class="my-video-info">
      <h4>${escapeHtml(video.title)}</h4>
      <div class="my-video-stats">
        <span><i class="fa-solid fa-eye"></i> ${video.views_count} views</span>
        <span><i class="fa-solid fa-comments"></i> ${video.comments_count} comments</span>
      </div>
      <div class="my-video-actions">
        <button class="btn-small btn-primary" onclick="playVideo(${video.video_id})">
          <i class="fa-solid fa-play"></i> Watch
        </button>
        <button class="btn-small btn-danger" onclick="deleteVideo(${video.video_id})">
          <i class="fa-solid fa-trash"></i> Delete
        </button>
      </div>
    </div>
  `;
  return card;
}

// Display videos
function displayVideos(videos) {
  const grid = document.getElementById('videosGrid');
  grid.innerHTML = '';

  videos.forEach(video => {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.onclick = () => playVideo(video.video_id);
    card.innerHTML = `
      <div class="video-thumbnail">
        ${video.thumbnail_url ? 
          `<img src="${API_URL.replace('/api', '')}${video.thumbnail_url}" alt="Video thumbnail">` :
          '<i class="fa-solid fa-play-circle"></i>'
        }
        <div class="video-overlay">
          <i class="fa-solid fa-play"></i>
        </div>
      </div>
      <div class="video-card-content">
        <h3>${escapeHtml(video.title)}</h3>
        <div class="video-meta">
          <span><i class="fa-solid fa-building"></i> ${escapeHtml(video.company_name)}</span>
          <span><i class="fa-solid fa-chart-line"></i> ${escapeHtml(video.industry_name || 'N/A')}</span>
        </div>
        <p class="video-pitch">${escapeHtml(truncate(video.elevator_pitch, 100))}</p>
        <div class="video-stats">
          <span><i class="fa-solid fa-eye"></i> ${video.views_count} views</span>
          <span><i class="fa-solid fa-calendar"></i> ${formatDate(video.created_at)}</span>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

// Play video
async function playVideo(videoId) {
  try {
    const response = await fetch(`${API_URL}/pitch-room/video/${videoId}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    const data = await response.json();

    if (data.success) {
      showVideoModal(data.data);
      await loadComments(videoId);
    } else {
      alert('Failed to load video');
    }
  } catch (error) {
    console.error('Error playing video:', error);
    alert('Failed to load video');
  }
}

// Show video modal
function showVideoModal(video) {
  currentVideoId = video.video_id;

  // Set video info
  document.getElementById('videoModalTitle').textContent = video.title;
  document.getElementById('videoCompany').textContent = video.company_name;
  document.getElementById('videoStage').textContent = video.stage_name || 'N/A';
  document.getElementById('videoViews').textContent = video.views_count;
  document.getElementById('videoDate').textContent = formatDate(video.created_at);
  document.getElementById('videoDescription').textContent = video.description || 'No description provided';
  document.getElementById('videoElevatorPitch').textContent = video.elevator_pitch;
  document.getElementById('videoIndustry').textContent = video.industry_name || 'N/A';
  document.getElementById('videoLocation').textContent = video.location || 'N/A';

  if (video.website) {
    const websiteLink = document.getElementById('videoWebsite');
    websiteLink.href = video.website;
    websiteLink.style.display = 'inline-flex';
  } else {
    document.getElementById('videoWebsite').style.display = 'none';
  }

  // Initialize video player
  if (videoPlayer) {
    videoPlayer.dispose();
  }

  const videoUrl = `${API_URL.replace('/api', '')}${video.video_url}`;
  
  videoPlayer = videojs('videoPlayer', {
    controls: true,
    autoplay: false,
    preload: 'auto',
    fluid: true,
    aspectRatio: '16:9',
    sources: [{
      src: videoUrl,
      type: 'video/mp4'
    }]
  });

  // Show modal
  document.getElementById('videoModal').style.display = 'block';
}

// Close video modal
function closeVideoModal() {
  if (videoPlayer) {
    videoPlayer.pause();
    videoPlayer.dispose();
    videoPlayer = null;
  }
  document.getElementById('videoModal').style.display = 'none';
  currentVideoId = null;
}

// Load comments
async function loadComments(videoId) {
  try {
    const response = await fetch(`${API_URL}/pitch-room/video/${videoId}/comments`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    const data = await response.json();

    if (data.success) {
      displayComments(data.data);
      document.getElementById('commentsCount').textContent = data.data.length;
    }
  } catch (error) {
    console.error('Error loading comments:', error);
  }
}

// Display comments
function displayComments(comments) {
  const container = document.getElementById('commentsList');
  container.innerHTML = '';

  if (comments.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No comments yet. Be the first to comment!</p>';
    return;
  }

  comments.forEach(comment => {
    const commentEl = document.createElement('div');
    commentEl.className = 'comment';
    commentEl.innerHTML = `
      <div class="comment-header">
        <div class="comment-author">
          <i class="fa-solid fa-user-circle"></i>
          <span><strong>${escapeHtml(comment.display_name || comment.username)}</strong> <span class="role-badge">${comment.role}</span></span>
        </div>
        <span class="comment-date">${formatDate(comment.created_at)}</span>
      </div>
      <div class="comment-body">
        ${escapeHtml(comment.comment_text)}
      </div>
    `;
    container.appendChild(commentEl);
  });
}

// Post comment
async function postComment() {
  const commentText = document.getElementById('commentText').value.trim();

  if (!commentText) {
    alert('Please enter a comment');
    return;
  }

  if (!currentVideoId) {
    alert('No video selected');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/pitch-room/video/${currentVideoId}/comment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ commentText })
    });

    const data = await response.json();

    if (data.success) {
      document.getElementById('commentText').value = '';
      await loadComments(currentVideoId);
    } else {
      alert('Failed to post comment');
    }
  } catch (error) {
    console.error('Error posting comment:', error);
    alert('Failed to post comment');
  }
}

// Handle video upload
async function handleVideoUpload(e) {
  e.preventDefault();

  const title = document.getElementById('videoTitle').value;
  const description = document.getElementById('videoDescription').value;
  const videoFile = document.getElementById('videoFile').files[0];
  const isPublic = document.getElementById('isPublic').checked;

  if (!videoFile) {
    alert('Please select a video file');
    return;
  }

  const formData = new FormData();
  formData.append('video', videoFile);
  formData.append('title', title);
  formData.append('description', description);
  formData.append('isPublic', isPublic);

  try {
    document.getElementById('uploadProgress').style.display = 'block';
    
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percentComplete = (e.loaded / e.total) * 100;
        document.getElementById('progressFill').style.width = percentComplete + '%';
        document.getElementById('progressText').textContent = `Uploading... ${Math.round(percentComplete)}%`;
      }
    });

    xhr.addEventListener('load', async () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        if (data.success) {
          alert('Video uploaded successfully!');
          closeUploadModal();
          await loadMyVideos();
          await loadVideos();
        } else {
          alert('Upload failed: ' + data.message);
        }
      } else {
        alert('Upload failed');
      }
      document.getElementById('uploadProgress').style.display = 'none';
    });

    xhr.addEventListener('error', () => {
      alert('Upload failed');
      document.getElementById('uploadProgress').style.display = 'none';
    });

    xhr.open('POST', `${API_URL}/pitch-room/upload`);
    xhr.setRequestHeader('Authorization', `Bearer ${getToken()}`);
    xhr.send(formData);

  } catch (error) {
    console.error('Error uploading video:', error);
    alert('Failed to upload video');
    document.getElementById('uploadProgress').style.display = 'none';
  }
}

// Delete video
async function deleteVideo(videoId) {
  if (!confirm('Are you sure you want to delete this video? This action cannot be undone.')) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/pitch-room/video/${videoId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    const data = await response.json();

    if (data.success) {
      alert('Video deleted successfully');
      await loadMyVideos();
      await loadVideos();
    } else {
      alert('Failed to delete video');
    }
  } catch (error) {
    console.error('Error deleting video:', error);
    alert('Failed to delete video');
  }
}

// Close upload modal
function closeUploadModal() {
  document.getElementById('uploadModal').style.display = 'none';
  document.getElementById('uploadForm').reset();
  document.getElementById('uploadProgress').style.display = 'none';
  document.getElementById('progressFill').style.width = '0%';
}

// Get filters
function getFilters() {
  return {
    search: document.getElementById('searchQuery').value,
    industryId: document.getElementById('filterIndustry').value,
    stageId: document.getElementById('filterStage').value,
    sortBy: document.getElementById('sortBy').value
  };
}

// Apply filters
function applyFilters() {
  loadVideos();
}

// Reset filters
function resetFilters() {
  document.getElementById('searchQuery').value = '';
  document.getElementById('filterIndustry').value = '';
  document.getElementById('filterStage').value = '';
  document.getElementById('sortBy').value = 'recent';
  loadVideos();
}

// Utility functions
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
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

// Close modals when clicking outside
window.onclick = function(event) {
  if (event.target.classList.contains('modal')) {
    if (event.target.id === 'uploadModal') {
      closeUploadModal();
    } else if (event.target.id === 'videoModal') {
      closeVideoModal();
    }
  }
}
