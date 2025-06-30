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
    // Check validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }

    try {
        const user = await User.create(req.body);
       res.status(201).json({
  status: 'success',
  message: 'User registered successfully',
});
    } catch (err) {
        if (err.code === 11000) {
            // Duplicate key error
            const duplicateField = Object.keys(err.keyPattern)[0];
            if (duplicateField === 'email')  return res.status(422).json({ error: 'Email already exists' });
            if (duplicateField === 'phone') return res.status(422).json({ error: 'Phone number already exists' });

            // Fallback generic duplicate error
            return res.status(422).json({ error: 'Duplicate field error' });
        }

        res.status(500).json({ error: err.message });

    }
};



exports.login = async (req, res) => {
  const { email, password } = req.body;
   const user = await User.findOne({ email });
   if (!user) return res.status(422).json({ message: 'User not found' });
   const match = await bcrypt.compare(password, user.password);
   if (!match) return res.status(422).json({ message: 'Wrong password' });
   const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
   res.json({status:"success", token:token,user:JSON.stringify(user) });
};