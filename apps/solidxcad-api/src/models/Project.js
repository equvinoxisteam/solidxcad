import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    thumbnailUrl: String,
    lastPrompt: String,
  },
  { timestamps: true },
);

export const Project = mongoose.model('Project', projectSchema);
