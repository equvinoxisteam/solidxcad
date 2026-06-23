import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    thumbnailUrl: String,
    lastPrompt: String,
    isPublic: { type: Boolean, default: false, index: true },
    publishedAt: { type: Date, default: null },
    previewFileId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProjectFile', default: null },
    remixOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
    remixCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

projectSchema.index({ isPublic: 1, publishedAt: -1 });
projectSchema.index({ isPublic: 1, remixCount: -1 });

export const Project = mongoose.model('Project', projectSchema);
