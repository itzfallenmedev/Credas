const mongoose = require('mongoose');

const auditSchema = new mongoose.Schema({
  actorID: { type: String, default: null, index: true },
  actorUsername: { type: String, default: 'system' },
  action: { type: String, required: true, index: true },
  entity: { type: String, index: true },
  entityID: { type: String, index: true },
  summary: { type: String, default: '' },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  ip: { type: String, default: null },
  userAgent: { type: String, default: null },
  createdAt: { type: Date, default: Date.now, index: true }
}, { timestamps: false });

auditSchema.index({ createdAt: -1 });
auditSchema.index({ entity: 1, entityID: 1 });

module.exports = mongoose.model('AuditLog', auditSchema);
