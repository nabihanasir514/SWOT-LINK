const express = require('express');
const router = express.Router();
const db = require('../config/fileStorage');
const auth = require('../middleware/auth');
const { uploadDocument, deleteFile, getFileSize } = require('../config/upload');

// ============================================
// CREATE DEAL ROOM
// ============================================
router.post('/create', auth, async (req, res) => {
  try {
    const { participantId, dealName } = req.body;
    const userId = req.user.userId;

    if (!participantId) {
      return res.status(400).json({ success: false, message: 'Participant ID is required' });
    }

    const participant = await db.findOne('users', { user_id: parseInt(participantId) });
    if (!participant) {
      return res.status(404).json({ success: false, message: 'Participant not found' });
    }

    // Check if deal room already exists between these users
    const allRooms = await db.getAll('dealRooms');
    const existing = (allRooms || []).find(room => 
      (room.creator_id === userId && room.participant_id === parseInt(participantId)) ||
      (room.creator_id === parseInt(participantId) && room.participant_id === userId)
    );

    if (existing) {
      return res.json({ success: true, message: 'Deal room already exists', data: existing });
    }

    const created = await db.insert('dealRooms', {
      creator_id: userId,
      participant_id: parseInt(participantId),
      deal_name: dealName || 'Deal Room',
      status: 'active'
    }, 'deal_room_id');

    res.json({ success: true, message: 'Deal room created', data: created });
  } catch (error) {
    console.error('Create deal room error:', error);
    res.status(500).json({ success: false, message: 'Failed to create deal room' });
  }
});

// ============================================
// GET MY DEAL ROOMS
// ============================================
router.get('/rooms', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const allRooms = await db.getAll('dealRooms');
    let rooms = (allRooms || []).filter(room => 
      room.creator_id === userId || room.participant_id === userId
    );

    const users = await db.getAll('users');
    const sp = await db.getAll('startupProfiles');
    const ip = await db.getAll('investorProfiles');
    const uMap = new Map(users.map(u => [u.user_id, u]));
    const spMap = new Map(sp.map(p => [p.user_id, p]));
    const ipMap = new Map(ip.map(p => [p.user_id, p]));

    rooms = rooms.map(room => {
      const otherId = room.creator_id === userId ? room.participant_id : room.creator_id;
      const other = uMap.get(otherId) || {};
      return {
        ...room,
        other_user: {
          user_id: otherId,
          username: other.full_name || (other.email ? other.email.split('@')[0] : ''),
          role: other.role || '',
          display_name: spMap.get(otherId)?.company_name || ipMap.get(otherId)?.investor_name || ''
        }
      };
    }).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    res.json({ success: true, data: rooms });
  } catch (error) {
    console.error('Get deal rooms error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch deal rooms' });
  }
});

// ============================================
// UPLOAD DOCUMENT TO DEAL ROOM
// ============================================
router.post('/upload', auth, uploadDocument.single('file'), async (req, res) => {
  try {
    const { dealRoomId, fileCategory, description, isConfidential } = req.body;
    const userId = req.user.userId;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    if (!dealRoomId) {
      await deleteFile(req.file.path);
      return res.status(400).json({ success: false, message: 'Deal room ID is required' });
    }

    const room = await db.findOne('dealRooms', { deal_room_id: parseInt(dealRoomId) });
    if (!room) {
      await deleteFile(req.file.path);
      return res.status(404).json({ success: false, message: 'Deal room not found' });
    }

    if (room.creator_id !== userId && room.participant_id !== userId) {
      await deleteFile(req.file.path);
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const fileUrl = `/uploads/documents/${req.file.filename}`;
    const fileSize = await getFileSize(req.file.path);

    const created = await db.insert('dealRoomFiles', {
      deal_room_id: parseInt(dealRoomId),
      uploader_id: userId,
      file_name: req.file.filename,
      original_name: req.file.originalname,
      file_url: fileUrl,
      file_type: req.file.mimetype,
      file_size: fileSize,
      file_category: fileCategory || 'other',
      description: description || null,
      is_confidential: isConfidential === 'true' ? 1 : 0
    }, 'file_id');

    res.json({ success: true, message: 'File uploaded successfully', data: created });
  } catch (error) {
    console.error('Upload file error:', error);
    if (req.file) await deleteFile(req.file.path).catch(() => {});
    res.status(500).json({ success: false, message: 'Failed to upload file' });
  }
});

// ============================================
// GET FILES IN DEAL ROOM
// ============================================
router.get('/room/:dealRoomId/files', auth, async (req, res) => {
  try {
    const { dealRoomId } = req.params;
    const userId = req.user.userId;

    const room = await db.findOne('dealRooms', { deal_room_id: parseInt(dealRoomId) });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Deal room not found' });
    }

    if (room.creator_id !== userId && room.participant_id !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const allFiles = await db.getAll('dealRoomFiles');
    let files = (allFiles || []).filter(f => f.deal_room_id === parseInt(dealRoomId));

    const users = await db.getAll('users');
    const uMap = new Map(users.map(u => [u.user_id, u]));

    files = files.map(f => {
      const uploader = uMap.get(f.uploader_id) || {};
      return {
        ...f,
        uploader_name: uploader.full_name || (uploader.email ? uploader.email.split('@')[0] : '')
      };
    }).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    res.json({ success: true, data: files });
  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch files' });
  }
});

// ============================================
// DELETE FILE FROM DEAL ROOM (Owner only)
// ============================================
router.delete('/file/:fileId', auth, async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.userId;

    const file = await db.findOne('dealRoomFiles', { file_id: parseInt(fileId) });
    if (!file) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    if (file.uploader_id !== userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized to delete this file' });
    }

    await db.delete('dealRoomFiles', { file_id: parseInt(fileId) });
    res.json({ success: true, message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete file' });
  }
});

module.exports = router;

/*
// ============================================
// DISABLED - TO BE CONVERTED
// ============================================
// ============================================
// DOWNLOAD FILE (With permission check and logging)
// ============================================
router.get('/download/:fileId', authenticateToken, async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    const { fileId } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;

    // Get file details
    const [files] = await connection.query(
      'SELECT * FROM deal_room_files WHERE file_id = ?',
      [fileId]
    );

    if (files.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const file = files[0];
    let hasAccess = false;

    // Check permissions
    if (userRole === 'Startup' && file.uploader_id === userId) {
      hasAccess = true;
    } else if (userRole === 'Investor') {
      const [permissions] = await connection.query(
        `SELECT can_download FROM file_permissions 
         WHERE file_id = ? AND investor_id = ? AND revoked_at IS NULL AND can_download = TRUE
         AND (expires_at IS NULL OR expires_at > NOW())`,
        [fileId, userId]
      );

      if (permissions.length > 0) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      // Log denied access
      await connection.query(
        `INSERT INTO file_access_logs (file_id, user_id, action_type, ip_address, user_agent)
         VALUES (?, ?, 'denied', ?, ?)`,
        [fileId, userId, req.ip, req.get('user-agent')]
      );

      return res.status(403).json({
        success: false,
        message: 'You do not have permission to download this file'
      });
    }

    // Log download
    await connection.query(
      `INSERT INTO file_access_logs (file_id, user_id, action_type, ip_address, user_agent)
       VALUES (?, ?, 'download', ?, ?)`,
      [fileId, userId, req.ip, req.get('user-agent')]
    );

    // Send file
    const filePath = `.${file.file_url}`;
    res.download(filePath, file.original_name);

  } catch (error) {
    console.error('Download file error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download file'
    });
  } finally {
    connection.release();
  }
});

// ============================================
// GRANT FILE PERMISSION (Startup only)
// ============================================
router.post('/grant-permission', authenticateToken, requireRole(['Startup']), async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    const { fileId, investorId, canView = true, canDownload = true, expiresAt } = req.body;
    const userId = req.user.userId;

    if (!fileId || !investorId) {
      return res.status(400).json({
        success: false,
        message: 'File ID and Investor ID are required'
      });
    }

    // Verify file ownership
    const [files] = await connection.query(
      'SELECT uploader_id FROM deal_room_files WHERE file_id = ?',
      [fileId]
    );

    if (files.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    if (files[0].uploader_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to grant permissions for this file'
      });
    }

    // Verify investor exists and is an investor
    const [investors] = await connection.query(
      'SELECT user_id FROM users WHERE user_id = ? AND role = "Investor"',
      [investorId]
    );

    if (investors.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Investor not found'
      });
    }

    // Grant permission (or update if exists)
    await connection.query(
      `INSERT INTO file_permissions 
       (file_id, investor_id, granted_by, can_view, can_download, expires_at) 
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
       can_view = VALUES(can_view),
       can_download = VALUES(can_download),
       expires_at = VALUES(expires_at),
       revoked_at = NULL`,
      [fileId, investorId, userId, canView ? 1 : 0, canDownload ? 1 : 0, expiresAt || null]
    );

    res.json({
      success: true,
      message: 'Permission granted successfully'
    });

  } catch (error) {
    console.error('Grant permission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to grant permission'
    });
  } finally {
    connection.release();
  }
});

// ============================================
// REVOKE FILE PERMISSION (Startup only)
// ============================================
router.post('/revoke-permission', authenticateToken, requireRole(['Startup']), async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    const { fileId, investorId } = req.body;
    const userId = req.user.userId;

    if (!fileId || !investorId) {
      return res.status(400).json({
        success: false,
        message: 'File ID and Investor ID are required'
      });
    }

    // Verify file ownership
    const [files] = await connection.query(
      'SELECT uploader_id FROM deal_room_files WHERE file_id = ?',
      [fileId]
    );

    if (files.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    if (files[0].uploader_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to revoke permissions for this file'
      });
    }

    // Revoke permission
    await connection.query(
      `UPDATE file_permissions 
       SET revoked_at = CURRENT_TIMESTAMP 
       WHERE file_id = ? AND investor_id = ?`,
      [fileId, investorId]
    );

    res.json({
      success: true,
      message: 'Permission revoked successfully'
    });

  } catch (error) {
    console.error('Revoke permission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to revoke permission'
    });
  } finally {
    connection.release();
  }
});

// ============================================
// GET FILE PERMISSIONS (Startup only)
// ============================================
router.get('/file-permissions/:fileId', authenticateToken, requireRole(['Startup']), async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    const { fileId } = req.params;
    const userId = req.user.userId;

    // Verify file ownership
    const [files] = await connection.query(
      'SELECT uploader_id FROM deal_room_files WHERE file_id = ?',
      [fileId]
    );

    if (files.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    if (files[0].uploader_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to view permissions for this file'
      });
    }

    // Get permissions
    const [permissions] = await connection.query(
      `SELECT 
        fp.*,
        ip.investor_name,
        u.username,
        u.email
       FROM file_permissions fp
       JOIN users u ON fp.investor_id = u.user_id
       JOIN investor_profiles ip ON u.user_id = ip.user_id
       WHERE fp.file_id = ?
       ORDER BY fp.granted_at DESC`,
      [fileId]
    );

    res.json({
      success: true,
      data: permissions
    });

  } catch (error) {
    console.error('Get file permissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch permissions'
    });
  } finally {
    connection.release();
  }
});

// ============================================
// DELETE FILE (Startup owner only)
// ============================================
router.delete('/file/:fileId', authenticateToken, requireRole(['Startup']), async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    const { fileId } = req.params;
    const userId = req.user.userId;

    // Get file info
    const [files] = await connection.query(
      'SELECT file_url, uploader_id FROM deal_room_files WHERE file_id = ?',
      [fileId]
    );

    if (files.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    if (files[0].uploader_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to delete this file'
      });
    }

    // Delete file from storage
    const filePath = `.${files[0].file_url}`;
    await deleteFile(filePath).catch(err => console.error('Error deleting file:', err));

    // Delete from database (cascade will delete permissions and logs)
    await connection.query('DELETE FROM deal_room_files WHERE file_id = ?', [fileId]);

    res.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete file'
    });
  } finally {
    connection.release();
  }
});

// ============================================
// GET FILE ACCESS LOGS (Startup owner only)
// ============================================
router.get('/access-logs/:fileId', authenticateToken, requireRole(['Startup']), async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    const { fileId } = req.params;
    const userId = req.user.userId;

    // Verify file ownership
    const [files] = await connection.query(
      'SELECT uploader_id FROM deal_room_files WHERE file_id = ?',
      [fileId]
    );

    if (files.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    if (files[0].uploader_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to view access logs for this file'
      });
    }

    // Get access logs
    const [logs] = await connection.query(
      `SELECT 
        fal.*,
        u.username,
        COALESCE(ip.investor_name, sp.company_name) as display_name
       FROM file_access_logs fal
       JOIN users u ON fal.user_id = u.user_id
       LEFT JOIN investor_profiles ip ON u.user_id = ip.user_id
       LEFT JOIN startup_profiles sp ON u.user_id = sp.user_id
       WHERE fal.file_id = ?
       ORDER BY fal.accessed_at DESC`,
      [fileId]
    );

    res.json({
      success: true,
      data: logs
    });

  } catch (error) {
    console.error('Get access logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch access logs'
    });
  } finally {
    connection.release();
  }
});
*/

module.exports = router;
