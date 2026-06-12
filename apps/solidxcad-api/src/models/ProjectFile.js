import mongoose from 'mongoose';

const projectFileSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    s3Key: { type: String, required: true },
    mimeType: String,
    kind: {
      type: String,
      enum: ['step', 'stl', 'glb', 'gcode', 'urdf', 'srdf', 'sdf', 'implicit', 'dxf', '3mf', 'other'],
      default: 'other',
    },
    sizeBytes: Number,
  },
  { timestamps: true },
);

export const ProjectFile = mongoose.model('ProjectFile', projectFileSchema);
