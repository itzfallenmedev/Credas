const mongoose = require('mongoose');

const bundleSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
  description: { type: String, default: '' },
  bannerImage: { type: String, default: '' },

  products: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    priceAtBuild: { type: Number, default: 0 }
  }],

  price: { type: Number, required: true, min: 0 },
  compareAtPrice: { type: Number, default: null },
  productType: { type: String, enum: ['bundle', 'service'], default: 'bundle' },
  serviceMessage: { type: String, default: '' },

  position: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  onSale: { type: Boolean, default: false },
  salePrice: { type: Number, default: null },
  saleStartDate: { type: Date, default: null },
  saleEndDate: { type: Date, default: null },

  soldCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

bundleSchema.virtual('totalValue').get(function () {
  return (this.products || []).reduce(function (sum, p) { return sum + (p.priceAtBuild || 0); }, 0);
});

module.exports = mongoose.model('Bundle', bundleSchema);
