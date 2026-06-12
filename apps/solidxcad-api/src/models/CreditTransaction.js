import mongoose from 'mongoose';

const creditTransactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    delta: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    reason: { type: String, required: true },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
    meta: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true },
);

export const CreditTransaction = mongoose.model('CreditTransaction', creditTransactionSchema);
