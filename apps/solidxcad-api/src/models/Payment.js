import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    razorpayOrderId: String,
    razorpayPaymentId: String,
    amount: Number,
    currency: { type: String, default: 'USD' },
    plan: { type: String, default: 'pro' },
    status: { type: String, enum: ['created', 'paid', 'failed'], default: 'created' },
    creditsGranted: Number,
  },
  { timestamps: true },
);

export const Payment = mongoose.model('Payment', paymentSchema);
