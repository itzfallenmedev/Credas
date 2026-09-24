const mongoose = require('mongoose');

const translationSchema = new mongoose.Schema({
  locale: { type: String, required: true, index: true },
  key: { type: String, required: true },
  value: { type: String, required: true, maxlength: 2000 },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

translationSchema.index({ locale: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('Translation', translationSchema);
