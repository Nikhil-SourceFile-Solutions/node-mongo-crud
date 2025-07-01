const User = require('../models/User');
const Chat = require('../models/Chat');
const dayjs = require('dayjs');
const relativeTime = require('dayjs/plugin/relativeTime');
dayjs.extend(relativeTime);



exports.homeData = async (req, res) => {
  const authUserId = req.user.id || req.query.authUserId;

  // 🟢 Step 1: Get all user IDs who have chatted with the auth user
  const chatPartners = await Chat.find({
    $or: [
      { sender_id: authUserId },
      { receiver_id: authUserId }
    ]
  }).distinct("sender_id"); // get unique sender IDs

  const chatReceivers = await Chat.find({
    $or: [
      { sender_id: authUserId },
      { receiver_id: authUserId }
    ]
  }).distinct("receiver_id");

  const allPartnerIds = [...new Set([...chatPartners, ...chatReceivers])]
    .filter(id => id.toString() !== authUserId.toString());

  // 🟢 Step 2: Now get only those users
  const users = await User.find({ _id: { $in: allPartnerIds } });

  // 🟢 Step 3: Format user data
  const formattedUsers = await Promise.all(
    users.map(async (user) => {
      const lastChat = await Chat.findOne({
        $or: [
          { sender_id: authUserId, receiver_id: user._id },
          { sender_id: user._id, receiver_id: authUserId },
        ],
      })
        .sort({ createdAt: -1 })
        .lean();

      const unreadCount = await Chat.countDocuments({
        sender_id: user._id,
        receiver_id: authUserId,
        isViewed: false,
      });

      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        lastMessage: lastChat
          ? {
              text: lastChat.message?.slice(0, 40),
              type: lastChat.type,
              createdAt: lastChat.createdAt,
              from: lastChat.sender_id,
            }
          : null,
        unreadCount,
        lastActiveReadable: user.lastActive
          ? dayjs(user.lastActive).fromNow()
          : 'Never',
      };
    })
  );

  res.status(200).json({
    users: formattedUsers,
    status: 'success',
    authUserId: authUserId,
    apple: 150
  });
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
      : '';

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
