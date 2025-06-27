const { body, validationResult } = require('express-validator');
const User = require('../models/User');


// ✅ Step 1: Validation Middleware (defined separately)
exports.validateRegister = [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Enter a valid email'),
    body('phone').isLength({ min: 10 }).withMessage('Enter a valid phone number'),
    body('password').isLength({ min: 6 }).withMessage('Password too short'),
];

// ✅ Step 2: Register Controller
exports.register = async (req, res) => {
    // Check validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }

    try {
        const user = await User.create(req.body);
        res.status(201).json(user);
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
    try {
        const user = await User.create(req.body);
        res.status(201).json(user);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};