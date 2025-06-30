const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// ✅ 1. Define schema first
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    match: [/^\S+@\S+\.\S+$/, 'Invalid email format']
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    minlength: [10, 'Phone must be at least 10 digits']
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },

  // ✅ Add this field
   isActive: { type: Boolean, default: false },
  lastActive: { type: Date, default: null }

}, {
  timestamps: true
});


// ✅ 2. Add password hashing hook
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// ✅ 3. Export the model
module.exports = mongoose.model('User', userSchema);