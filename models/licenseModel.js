const mongoose = require('mongoose');

const licenseSchema = new mongoose.Schema({
  key: { type: String, default: null },
  keyHash: { type: String, required: true, unique: true, index: true },
  keyEnc: { type: String, required: true },

  sessions: [{ sessionId: String, lastSeenAt: Date }],
  ipHistory: [{ type: String }],

  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  productName: { type: String, required: true },

  ownerID: { type: String, index: true },
  ownerUsername: { type: String },
  orderID: { type: Number },

  status: { type: String, enum: ['active', 'suspended', 'banned', 'expired'], default: 'active', index: true },
  banReason: { type: String, default: '' },

  hwid: { type: String, default: null },
  maxHwid: { type: Number, default: 1, min: 0 },
  hwidLockedAt: { type: Date },

  sessionLimit: { type: Number, default: 0 },
  ipLimit: { type: Number, default: 0 },

  expiresAt: { type: Date, default: null, index: true },
  lastSeenAt: { type: Date, default: null },
  lastIp: { type: String, default: null },
  checkCount: { type: Number, default: 0 },
  totalChecks: { type: Number, default: 0 },

  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

licenseSchema.index({ product: 1, status: 1 });
licenseSchema.index({ ownerID: 1, product: 1 });

licenseSchema.virtual('expired').get(function () {
  return !!(this.expiresAt && this.expiresAt.getTime() <= Date.now());
});

licenseSchema.methods.effectiveStatus = function () {
  if (this.status === 'active' && this.expiresAt && this.expiresAt.getTime() <= Date.now()) return 'expired';
  return this.status;
};

module.exports = mongoose.model('License', licenseSchema);
