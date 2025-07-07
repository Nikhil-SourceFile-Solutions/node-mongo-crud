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
const multer = require('multer');
const path = require('path');
dotenv.config();

const app = express();

// ✅ Enable CORS (adjust origin for production)
app.use(cors({
  origin: 'http://i8wo0cs00g4os84cwkc8sowo.31.97.61.92.sslip.io',
  credentials: true,
}));

app.use(express.json());

// Serve static files from uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // upload to 'uploads' folder
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname); // unique filename
  }
});
const upload = multer({ storage });

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



  if (userId) {
    (async () => {
      try {
        if (!userId) return;

        socket.join(userId);  // Join the user's private room

        await User.findByIdAndUpdate(userId, {
          isActive: true,
          lastActive: new Date(),
        });

        const messages = await Chat.find({
          $or: [
            { sender_id: userId },
            { receiver_id: userId },
          ]
        }).select('sender_id receiver_id');

        const interactedUserIds = new Set();

        messages.forEach(msg => {
          if (msg.sender_id?.toString() !== userId) interactedUserIds.add(msg.sender_id.toString());
          if (msg.receiver_id?.toString() !== userId) interactedUserIds.add(msg.receiver_id.toString());
        });

        const uniqueIdsArray = Array.from(interactedUserIds);

        await Chat.updateMany(
          { receiver_id: userId },
          { $set: { isReceived: true } }
        );

        uniqueIdsArray.forEach((targetUserId) => {
          if (targetUserId) io.to(targetUserId).emit('online', userId);
        });

      } catch (err) {
        console.error('Error setting user active or fetching chats:', err.message);
      }
    })();
  } else {
    console.log('No userId provided → disconnecting socket');
    socket.disconnect();
  }

const updateChatViewed = async (chatId) => {
  try {
    const updatedChat = await Chat.findByIdAndUpdate(
      chatId,
      { isViewed: true ,isReceived:true},   // or { is_viewed: true } depending on your schema
      { new: true }         // To return the updated document
    );

    if (updatedChat) {
      io.to(updatedChat.sender_id).emit('message_viewed', updatedChat.receiver_id);
    } else {
      console.log('Chat not found');
    }
  } catch (error) {
    console.error('Error updating chat:', error);
  }
};

socket.on('recived_live', async (data) => {
  console.log("recived_live",data)
updateChatViewed(data);
});

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


  socket.on('typing', ({ toUserId, fromUserId }) => {
    socket.to(toUserId).emit('typing', { fromUserId: socket.id, toUserId: toUserId, fromUserId: fromUserId });
  });

  socket.on('stop_typing', ({ toUserId, fromUserId }) => {
    socket.to(toUserId).emit('stop_typing', { fromUserId: socket.id, toUserId: toUserId, fromUserId: fromUserId });
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




        const messages = await Chat.find({
          $or: [
            { sender_id: userId },
            { receiver_id: userId },
          ]
        }).select('sender_id receiver_id');

        const interactedUserIds = new Set();

        messages.forEach(msg => {
          if (msg.sender_id?.toString() !== userId) interactedUserIds.add(msg.sender_id.toString());
          if (msg.receiver_id?.toString() !== userId) interactedUserIds.add(msg.receiver_id.toString());
        });

        const uniqueIdsArray = Array.from(interactedUserIds);

        uniqueIdsArray.forEach((targetUserId) => {
          if (targetUserId) io.to(targetUserId).emit('offline', { userId, lastActive: new Date() });
        });
      }
    } catch (err) {
      console.error('Error marking user inactive:', err.message);
    }
  });
});

// ✅ MongoDB Connection

// MONGO_URI=mongodb://localhost:27017/{subdomain}

// mongoose.connect(process.env.MONGO_URI)
//   .then(() => console.log('✅ MongoDB connected'))
//   .catch((err) => console.error('❌ DB connection error:', err));

// ✅ Routes

const baseMongoURI = 'mongodb://root:8cPRPkhKFCFlqhFLNg2Dcd5Yd3kkdHkYW3yKn8k5KBfptOVDZ4vGYZGt5M5J77CP@pcokcswowoc4cgow4cook0o0:27017/';
app.use(async (req, res, next) => {
  // e.g., growthcrm.thefinsap.com
  const subdomain =req.headers.crm || 'defaultdb';  // fallback db name

  const fullMongoURI = `${baseMongoURI}${subdomain}?directConnection=true`;

  if (!mongoose.connection.readyState) {
    try {
      await mongoose.connect(fullMongoURI, { useNewUrlParser: true, useUnifiedTopology: true });
      console.log(`✅ Connected to DB: ${subdomain}`);
    } catch (err) {
      console.error('❌ MongoDB Connection Error:', err);
    }
  }

  req.dbName = subdomain;
  next();
});

app.get('/', (req, res) => {
  res.send(`Connected to database: ${req.dbName}`);
});



app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', homeRoutes);

// ✅ Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
