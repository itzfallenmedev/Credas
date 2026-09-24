const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  authorID: { type: String, required: true },
  authorName: { type: String, required: true },
  authorRole: { type: String, enum: ['buyer', 'staff', 'system'], default: 'buyer' },
  body: { type: String, required: true, maxlength: 8000 },
  attachments: [{ name: String, url: String, size: Number }],
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

const ticketSchema = new mongoose.Schema({
  reference: { type: String, required: true, unique: true, index: true },
  subject: { type: String, required: true, maxlength: 200 },
  category: { type: String, enum: ['technical', 'billing', 'account', 'feature-request', 'other'], default: 'technical' },
  priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
  status: { type: String, enum: ['open', 'awaiting-customer', 'awaiting-staff', 'resolved', 'closed'], default: 'open', index: true },

  userID: { type: String, index: true },
  username: { type: String },
  email: { type: String },

  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  productName: { type: String, default: '' },
  orderID: { type: Number },

  assignedTo: { type: String, default: null },
  messages: [messageSchema],

  lastReplyAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

ticketSchema.index({ userID: 1, status: 1 });
ticketSchema.index({ status: 1, priority: 1, lastReplyAt: -1 });

module.exports = mongoose.model('Ticket', ticketSchema);
