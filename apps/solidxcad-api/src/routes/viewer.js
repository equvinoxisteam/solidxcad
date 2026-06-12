import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateObjectId } from '../middleware/validateObjectId.js';
import { Project } from '../models/Project.js';
import { ProjectFile } from '../models/ProjectFile.js';
import { config } from '../config.js';
import { getActiveViewerUrl } from '../services/viewerLauncher.js';
import { syncProjectWorkspace, projectWorkspaceDir, fileRefForDoc } from '../services/projectWorkspace.js';
import { buildProjectCatalog } from '../services/viewerCatalog.js';
import { getObjectStream } from '../services/s3.js';
import { signViewerCatalogToken, verifyViewerCatalogToken } from '../services/viewerSession.js';

const router = Router();

function buildViewerLink({ viewerUrl, file, catalogUrl, workspaceDir }) {
  const base = viewerUrl.replace(/\/$/, '');
  const fileParam = String(file || '').trim();

  if (config.viewerCloudMode && catalogUrl) {
    const params = new URLSearchParams();
    params.set('catalogUrl', catalogUrl);
    if (fileParam) params.set('file', fileParam);
    params.set('embed', '1');
    return `${base}/?${params.toString()}`;
  }

  if (workspaceDir) {
    return fileParam
      ? `${base}/?dir=${encodeURIComponent(workspaceDir)}&file=${encodeURIComponent(fileParam)}&embed=1`
      : `${base}/?dir=${encodeURIComponent(workspaceDir)}&embed=1`;
  }

  return fileParam
    ? `${base}/?file=${encodeURIComponent(fileParam)}&embed=1`
    : `${base}/?embed=1`;
}

router.get('/public/catalog', asyncHandler(async (req, res) => {
  const token = String(req.query.token || '').trim();
  if (!token) return res.status(400).json({ error: 'token query required' });

  let payload;
  try {
    payload = verifyViewerCatalogToken(token);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired viewer token' });
  }

  const project = await Project.findOne({ _id: payload.projectId, userId: payload.userId });
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const files = await ProjectFile.find({ projectId: project._id }).sort({ createdAt: 1 });
  const catalog = await buildProjectCatalog(files, {
    projectId: project._id.toString(),
    apiBase: config.apiUrl,
    catalogToken: token,
  });

  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('cache-control', 'private, max-age=30');
  res.json(catalog);
}));

router.get('/public/content', asyncHandler(async (req, res) => {
  const token = String(req.query.token || '').trim();
  const fileRef = String(req.query.file || '').trim();
  if (!token) return res.status(400).json({ error: 'token query required' });
  if (!fileRef) return res.status(400).json({ error: 'file query required' });

  let payload;
  try {
    payload = verifyViewerCatalogToken(token);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired viewer token' });
  }

  const project = await Project.findOne({ _id: payload.projectId, userId: payload.userId });
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const files = await ProjectFile.find({ projectId: project._id });
  const match = files.find((f) => fileRefForDoc(f) === fileRef || f.name === fileRef);
  if (!match) {
    return res.status(404).json({ error: 'File not found' });
  }

  const stream = await getObjectStream(match.s3Key);
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('content-type', match.mimeType || 'application/octet-stream');
  res.setHeader('cache-control', 'private, max-age=300');
  stream.pipe(res);
}));

router.use(requireAuth);

router.post('/projects/:id/sync', validateObjectId('id'), asyncHandler(async (req, res) => {
  const project = await Project.findOne({ _id: req.params.id, userId: req.user._id });
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const { root, files } = await syncProjectWorkspace({
    userId: req.user._id.toString(),
    projectId: project._id.toString(),
  });

  const viewerUrl = await getActiveViewerUrl();
  res.json({
    workspaceDir: root,
    files,
    viewerUrl,
  });
}));

router.get('/projects/:id/catalog', validateObjectId('id'), asyncHandler(async (req, res) => {
  const project = await Project.findOne({ _id: req.params.id, userId: req.user._id });
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const files = await ProjectFile.find({ projectId: project._id }).sort({ createdAt: 1 });
  const catalog = await buildProjectCatalog(files, {
    projectId: project._id.toString(),
    apiBase: config.apiUrl,
    usePresignedUrls: config.viewerCloudMode,
  });
  res.json(catalog);
}));

router.get('/projects/:id/session', validateObjectId('id'), asyncHandler(async (req, res) => {
  const project = await Project.findOne({ _id: req.params.id, userId: req.user._id });
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const userId = req.user._id.toString();
  const projectId = project._id.toString();

  let root = '';
  let files = [];
  if (!config.viewerCloudMode) {
    const synced = await syncProjectWorkspace({ userId, projectId });
    root = synced.root;
    files = synced.files;
  } else {
    files = (await ProjectFile.find({ projectId: project._id }).sort({ createdAt: 1 }))
      .map((f) => ({ file: fileRefForDoc(f), name: f.name }));
  }

  const fileParam = String(req.query.file || '').trim();
  const selected = fileParam || (files[0]?.file || '');

  const viewerUrl = await getActiveViewerUrl();
  let catalogUrl = `${config.apiUrl}/api/viewer/projects/${projectId}/catalog`;

  if (config.viewerCloudMode) {
    const token = signViewerCatalogToken({ userId, projectId });
    catalogUrl = `${config.apiUrl}/api/viewer/public/catalog?token=${encodeURIComponent(token)}`;
  }

  res.json({
    viewerUrl,
    workspaceDir: root,
    file: selected,
    catalogUrl,
    viewerCloudMode: config.viewerCloudMode,
    viewerLink: buildViewerLink({
      viewerUrl,
      file: selected,
      catalogUrl: config.viewerCloudMode ? catalogUrl : '',
      workspaceDir: root,
    }),
  });
}));

router.get('/projects/:id/content', validateObjectId('id'), asyncHandler(async (req, res) => {
  const project = await Project.findOne({ _id: req.params.id, userId: req.user._id });
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const fileRef = String(req.query.file || '').trim();
  if (!fileRef) return res.status(400).json({ error: 'file query required' });

  const files = await ProjectFile.find({ projectId: project._id });
  const match = files.find((f) => fileRefForDoc(f) === fileRef || f.name === fileRef);
  if (!match) {
    const root = projectWorkspaceDir(req.user._id.toString(), project._id.toString());
    const localPath = path.join(root, fileRef);
    try {
      const data = await fs.readFile(localPath);
      res.setHeader('content-type', 'application/octet-stream');
      res.setHeader('cache-control', 'private, max-age=60');
      return res.send(data);
    } catch {
      return res.status(404).json({ error: 'File not found' });
    }
  }

  const stream = await getObjectStream(match.s3Key);
  res.setHeader('content-type', match.mimeType || 'application/octet-stream');
  res.setHeader('cache-control', 'private, max-age=60');
  stream.pipe(res);
}));

export default router;
