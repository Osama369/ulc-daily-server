import mongoose from 'mongoose';

const TransferSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'done', 'failed'], default: 'pending' },
  attempts: { type: Number, default: 0 },
  idempotencyKey: { type: String, index: true, sparse: true },
  meta: { type: Object },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
});

// Ensure idempotencyKey is unique when present to prevent duplicate logical operations
TransferSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

export default mongoose.model('Transfer', TransferSchema);
