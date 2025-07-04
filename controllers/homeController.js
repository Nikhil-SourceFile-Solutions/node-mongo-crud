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
        avatar:user?.avatar||'',
        lastMessage: lastChat
          ? {
            message: lastChat.message?.slice(0, 40),
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

  //  await Chat.deleteMany();
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
      chats: chats
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};


exports.sendMessage = async (req, res) => {
  try {
    const { receiver_id, message, type } = req.body;

     // Multer adds the file info to req.file
    const file = req.file;
    const filePath = file ? file.filename : null;  // Save only filename or relative path
 const originalName = req.file ? req.file.originalname : '';
 const fileSize = req.file ? req.file.size : 0;
     const newChat = await Chat.create({
      sender_id: req.user.id,
      receiver_id,
      message,
      type,
      data: {
        filePath:'uploads/'+filePath,
        originalName:originalName,
        fileSize:fileSize
      },   // Save filename, NOT binary data
    });

    


    res.status(201).json({ status: 'success', chat: newChat });
    const io = req.app.get('io');

    io.to(receiver_id).emit('receive_message', newChat);


    io.to(receiver_id).emit('apple', 1155);

  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};


exports.allUsers = async (req, res) => {
  try {
    //  await User.deleteMany();

    const authUserId = req.user?.id || req.query.authUserId;

    const users = await User.find({ _id: { $ne: authUserId } }).select('-password');
    res.status(200).json({ status: 'success', users: users });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};


exports.updateProfile = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const authUserId = req.user.id || req.query.authUserId;

    if (!authUserId) {
      return res.status(400).json({ status: 'error', message: 'User ID missing' });
    }

    const user = await User.findById(authUserId);

    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    // ✅ Update text fields
    if (name) user.name = name;
    if (email) user.email = email;
    if (phone) user.phone = phone;

    // ✅ Update avatar if file uploaded
    if (req.file) {
      const filePath = 'uploads/' + req.file.filename;  // Save relative path
      user.avatar = filePath;
    }

    await user.save();

    return res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully',
      user:JSON.stringify(user),
    });

  } catch (error) {
    console.error('Profile update error:', error);
    return res.status(500).json({ status: 'error', message: 'Something went wrong' });
  }
};