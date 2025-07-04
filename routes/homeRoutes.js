const express = require('express');
const router = express.Router();
const homeController = require('../controllers/homeController');
const { protect } = require('../middleware/authMiddleware');
const multer = require('multer');

// Multer storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage });

// Destructure controller function
const { sendMessage } = require('../controllers/homeController');

// Routes
router.get('/home-data', protect, homeController.homeData);
router.get('/chat-data', protect, homeController.chatData);
router.get('/all-users', protect, homeController.allUsers);

router.post('/messages', protect, upload.single('file'), sendMessage);

module.exports = router;