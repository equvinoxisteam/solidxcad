import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', index: true },
    type: {
      type: String,
      enum: ['cad_generate', 'chat', 'slice', 'export', 'parts_search'],
      required: true,
    },
    status: {
      type: String,
      enum: ['queued', 'running', 'completed', 'failed'],
      default: 'queued',
    },
    input: mongoose.Schema.Types.Mixed,
    output: mongoose.Schema.Types.Mixed,
    error: String,
    creditsCharged: { type: Number, default: 0 },
    startedAt: Date,
    completedAt: Date,
  },
  { timestamps: true },
);

export const Job = mongoose.model('Job', jobSchema);
