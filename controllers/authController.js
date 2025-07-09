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




exports.crmRegister = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = {};
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
    const { email, crm } = req.body;

    // ✅ Check if user already exists with same CRM and email
    const existingUser = await User.findOne({ email, crm });
    if (existingUser) {
      return res.status(200).json({
  status: 'success',
  message: 'User registered successfully',
  id: existingUser._id
});
    }

    // ✅ Create user if not exists
  const user = await User.create(req.body);

return res.status(200).json({
  status: 'success',
  message: 'User registered successfully',
  id: user._id
});

  } catch (err) {

    // ✅ Handle Duplicate Key Error (MongoDB unique index)
    if (err.code === 11000) {
      const formattedErrors = {};
      const duplicateField = Object.keys(err.keyPattern)[0];
      formattedErrors[duplicateField] = [
        `${duplicateField.charAt(0).toUpperCase() + duplicateField.slice(1)} already exists`
      ];

      return res.status(422).json({
        status: 'error',
        message: 'Duplicate field',
        errors: formattedErrors,
      });
    }

    // ✅ Handle Mongoose validation errors
    if (err.name === 'ValidationError') {
      const formattedErrors = {};
      Object.keys(err.errors).forEach(key => {
        formattedErrors[key] = [err.errors[key].message];
      });

      return res.status(422).json({
        status: 'error',
        message: 'Validation failed',
        errors: formattedErrors,
      });
    }

    // ✅ General fallback error
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


exports.directLogin = async (req, res) => {
  try {
    const { subdomain, user_id } = req.body;

    if (!subdomain || !user_id) {
      return res.status(400).json({
        status: 'error',
        message: 'subdomain and user_id are required',
      });
    }

    const user = await User.findOne({ _id: user_id, crm: subdomain });

    if (!user) {
      return res.status(422).json({
        status: 'error',
        message: 'User not found',
        errors: {
          email: ['Invalid login credentials'],
        },
      });
    }

     const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
   res.json({status:"success", token:token,user:JSON.stringify(user) });

  } catch (error) {
    console.error('Direct login error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};


