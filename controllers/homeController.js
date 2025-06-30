const User = require('../models/User');
const Chat = require('../models/Chat');
const dayjs = require('dayjs');
const relativeTime = require('dayjs/plugin/relativeTime');
dayjs.extend(relativeTime);


exports.homeData = async (req, res) => {
  const users = await User.find();

  const formattedUsers = users.map(user => {
    return {
      ...user._doc,
      lastActiveReadable: user.lastActive ? dayjs(user.lastActive).fromNow() : 'Never',
    };
  });

  res.status(200).json({ users: formattedUsers, status: 'success' });
};




exports.chatData = async (req, res) => {
  try {
    const userId = req.query._id;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const readableLastActive = user.lastActive
      ? dayjs(user.lastActive).fromNow()
      : 'Never';

      const authUserId = req.user.id;
   

    if (!userId) {
      return res.status(400).json({ status: 'error', message: 'Other user ID is required' });
    }

    const chats = await Chat.find({
      $or: [
        { sender_id: authUserId, receiver_id: userId },
        { sender_id: userId, receiver_id: authUserId }
      ]
    }).sort({ createdAt: 1 });

    return res.status(200).json({
      user: {
        ...user._doc,
        lastActiveReadable: readableLastActive,
      },
      status: 'success',
      chats:chats
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};


exports.sendMessage = async (req, res) => {
  try {
    const { receiver_id, message, type, data } = req.body;

    const newChat = await Chat.create({
      sender_id: req.user.id, 
      receiver_id,
      message,
      type,
      data,
    });
    res.status(201).json({ status: 'success', chat: newChat });
    const io = req.app.get('io');
    io.to(receiver_id).emit('receive_message', newChat);

  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};
