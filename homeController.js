const User = require('../models/User');
const Chat = require('../models/Chat');
const dayjs = require('dayjs');
const relativeTime = require('dayjs/plugin/relativeTime');
const { default: axios } = require('axios');
dayjs.extend(relativeTime);
const bcrypt = require('bcrypt');


exports.homeData = async (req, res) => {
  const crm = req.headers.crm;
  const user_id = req.headers.user_id;

  if (!crm) return res.status(400).json({ message: 'CRM header missing' });

  const authUserId = req.user.id || req.query.authUserId;

  // 🟢 Step 1: Get all chat partners filtered by CRM

  const usersInCrm = await User.find({ crm }).select('_id');
const userIdsInCrm = usersInCrm.map(u => u._id.toString());

  const chatPartners = await Chat.find({
    // crm: crm,
     $or: [
    { sender_id: { $in: userIdsInCrm } },
    { receiver_id: { $in: userIdsInCrm } },
  ],
    $or: [
      { sender_id: authUserId },
      { receiver_id: authUserId }
    ]
  }).distinct("sender_id");

  const chatReceivers = await Chat.find({
    // crm: crm,
     $or: [
    { sender_id: { $in: userIdsInCrm } },
    { receiver_id: { $in: userIdsInCrm } },
  ],
    $or: [
      { sender_id: authUserId },
      { receiver_id: authUserId }
    ]
  }).distinct("receiver_id");

  const allPartnerIds = [...new Set([...chatPartners, ...chatReceivers])]
    .filter(id => id.toString() !== authUserId.toString());

  // 🟢 Step 2: Get users from same CRM only
  const users = await User.find({ _id: { $in: allPartnerIds }, crm });

  // 🟢 Step 3: Format user data
  const formattedUsers = await Promise.all(
    users.map(async (user) => {
      const lastChat = await Chat.findOne({
        crm,
        $or: [
          { sender_id: authUserId, receiver_id: user._id },
          { sender_id: user._id, receiver_id: authUserId },
        ],
      })
        .sort({ createdAt: -1 })
        .lean();

      const unreadCount = await Chat.countDocuments({
        crm,
        sender_id: user._id,
        receiver_id: authUserId,
        isViewed: false,
      });

      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user?.avatar || '',
        lastMessage: lastChat
          ? {
              message: lastChat.message?.slice(0, 40),
              type: lastChat.type,
              createdAt: lastChat.createdAt,
              from: lastChat.sender_id,
            }
          : null,
        unreadCount: unreadCount,
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


   await Chat.updateMany(
  { sender_id: userId, receiver_id: authUserId },
  { $set: { isViewed: true } }
);

await Chat.updateMany(
  { receiver_id: authUserId },
  { $set: { isReceived: true } }
);

// also info to all user that message recived

const io = req.app.get('io');
const c = await Chat.find({ receiver_id: authUserId }).select('sender_id');
const senderIds = [...new Set(c.map(chat => chat.sender_id.toString()))];

senderIds.forEach((ee)=>{
 io.to(ee).emit('viewed', authUserId);
})
 


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
    const crm = req.headers.crm;

    if (!crm) {
      return res.status(400).json({ status: 'error', message: 'CRM header missing' });
    }

    const authUserId = req.user?.id || req.query.authUserId;

    // Step 1: Check for existing users
    let users = await User.find({
      crm,
      _id: { $ne: authUserId }
    }).select('-password');

//     // Step 2: If no users found, fetch from external CRM API
//     if (users.length === 0) {
//       try {
//         const response = await axios.get(`http://${crm}.localhost:8000/api/get-all-users`, {
//           headers: {
//             'crm': crm  // Optional: if the external server expects this header
//           }
//         });

//         const externalUsers = response.data || [];

//         // Step 3: Insert fetched users into MongoDB
//        const hashedPassword = await bcrypt.hash('123456', 10);

// const insertedUsers = await User.insertMany(
//   externalUsers.map(user => ({
//     crm,
//     name: user.name,
//     email: user.email,
//     phone: user.phone,
//     avatar: '',
//     password: hashedPassword,  // pre-hashed manually
//   }))
// );
//         // Step 4: Reload the inserted users (without password)
//         users = insertedUsers.map(u => {
//           const { password, ...rest } = u.toObject();
//           return rest;
//         });

//       } catch (externalErr) {
//         console.error('Error fetching users from external CRM:', externalErr.message);
//         return res.status(500).json({ status: 'error', message: 'Failed to fetch users from external CRM' });
//       }
//     }

    res.status(200).json({ status: 'success', users });

  } catch (err) {
    console.error('allUsers error:', err);
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