const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const homeRoutes = require('./routes/homeRoutes');
const User = require('./models/User');
const Chat = require('./models/Chat');
const path = require('path');

dotenv.config();

const app = express();

// Enable CORS (adjust origin for production)
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://chat.sourcefile.online',
  credentials: true,
}));

app.use(express.json());

// Serve static files from uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Create HTTP server and attach Socket.IO
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://chat.sourcefile.online',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Attach io to app
app.set('io', io);

// Helper to get interacted users
const getInteractedUserIds = async (userId) => {
  const messages = await Chat.find({
    $or: [
      { sender_id: userId },
      { receiver_id: userId },
    ],
  }).select('sender_id receiver_id');

  const interactedUserIds = new Set();

  messages.forEach(msg => {
    if (msg.sender_id?.toString() !== userId) interactedUserIds.add(msg.sender_id.toString());
    if (msg.receiver_id?.toString() !== userId) interactedUserIds.add(msg.receiver_id.toString());
  });

  return Array.from(interactedUserIds);
};

// Socket.IO Connection
io.on('connection', (socket) => {
  const userId = socket.handshake.auth?.userId;

  console.log('User connected with ID:', userId, 'Socket ID:', socket.id);

  if (!userId) {
    console.log('No userId provided → disconnecting socket');
    return socket.disconnect();
  }

  (async () => {
    try {
      socket.join(userId);

      await User.findByIdAndUpdate(userId, {
        isActive: true,
        lastActive: new Date(),
      });

      const uniqueIdsArray = await getInteractedUserIds(userId);

      await Chat.updateMany(
        { receiver_id: userId },
        { $set: { isReceived: true } }
      );

      uniqueIdsArray.forEach((targetUserId) => {
        if (targetUserId) io.to(targetUserId).emit('online', userId);
      });

    } catch (err) {
      console.error('Error setting user active or fetching chats:', err);
    }
  })();

  socket.on('send_message', async (data) => {
    try {
      console.log(`Message from ${userId} to ${data.receiver_id}: ${data.message}`);

      io.to(data.receiver_id).emit('receive_message', data);

      await User.findByIdAndUpdate(userId, { lastActive: new Date() });

    } catch (err) {
      console.error('Error sending message:', err);
    }
  });

  socket.on('typing', ({ toUserId, fromUserId }) => {
    socket.to(toUserId).emit('typing', { fromUserId, toUserId });
  });

  socket.on('stop_typing', ({ toUserId, fromUserId }) => {
    socket.to(toUserId).emit('stop_typing', { fromUserId, toUserId });
  });

  socket.on('disconnect', async () => {
    console.log('User disconnected:', userId);

    try {
      await User.findByIdAndUpdate(userId, {
        isActive: false,
        lastActive: new Date(),
      });

      const uniqueIdsArray = await getInteractedUserIds(userId);

      uniqueIdsArray.forEach((targetUserId) => {
        if (targetUserId) io.to(targetUserId).emit('offline', { userId, lastActive: new Date() });
      });

    } catch (err) {
      console.error('Error marking user inactive:', err);
    }
  });
});

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ DB connection error:', err));

// Routes
app.get('/', (req, res) => {
  res.send('✅ API is running...');
});

app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', homeRoutes);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
