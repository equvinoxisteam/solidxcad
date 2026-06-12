import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
    creditsUsed: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);
