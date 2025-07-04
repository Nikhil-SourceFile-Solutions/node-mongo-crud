const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();
// ✅ Step 1: Validation Middleware (defined separately)
exports.validateRegister = [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Enter a valid email'),
    body('phone').isLength({ min: 10 }).withMessage('Enter a valid phone number'),
    body('password').isLength({ min: 6 }).withMessage('Password too short'),
];

console.log("JWT_SECRET:", process.env.JWT_SECRET);
// ✅ Step 2: Register Controller
exports.register = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    // 👉 Format errors like Laravel
    let formattedErrors = {};
    errors.array().forEach(error => {
      if (!formattedErrors[error.param]) {
        formattedErrors[error.param] = [error.msg];
      }
    });

    return res.status(422).json({
      status: 'error',
      message: 'Validation failed',
      errors: formattedErrors,
    });
  }

  try {
    const user = await User.create(req.body);

    return res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
    });

  } catch (err) {

   // Handle Duplicate Key Errors (MongoDB)
  if (err.code === 11000) {
    const formattedErrors = {};
    const duplicateField = Object.keys(err.keyPattern)[0];
    formattedErrors[duplicateField] = [`${duplicateField.charAt(0).toUpperCase() + duplicateField.slice(1)} already exists`];

    return res.status(422).json({
      status: 'error',
      message: 'Duplicate field',
      errors: formattedErrors,
    });
  }

  // Handle Mongoose Validation Errors
  if (err.name === 'ValidationError') {
    const formattedErrors = {};
    Object.keys(err.errors).forEach((key) => {
      formattedErrors[key] = [err.errors[key].message];
    });

    return res.status(422).json({
      status: 'error',
      message: 'Validation failed',
      errors: formattedErrors,
    });
  }

  // Fallback for other errors
  return res.status(500).json({
    status: 'error',
    message: err.message || 'Something went wrong',
  });
  }
};



exports.login = async (req, res) => {
  const { email, password } = req.body;
   const user = await User.findOne({ email });
  if (!user) {
  return res.status(422).json({
    status: 'error',
    message: 'User not found',
    errors: {
      email: ['invalid login credentials'],
    },
  });
}
   const match = await bcrypt.compare(password, user.password);
   if (!match) return res.status(422).json({
    status: 'error',
    message: 'User not found',
    errors: {
      password: ['invalid login credentials'],
    },
  });
   const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
   res.json({status:"success", token:token,user:JSON.stringify(user) });
};