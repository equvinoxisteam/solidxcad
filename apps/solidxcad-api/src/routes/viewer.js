import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';
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
import { repairProjectStorageIfNeeded, repairProjectStorage } from '../services/projectStorageRepair.js';
import {
  buildStepModuleScript,
  extractPythonNumericParams,
} from '../services/stepModuleFromPython.js';
import { resolvePythonSourceForStep } from '../services/stepPythonResolver.js';
import { regeneratePartWithParameters } from '../services/cadWorker.js';

const router = Router();

function storageErrorStatus(err) {
  if (err?.status) return err.status;
  if (err?.code === 'ENOENT' || err?.name === 'NoSuchKey' || err?.name === 'NotFound') {
    return 404;
  }
  return 500;
}

async function sendProjectFileContent(res, match, { cacheSeconds = 300 } = {}) {
  const stream = await getObjectStream(match.s3Key);
  res.setHeader('content-type', match.mimeType || 'application/octet-stream');
  res.setHeader('cache-control', `private, max-age=${cacheSeconds}`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  await pipeline(stream, res);
}

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

  await repairProjectStorageIfNeeded({
    userId: payload.userId,
    projectId: project._id.toString(),
  });

  let files = await ProjectFile.find({ projectId: project._id }).sort({ createdAt: 1 });
  try {
    const { ensureGlbSidecarsForSteps } = await import('../services/artifactPipeline.js');
    files = await ensureGlbSidecarsForSteps({
      userId: payload.userId,
      projectId: project._id.toString(),
      files,
    });
  } catch (err) {
    console.warn('[viewer] GLB sidecar ensure:', err.message);
  }

  const catalog = await buildProjectCatalog(files, {
    projectId: project._id.toString(),
    apiBase: config.apiUrl,
    catalogToken: token,
    usePresignedUrls: false,
  });

  res.setHeader('cache-control', 'private, max-age=30');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json(catalog);
}));

router.get('/public/step-module', asyncHandler(async (req, res) => {
  const token = String(req.query.token || '').trim();
  const stepRef = String(req.query.step || '').trim();
  if (!token) return res.status(400).json({ error: 'token query required' });
  if (!stepRef) return res.status(400).json({ error: 'step query required' });

  let payload;
  try {
    payload = verifyViewerCatalogToken(token);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired viewer token' });
  }

  const project = await Project.findOne({ _id: payload.projectId, userId: payload.userId });
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const stepBaseName = path.posix.basename(stepRef);
  const stepMatch = await ProjectFile.findOne({
    projectId: project._id,
    userId: payload.userId,
    name: stepBaseName,
  });
  if (!stepMatch || !/\.(step|stp)$/i.test(stepMatch.name)) {
    return res.status(404).json({ error: 'STEP file not found' });
  }

  const pyName = stepMatch.name.replace(/\.(step|stp)$/i, '.py');
  const pyMatch = await ProjectFile.findOne({
    projectId: project._id,
    userId: payload.userId,
    name: pyName,
  });

  let source = '';
  if (pyMatch?.s3Key) {
    try {
      const stream = await getObjectStream(pyMatch.s3Key);
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      source = Buffer.concat(chunks).toString('utf8');
    } catch {
      source = '';
    }
  }

  if (!source) {
    const resolved = await resolvePythonSourceForStep({
      projectId: project._id,
      userId: payload.userId,
      stepFileName: stepMatch.name,
    });
    source = resolved.source || '';
  }

  if (!source) {
    return res.status(404).json({ error: 'STEP module not available for this file' });
  }

  const parameters = extractPythonNumericParams(source);
  const cadPath = path.posix.basename(stepRef, path.extname(stepRef));
  const script = buildStepModuleScript({ cadPath, parameters });

  res.setHeader('content-type', 'text/javascript; charset=utf-8');
  res.setHeader('cache-control', 'private, max-age=60');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.send(script);
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

  await repairProjectStorageIfNeeded({
    userId: payload.userId,
    projectId: project._id.toString(),
  });

  let files = await ProjectFile.find({ projectId: project._id });
  let match = files.find((f) => fileRefForDoc(f) === fileRef || f.name === fileRef);
  if (!match) {
    return res.status(404).json({ error: 'File not found' });
  }

  try {
    await sendProjectFileContent(res, match, { cacheSeconds: 300 });
  } catch (err) {
    if (!res.headersSent && storageErrorStatus(err) === 404) {
      await repairProjectStorage({
        userId: payload.userId,
        projectId: project._id.toString(),
        force: true,
      });
      const refreshed = await ProjectFile.findById(match._id);
      if (refreshed) {
        try {
          await sendProjectFileContent(res, refreshed, { cacheSeconds: 300 });
          return;
        } catch (retryErr) {
          if (!res.headersSent) {
            res.status(storageErrorStatus(retryErr)).json({
              error: retryErr.message || 'Failed to load file',
            });
          }
          return;
        }
      }
    }
    if (!res.headersSent) {
      res.status(storageErrorStatus(err)).json({
        error: err.message || 'Failed to load file',
      });
    }
  }
}));

async function runStepParameterRegenerate({
  userId,
  projectId,
  stepRef,
  parameterValues = {},
}) {
  const stepBaseName = path.posix.basename(stepRef);
  const stepMatch = await ProjectFile.findOne({
    projectId,
    userId,
    name: stepBaseName,
  });
  if (!stepMatch || !/\.(step|stp)$/i.test(stepMatch.name)) {
    return { ok: false, status: 404, error: 'STEP file not found' };
  }

  const resolved = await resolvePythonSourceForStep({
    projectId,
    userId,
    stepFileName: stepMatch.name,
  });
  if (!resolved.source) {
    return { ok: false, status: 404, error: 'No generator script found for this part' };
  }

  const result = await regeneratePartWithParameters({
    userId: userId.toString(),
    projectId: projectId.toString(),
    partName: resolved.partName,
    pythonCode: resolved.source,
    parameterValues,
  });

  if (!result.ok) {
    return { ok: false, status: 500, error: result.error || 'Regeneration failed' };
  }

  try {
    const { syncProjectWorkspace } = await import('../services/projectWorkspace.js');
    await syncProjectWorkspace({ userId: userId.toString(), projectId: projectId.toString() });
  } catch {
    // non-fatal
  }

  return {
    ok: true,
    file: result.stepDoc,
    partName: resolved.partName,
  };
}

router.post('/public/regenerate-step', asyncHandler(async (req, res) => {
  const token = String(req.query.token || '').trim();
  const stepRef = String(req.query.step || req.body?.step || '').trim();
  if (!token) return res.status(400).json({ error: 'token query required' });
  if (!stepRef) return res.status(400).json({ error: 'step query required' });

  let payload;
  try {
    payload = verifyViewerCatalogToken(token);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired viewer token' });
  }

  const project = await Project.findOne({ _id: payload.projectId, userId: payload.userId });
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const parameterValues = req.body?.parameters && typeof req.body.parameters === 'object'
    ? req.body.parameters
    : {};

  const result = await runStepParameterRegenerate({
    userId: payload.userId,
    projectId: project._id,
    stepRef,
    parameterValues,
  });

  if (!result.ok) {
    return res.status(result.status || 500).json({ error: result.error });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({
    ok: true,
    file: { name: result.file?.name, kind: result.file?.kind },
    partName: result.partName,
  });
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

router.post('/projects/:id/regenerate-step', validateObjectId('id'), asyncHandler(async (req, res) => {
  const project = await Project.findOne({ _id: req.params.id, userId: req.user._id });
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const stepRef = String(req.body?.step || req.body?.stepFile || '').trim();
  if (!stepRef) return res.status(400).json({ error: 'step required' });

  const parameterValues = req.body?.parameters && typeof req.body.parameters === 'object'
    ? req.body.parameters
    : {};

  const result = await runStepParameterRegenerate({
    userId: req.user._id,
    projectId: project._id,
    stepRef,
    parameterValues,
  });

  if (!result.ok) {
    return res.status(result.status || 500).json({ error: result.error });
  }

  res.json({
    ok: true,
    file: result.file,
    partName: result.partName,
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
    await repairProjectStorageIfNeeded({ userId, projectId });
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

  try {
    await sendProjectFileContent(res, match, { cacheSeconds: 60 });
  } catch (err) {
    if (!res.headersSent) {
      res.status(storageErrorStatus(err)).json({
        error: err.message || 'Failed to load file',
      });
    }
  }
}));

export default router;
