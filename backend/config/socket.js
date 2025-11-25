const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const db = require('./fileStorage');

let io;

// Store connected users: { userId: socketId }
const connectedUsers = new Map();

const initializeSocket = (server) => {
  io = socketIO(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication error'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      socket.userId = decoded.userId;
      socket.role = decoded.role;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userId}`);
    
    // Store connected user
    connectedUsers.set(socket.userId, socket.id);

    // Emit online status to all users
    socket.broadcast.emit('user:online', { userId: socket.userId });

    // Join user's personal room
    socket.join(`user:${socket.userId}`);

    // Handle typing indicator
    socket.on('typing:start', ({ receiverId }) => {
      io.to(`user:${receiverId}`).emit('typing:start', {
        userId: socket.userId
      });
    });

    socket.on('typing:stop', ({ receiverId }) => {
      io.to(`user:${receiverId}`).emit('typing:stop', {
        userId: socket.userId
      });
    });

    // Simplified in-memory messaging placeholder (file storage adaptation pending)
    socket.on('message:send', async (data) => {
      try {
        const { receiverId, messageText } = data || {};
        if (!receiverId || !messageText || !messageText.trim()) {
          return socket.emit('message:error', { message: 'Invalid message data' });
        }
        const message = {
          id: Date.now(),
          sender_id: socket.userId,
            receiver_id: receiverId,
          message_text: messageText,
          created_at: new Date().toISOString()
        };
        socket.emit('message:sent', message);
        io.to(`user:${receiverId}`).emit('message:new', message);
      } catch (err) {
        console.error('Socket message send error:', err);
        socket.emit('message:error', { message: 'Failed to send message' });
      }
    });

    socket.on('message:read', (data) => {
      const { messageId, senderId } = data || {};
      if (senderId && messageId) {
        io.to(`user:${senderId}`).emit('message:read', { messageId });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
      connectedUsers.delete(socket.userId);
      
      // Emit offline status
      socket.broadcast.emit('user:offline', { userId: socket.userId });
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

const isUserOnline = (userId) => {
  return connectedUsers.has(userId);
};

const getOnlineUsers = () => {
  return Array.from(connectedUsers.keys());
};

// Send notification to specific user
const sendNotification = (userId, notification) => {
  if (io && connectedUsers.has(userId)) {
    io.to(`user:${userId}`).emit('notification:new', notification);
  }
};

module.exports = {
  initializeSocket,
  getIO,
  isUserOnline,
  getOnlineUsers,
  sendNotification
};
