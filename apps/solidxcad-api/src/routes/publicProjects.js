import { Router } from 'express';
import { Project } from '../models/Project.js';
import { ProjectFile } from '../models/ProjectFile.js';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateObjectId } from '../middleware/validateObjectId.js';
import { filterUserVisibleFiles } from '../services/projectFileVisibility.js';
import { enrichProjectWithPreview, previewFileMeta } from '../services/projectPublish.js';
import { remixPublicProject } from '../services/projectRemix.js';
import { getObjectStream } from '../services/s3.js';

const router = Router();

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function publicProjectPayload(project, author) {
  const enriched = await enrichProjectWithPreview(project);
  return {
    _id: enriched._id,
    name: enriched.name,
    description: enriched.description || '',
    publishedAt: enriched.publishedAt,
    remixCount: enriched.remixCount || 0,
    previewFile: enriched.previewFile,
    authorName: author?.name || 'Designer',
    createdAt: enriched.createdAt,
    updatedAt: enriched.updatedAt,
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const sort = String(req.query.sort || 'recent').toLowerCase();
  const filter = { isPublic: true };

  if (q) {
    const re = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: re }, { description: re }];
  }

  const sortSpec = sort === 'popular'
    ? { remixCount: -1, publishedAt: -1 }
    : sort === 'name'
      ? { name: 1 }
      : { publishedAt: -1 };

  const projects = await Project.find(filter).sort(sortSpec).limit(60);
  const userIds = [...new Set(projects.map((p) => String(p.userId)))];
  const users = await User.find({ _id: { $in: userIds } }).select('name');
  const userMap = new Map(users.map((u) => [String(u._id), u]));

  const list = await Promise.all(
    projects.map((p) => publicProjectPayload(p, userMap.get(String(p.userId)))),
  );

  res.json({ projects: list });
}));

router.get('/:id', validateObjectId(), asyncHandler(async (req, res) => {
  const project = await Project.findOne({ _id: req.params.id, isPublic: true });
  if (!project) return res.status(404).json({ error: 'Public project not found' });

  const author = await User.findById(project.userId).select('name');
  const payload = await publicProjectPayload(project, author);
  res.json({ project: payload });
}));

router.get('/:id/files', validateObjectId(), asyncHandler(async (req, res) => {
  const project = await Project.findOne({ _id: req.params.id, isPublic: true });
  if (!project) return res.status(404).json({ error: 'Public project not found' });

  const files = await ProjectFile.find({ projectId: project._id }).sort({ createdAt: -1 });
  const visible = filterUserVisibleFiles(files);
  res.json({
    files: visible.map((f) => ({
      _id: f._id,
      name: f.name,
      kind: f.kind || 'file',
      sizeBytes: f.sizeBytes || 0,
    })),
  });
}));

router.get('/:id/files/:fileId/content', validateObjectId('id'), validateObjectId('fileId'), asyncHandler(async (req, res) => {
  const project = await Project.findOne({ _id: req.params.id, isPublic: true });
  if (!project) return res.status(404).json({ error: 'Public project not found' });

  const file = await ProjectFile.findOne({
    _id: req.params.fileId,
    projectId: project._id,
  });
  if (!file) return res.status(404).json({ error: 'File not found' });

  const stream = await getObjectStream(file.s3Key);
  res.setHeader('content-type', file.mimeType || 'application/octet-stream');
  res.setHeader('cache-control', 'public, max-age=300');
  stream.pipe(res);
}));

router.post('/:id/remix', requireAuth, validateObjectId(), asyncHandler(async (req, res) => {
  const { name } = req.body || {};
  const project = await remixPublicProject({
    sourceProjectId: req.params.id,
    userId: req.user._id,
    name,
  });

  const enriched = await enrichProjectWithPreview(project, { includePrivate: true });
  res.status(201).json({
    project: {
      ...enriched,
      previewFile: previewFileMeta(
        enriched.previewFileId
          ? await ProjectFile.findById(enriched.previewFileId).select('name kind')
          : null,
      ),
    },
  });
}));

export default router;
