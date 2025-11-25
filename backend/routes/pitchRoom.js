const express = require('express');
const router = express.Router();
const db = require('../config/fileStorage');
const auth = require('../middleware/auth');
const { uploadVideo, uploadThumbnail, deleteFile, getFileSize } = require('../config/upload');

// Helper: enrich video with startup/user metadata
async function enrichVideo(video) {
  const startupProfile = await db.findOne('startupProfiles', { startup_profile_id: video.startup_id });
  const industry = startupProfile?.industry_id ? await db.findOne('industries', { industry_id: startupProfile.industry_id }) : null;
  const stage = startupProfile?.funding_stage_id ? await db.findOne('fundingStages', { stage_id: startupProfile.funding_stage_id }) : null;
  return {
    ...video,
    company_name: startupProfile?.company_name || '',
    elevator_pitch: startupProfile?.elevator_pitch || '',
    website: startupProfile?.website || '',
    location: startupProfile?.location || '',
    industry_name: industry?.industry_name || null,
    stage_name: stage?.stage_name || null
  };
}

// Upload a pitch video (Startup)
router.post('/upload', auth, auth.requireRole('Startup'), uploadVideo.single('video'), async (req, res) => {
  try {
    const { title, description, isPublic } = req.body;
    const userId = req.user.userId;
    if (!req.file) return res.status(400).json({ success: false, message: 'No video file uploaded' });
    if (!title) {
      await deleteFile(req.file.path);
      return res.status(400).json({ success: false, message: 'Video title is required' });
    }

    const profile = await db.findOne('startupProfiles', { user_id: userId });
    if (!profile) {
      await deleteFile(req.file.path);
      return res.status(404).json({ success: false, message: 'Startup profile not found' });
    }

    const videoUrl = `/uploads/videos/${req.file.filename}`;
    const fileSize = await getFileSize(req.file.path);
    const created = await db.insert('pitchVideos', {
      startup_id: profile.startup_profile_id,
      user_id: userId,
      title,
      description: description || null,
      video_url: videoUrl,
      file_size: fileSize,
      is_public: isPublic === 'true' ? 1 : 0,
      views_count: 0
    }, 'video_id');

    res.json({ success: true, message: 'Video uploaded successfully', data: { videoId: created.video_id, videoUrl } });
  } catch (error) {
    console.error('Upload video error:', error);
    if (req.file) await deleteFile(req.file.path).catch(()=>{});
    res.status(500).json({ success: false, message: 'Failed to upload video' });
  }
});

// Upload thumbnail (Startup)
router.post('/upload-thumbnail/:videoId', auth, auth.requireRole('Startup'), uploadThumbnail.single('thumbnail'), async (req, res) => {
  try {
    const { videoId } = req.params;
    const userId = req.user.userId;
    if (!req.file) return res.status(400).json({ success: false, message: 'No thumbnail file uploaded' });

    const video = await db.findOne('pitchVideos', { video_id: parseInt(videoId), user_id: userId });
    if (!video) {
      await deleteFile(req.file.path);
      return res.status(403).json({ success: false, message: 'Unauthorized to update this video' });
    }

    const thumbnailUrl = `/uploads/thumbnails/${req.file.filename}`;
    await db.update('pitchVideos', { video_id: parseInt(videoId) }, { thumbnail_url: thumbnailUrl });
    res.json({ success: true, message: 'Thumbnail uploaded successfully', data: { thumbnailUrl } });
  } catch (error) {
    console.error('Upload thumbnail error:', error);
    if (req.file) await deleteFile(req.file.path).catch(()=>{});
    res.status(500).json({ success: false, message: 'Failed to upload thumbnail' });
  }
});

// List public videos with filters
router.get('/videos', auth, async (req, res) => {
  try {
    const { industryId, stageId, search, sortBy = 'recent' } = req.query;
    const all = await db.getAll('pitchVideos');
    const videos = (all || []).filter(v => v.is_public === 1 || v.is_public === true);

    // Filter by startup profile fields
    const sps = await db.getAll('startupProfiles');
    const spMap = new Map(sps.map(p => [p.startup_profile_id, p]));

    let filtered = videos.filter(v => {
      const sp = spMap.get(v.startup_id);
      if (!sp) return false;
      if (industryId && sp.industry_id !== parseInt(industryId)) return false;
      if (stageId && sp.funding_stage_id !== parseInt(stageId)) return false;
      if (search) {
        const s = search.toLowerCase();
        const titleMatch = (v.title || '').toLowerCase().includes(s);
        const companyMatch = (sp.company_name || '').toLowerCase().includes(s);
        if (!titleMatch && !companyMatch) return false;
      }
      return true;
    });

    // Sort
    if (sortBy === 'views') {
      filtered.sort((a,b)=> (b.views_count||0) - (a.views_count||0));
    } else {
      filtered.sort((a,b)=> new Date(b.created_at||0) - new Date(a.created_at||0));
    }

    const enriched = [];
    for (const v of filtered) {
      enriched.push(await enrichVideo(v));
    }
    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('List videos error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch videos' });
  }
});

// My videos (Startup)
router.get('/my-videos', auth, auth.requireRole('Startup'), async (req, res) => {
  try {
    const userId = req.user.userId;
    const all = await db.getAll('pitchVideos');
    const mine = (all || []).filter(v => v.user_id === userId);
    // compute comments_count quickly
    const comments = await db.getAll('videoComments');
    const counts = new Map();
    (comments||[]).forEach(c => counts.set(c.video_id, (counts.get(c.video_id)||0)+1));
    const withCounts = mine.map(v => ({...v, comments_count: counts.get(v.video_id)||0}));
    res.json({ success: true, data: withCounts });
  } catch (error) {
    console.error('My videos error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch my videos' });
  }
});

// Get single video (increments views)
router.get('/video/:id', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const video = await db.findOne('pitchVideos', { video_id: id });
    if (!video) return res.status(404).json({ success:false, message:'Video not found' });
    const views = (video.views_count || 0) + 1;
    await db.update('pitchVideos', { video_id: id }, { views_count: views });
    const enriched = await enrichVideo({ ...video, views_count: views });
    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('Get video error:', error);
    res.status(500).json({ success:false, message:'Failed to fetch video' });
  }
});

// Get comments for a video
router.get('/video/:id/comments', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const all = await db.getAll('videoComments');
    let list = (all || []).filter(c => c.video_id === id);
    const users = await db.getAll('users');
    const sp = await db.getAll('startupProfiles');
    const ip = await db.getAll('investorProfiles');
    const uMap = new Map(users.map(u=>[u.user_id,u]));
    const spMap = new Map(sp.map(p=>[p.user_id,p]));
    const ipMap = new Map(ip.map(p=>[p.user_id,p]));
    list = list.map(c => {
      const u = uMap.get(c.user_id)||{};
      return {
        ...c,
        username: u.full_name || (u.email?u.email.split('@')[0]:''),
        role: u.role || '',
        display_name: spMap.get(c.user_id)?.company_name || ipMap.get(c.user_id)?.investor_name || ''
      };
    }).sort((a,b)=> new Date(a.created_at)-new Date(b.created_at));
    res.json({ success:true, data:list });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ success:false, message:'Failed to fetch comments' });
  }
});

// Post a comment
router.post('/video/:id/comment', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { commentText } = req.body;
    const userId = req.user.userId;
    if (!commentText || !commentText.trim()) return res.status(400).json({ success:false, message:'Comment text required' });
    const video = await db.findOne('pitchVideos', { video_id: id });
    if (!video) return res.status(404).json({ success:false, message:'Video not found' });
    const created = await db.insert('videoComments', {
      video_id: id,
      user_id: userId,
      comment_text: commentText.trim()
    }, 'comment_id');
    res.json({ success:true, data: created });
  } catch (error) {
    console.error('Post comment error:', error);
    res.status(500).json({ success:false, message:'Failed to post comment' });
  }
});

// Delete a video (owner only)
router.delete('/video/:id', auth, auth.requireRole('Startup'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user.userId;
    const video = await db.findOne('pitchVideos', { video_id: id });
    if (!video) return res.status(404).json({ success:false, message:'Video not found' });
    if (video.user_id !== userId) return res.status(403).json({ success:false, message:'Unauthorized' });
    await db.delete('pitchVideos', { video_id: id });
    res.json({ success:true, message:'Video deleted successfully' });
  } catch (error) {
    console.error('Delete video error:', error);
    res.status(500).json({ success:false, message:'Failed to delete video' });
  }
});

module.exports = router;
