const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// ✅ 1. Define schema first
const chatSchema = new mongoose.Schema({
  sender_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  receiver_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  message: {
    type: String,
    default: '',
  },
  type: {
    type: String,
    enum: ['text', 'image', 'video', 'document'], 
    required: true,
  },
 data: {
    type: Object,    
    default: {},    
  },
  isReceived: {
    type: Boolean,
    default: false,
  },
  isViewed: {
    type: Boolean,
    default: false,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true, 
});


module.exports = mongoose.model('Chat', chatSchema);