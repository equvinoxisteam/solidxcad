import fs from 'fs/promises';
import { Router } from 'express';
import { Project } from '../models/Project.js';
import { ProjectFile } from '../models/ProjectFile.js';
import { filterUserVisibleFiles } from '../services/projectFileVisibility.js';
import { ChatMessage } from '../models/ChatMessage.js';
import { Job } from '../models/Job.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateObjectId } from '../middleware/validateObjectId.js';
import {
  deleteProjectStorage,
  deleteStorageKey,
  getSignedDownloadUrl,
  publicUrlForKey,
  getObjectStream,
} from '../services/s3.js';
import { projectWorkspaceDir } from '../services/projectWorkspace.js';

const router = Router();
router.use(requireAuth);

async function fileDownloadUrl(s3Key) {
  try {
    return await getSignedDownloadUrl(s3Key);
  } catch (err) {
    console.warn('[files] signed URL failed, using public URL:', err.message);
    return publicUrlForKey(s3Key);
  }
}

router.get('/', asyncHandler(async (req, res) => {
  const projects = await Project.find({ userId: req.user._id }).sort({ updatedAt: -1 });
  res.json({ projects });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Project name required' });

  const project = await Project.create({
    userId: req.user._id,
    name: name.trim(),
    description: description || '',
  });
  res.status(201).json({ project });
}));

router.get('/:id', validateObjectId(), asyncHandler(async (req, res) => {
  const project = await Project.findOne({ _id: req.params.id, userId: req.user._id });
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json({ project });
}));

router.patch('/:id', validateObjectId(), asyncHandler(async (req, res) => {
  const project = await Project.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { $set: { name: req.body.name, description: req.body.description } },
    { new: true },
  );
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json({ project });
}));

router.delete('/:id', validateObjectId(), asyncHandler(async (req, res) => {
  const project = await Project.findOne({ _id: req.params.id, userId: req.user._id });
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const userId = req.user._id.toString();
  const projectId = project._id.toString();
  const fileDocs = await ProjectFile.find({ projectId: project._id });

  for (const file of fileDocs) {
    try {
      await deleteStorageKey(file.s3Key);
    } catch (err) {
      console.warn(`[projects] delete file ${file.name}:`, err.message);
    }
  }

  try {
    await deleteProjectStorage(userId, projectId);
  } catch (err) {
    console.warn('[projects] delete storage prefix:', err.message);
  }

  try {
    await fs.rm(projectWorkspaceDir(userId, projectId), { recursive: true, force: true });
  } catch (err) {
    if (err?.code !== 'ENOENT') console.warn('[projects] delete workspace:', err.message);
  }

  await ProjectFile.deleteMany({ projectId: project._id });
  await ChatMessage.deleteMany({ projectId: project._id });
  await Job.deleteMany({ projectId: project._id });
  await Project.findByIdAndDelete(project._id);

  res.json({ ok: true, deleted: projectId });
}));

router.get('/:id/files', validateObjectId(), asyncHandler(async (req, res) => {
  const project = await Project.findOne({ _id: req.params.id, userId: req.user._id });
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const files = await ProjectFile.find({ projectId: project._id }).sort({ createdAt: -1 });
  const visible = filterUserVisibleFiles(files);
  const withUrls = await Promise.all(
    visible.map(async (f) => ({
      ...f.toObject(),
      downloadUrl: await fileDownloadUrl(f.s3Key),
    })),
  );
  res.json({ files: withUrls });
}));

router.get('/:id/files/:fileId/content', validateObjectId('id'), validateObjectId('fileId'), asyncHandler(async (req, res) => {
  const project = await Project.findOne({ _id: req.params.id, userId: req.user._id });
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const file = await ProjectFile.findOne({
    _id: req.params.fileId,
    projectId: project._id,
    userId: req.user._id,
  });
  if (!file) return res.status(404).json({ error: 'File not found' });

  const stream = await getObjectStream(file.s3Key);
  res.setHeader('content-type', file.mimeType || 'application/octet-stream');
  res.setHeader('cache-control', 'private, max-age=120');
  stream.pipe(res);
}));

router.get('/:id/messages', validateObjectId(), asyncHandler(async (req, res) => {
  const project = await Project.findOne({ _id: req.params.id, userId: req.user._id });
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const messages = await ChatMessage.find({ projectId: project._id }).sort({ createdAt: 1 });
  res.json({ messages });
}));

export default router;
