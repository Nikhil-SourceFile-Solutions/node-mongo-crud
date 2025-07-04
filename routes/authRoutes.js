const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

const multer = require('multer');
const upload = multer()

router.post('/login', authController.login);

router.post('/register', upload.none(), authController.register);






module.exports = router;