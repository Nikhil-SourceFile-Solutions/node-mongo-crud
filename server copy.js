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
// app.use(cors());

app.use(cors({
  origin: 'http://i8wo0cs00g4os84cwkc8sowo.31.97.61.92.sslip.io', // or your live frontend
  credentials: true
}));
app.use(express.json());

// ✅ Create and use actual HTTP server
const server = http.createServer(app);

// ✅ Attach socket.io to the same server
const io = socketIo(server, {
    cors: {
        origin: 'http://i8wo0cs00g4os84cwkc8sowo.31.97.61.92.sslip.io', // your frontend port
        //  origin: 'http://i8wo0cs00g4os84cwkc8sowo.31.97.61.92.sslip.io',
        methods: ['GET', 'POST'],
        credentials: true,
    }
});


const activeUsers = new Map();

// ✅ Handle socket.io connections
// io.on('connection', (socket) => {
//     console.log('User connected:', socket.id);

//      socket.on('user_connected', (userId) => {
//       console.log("first",userId)
//         // activeUsers.set(socket.id, { userId, lastActive: new Date() });
//         // console.log(`User ${userId} connected`);
//     });

//     socket.on('send_message', (data) => {
//         io.emit('receive_message', data);
//     });

//     socket.on('disconnect', () => {
//         console.log('User disconnected:', socket.id);
//     });
// });


io.on('connection', (socket) => {

    const userId = socket.handshake.auth.userId;

 
  console.log('User connected with ID:', userId, 'Socket ID:', socket.id);

    (async () => {
    if (userId) {
      await User.findByIdAndUpdate(userId, {
        isActive: true,
        lastActive: new Date()
      });
    }})();
  // socket.on('user_connected', async (userId) => {
  //   activeUsers.set(socket.id, { userId, lastActive: new Date() });

  //   // Optional: mark them active in DB (if needed)
  //   await User.findByIdAndUpdate(userId, {
  //     $set: { lastActive: new Date() },
  //   });
  // });

  socket.on('send_message', (data) => {
    io.emit('receive_message', data);
    const user = activeUsers.get(socket.id);
    if (user) {
      user.lastActive = new Date();
    }
  });


  socket.on('disconnect', async () => {
    console.log('User disconnected:', userId);

    // Mark user as inactive
    if (userId) {
      await User.findByIdAndUpdate(userId, { isActive: false, lastActive: new Date() });
    }
  });
});

// ✅ Connect MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('MongoDB connected');
}).catch(err => {
  console.error('MongoDB connection error:', err.message);
});

// ✅ API routes
app.get('/', (req, res) => {
  res.send('API is running...');
});

app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', homeRoutes);

// ✅ Start correct server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
