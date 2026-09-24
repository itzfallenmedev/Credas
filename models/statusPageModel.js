const mongoose = require('mongoose');

const componentSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  state: { type: String, enum: ['operational', 'degraded', 'partial', 'down'], default: 'operational' }
}, { _id: false });

const incidentSchema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 160 },
  status: { type: String, enum: ['investigating', 'identified', 'monitoring', 'resolved'], default: 'investigating' },
  impact: { type: String, enum: ['none', 'minor', 'major', 'critical'], default: 'minor' },
  body: { type: String, default: '' },
  updates: [{
    status: { type: String, default: 'investigating' },
    body: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
  }],
  components: [{ type: String }],
  resolvedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

const statusSchema = new mongoose.Schema({
  headline: { type: String, default: 'All systems operational' },
  showBanner: { type: Boolean, default: false },
  components: [componentSchema],
  incidents: [incidentSchema],
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('StatusPage', statusSchema);
