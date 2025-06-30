const express = require('express');
const router = express.Router();
const homeController = require('../controllers/homeController');
const { protect } = require('../middleware/authMiddleware');

router.get('/home-data',protect, homeController.homeData);
router.get('/chat-data',protect, homeController.chatData);
router.post('/messages', protect, homeController.sendMessage);
module.exports = router;