const mongoose = require('mongoose');

const newsletterSchema = new mongoose.Schema({
  email: { type: String, required: true, trim: true, lowercase: true },
  createdAt: { type: Date, default: Date.now }
});

newsletterSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model('Newsletter', newsletterSchema);
