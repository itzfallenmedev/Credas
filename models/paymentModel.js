const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: String,
    price: Number,
    salePrice: Number, 
    originalPrice: Number,
});

const paymentSchema = new mongoose.Schema({
    ID: { type: Number, required: true, unique: true },
    transactionID: { type: String, required: true },
    paymentMethod: { type: String, required: true },
    userID: { type: String, required: true },
    username: { type: String, required: true },
    email: { type: String, required: true },
    products: [productSchema],
    discountCode: { type: String, default: null },
    discountPercentage: { type: Number, default: 0 },
    originalSubtotal: { type: Number, required: true },
    salesTaxAmount: { type: Number, required: true },
    discountAmount: { type: Number, required: true },
    totalPaid: { type: Number, required: true },
    publicId: { type: String, default: null, unique: true, sparse: true, index: true },
    tokenSecret: { type: String, default: null },
    status: { type: String, enum: ['paid', 'refunded', 'partially_refunded', 'disputed', 'failed'], default: 'paid' },
    refundedAmount: { type: Number, default: 0 },
    refundedAt: { type: Date, default: null },
    refundReason: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});


module.exports = mongoose.model('Payment', paymentSchema);
