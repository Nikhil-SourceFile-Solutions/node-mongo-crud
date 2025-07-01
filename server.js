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

dotenv.config();

const app = express();

// ✅ Enable CORS (adjust origin for production)
app.use(cors({
  origin: 'http://i8wo0cs00g4os84cwkc8sowo.31.97.61.92.sslip.io',
  credentials: true,
}));

app.use(express.json());

// ✅ Create HTTP server and attach Socket.IO
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: 'http://i8wo0cs00g4os84cwkc8sowo.31.97.61.92.sslip.io',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// ✅ Attach io to app (optional: use in routes)
app.set('io', io);

// ✅ Socket.IO Connection
io.on('connection', (socket) => {
  const userId = socket.handshake.auth?.userId;

  console.log('User connected with ID:', userId, 'Socket ID:', socket.id);

  (async () => {
    try {
      if (userId) {
        socket.join(userId); // join room
        await User.findByIdAndUpdate(userId, {
          isActive: true,
          lastActive: new Date(),
        });
      }
    } catch (err) {
      console.error('Error setting user active:', err.message);
    }
  })();

  // ✅ Message sending
  socket.on('send_message', async (data) => {
    try {
      console.log(`Message from ${userId} to ${data.receiver_id}: ${data.message}`);

      // Emit to receiver
      io.to(data.receiver_id).emit('receive_message', data);

      // Emit to sender (optional)
      io.to(userId).emit('receive_message', data);

      // Update sender activity
      if (userId) {
        await User.findByIdAndUpdate(userId, { lastActive: new Date() });
      }
    } catch (err) {
      console.error('Error sending message:', err.message);
    }
  });


    socket.on('typing', ({ toUserId }) => {
    socket.to(toUserId).emit('typing', { fromUserId: socket.id });
  });

  socket.on('stop_typing', ({ toUserId }) => {
    socket.to(toUserId).emit('stop_typing', { fromUserId: socket.id });
  });

  // ✅ On disconnect
  socket.on('disconnect', async () => {
    console.log('User disconnected:', userId);

    try {
      if (userId) {
        await User.findByIdAndUpdate(userId, {
          isActive: false,
          lastActive: new Date(),
        });
      }
    } catch (err) {
      console.error('Error marking user inactive:', err.message);
    }
  });
});

// ✅ MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ DB connection error:', err));

// ✅ Routes
app.get('/', (req, res) => {
  res.send('✅ API is running...');
});

app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', homeRoutes);

// ✅ Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
