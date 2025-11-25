const express = require('express');
const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

// Global error diagnostics
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

// Initialize file-based storage
const db = require('./config/fileStorage');
db.initialize().then(async () => {
  console.log('✓ File-based data storage initialized');
  try {
    const seed = require('./utils/seed');
    await seed.ensureDefaultUsers();
  } catch (e) {
    console.warn('Seeding skipped or failed:', e?.message || e);
  }
}).catch(err => {
  console.error('✗ Failed to initialize file storage:', err);
  process.exit(1);
});

// Initialize Socket.io
const { initializeSocket } = require('./config/socket');
initializeSocket(server);

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow typical dev origins
    const allowed = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5500',
      'http://localhost:5500'
    ];
    if (!origin || allowed.includes(origin) || (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL)) {
      return callback(null, true);
    }
    return callback(null, true); // Be permissive in dev
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve frontend static files (HTML/CSS/JS) from project root
const clientDir = path.join(__dirname, '..');
app.use(express.static(clientDir));

// Root route -> index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});

// Import routes - File storage compatible routes
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const dashboardRoutes = require('./routes/dashboard');
const savedRoutes = require('./routes/saved');
const discoveryRoutes = require('./routes/discovery');
// Note: pitch room and messages routes are now file-storage compatible.
const pitchRoomRoutes = require('./routes/pitchRoom');
const messagesRoutes = require('./routes/messages');
const analyticsRoutes = require('./routes/analytics');
const dealRoomRoutes = require('./routes/dealRoom');
const adminRoutes = require('./routes/adminMVP');
const forumRoutes = require('./routes/forumMVP');

// Use routes - Enable all file storage compatible routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/saved', savedRoutes);
app.use('/api/discovery', discoveryRoutes);
app.use('/api/pitch-room', pitchRoomRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/deal-room', dealRoomRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/forum', forumRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'SWOT Link API is running',
    phase: 'Phase 3 - Community & Engagement',
    features: [
      'AI Matching', 
      'Pitch Room', 
      'Messages', 
      'Discovery', 
      'Deal Room MVP', 
      'Analytics Dashboard', 
      'Gamification', 
      'Admin Panel MVP',
      'Community Forum',
      'Advanced Notifications',
      'Profile View Tracking'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Start server
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';
server.listen(PORT, () => {
  const baseUrl = `http://${HOST}:${PORT}`;
  console.log('--------------------------------------------------');
  console.log(`🚀 Server running at: ${baseUrl}`);
  console.log(`🔌 API base: ${baseUrl}/api`);
  console.log(`🩺 Health check: ${baseUrl}/api/health`);
  console.log(`📂 File uploads served from: ${baseUrl}/uploads`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`👑 Admin Panel: Enabled`);
  console.log(`✅ KYC Verification: Enabled`);
  console.log(`🛡️ User Moderation: Enabled`);
  console.log(`💬 Community Forum: Enabled`);
  console.log('--------------------------------------------------');
  console.log('Tip: Frontend is static HTML. Use VS Code "Live Server" (port 5500) or run:');
  console.log('     npx serve .   (then open the printed URL)');
  console.log('Set FRONTEND_URL in .env to match the frontend origin if you change it.');
});
