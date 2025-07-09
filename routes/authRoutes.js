const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

const multer = require('multer');
const upload = multer()

router.post('/login', authController.login);

router.post('/register', upload.none(), authController.register);

router.post('/crm-register', authController.crmRegister);

router.post('/direct-login', authController.directLogin);




module.exports = router;