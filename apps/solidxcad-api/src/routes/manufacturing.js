import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateObjectId } from '../middleware/validateObjectId.js';
import { Project } from '../models/Project.js';
import { chargeCredits, CREDIT_COSTS } from '../services/credits.js';
import { executeSliceJob } from '../services/sliceService.js';
import { importStepPart } from '../services/partsImport.js';
import { searchStepParts } from '../services/cadWorker.js';
import { getSignedDownloadUrl, publicUrlForKey } from '../services/s3.js';

const router = Router();
router.use(requireAuth);

async function fileDownloadUrl(s3Key) {
  try {
    return await getSignedDownloadUrl(s3Key);
  } catch {
    return publicUrlForKey(s3Key);
  }
}

router.post('/slice', asyncHandler(async (req, res) => {
  const { projectId, fileId, profilePath } = req.body;
  if (!projectId || !fileId) {
    return res.status(400).json({ error: 'projectId and fileId required' });
  }

  const project = await Project.findOne({ _id: projectId, userId: req.user._id });
  if (!project) return res.status(404).json({ error: 'Project not found' });

  try {
    await chargeCredits(req.user._id, CREDIT_COSTS.slice, 'slice', { projectId, fileId });
  } catch (err) {
    if (err.code === 'INSUFFICIENT_CREDITS') {
      return res.status(402).json({ error: 'Insufficient credits', balance: err.balance });
    }
    throw err;
  }

  console.log(`[manufacturing] slice project=${projectId} file=${fileId}`);
  const result = await executeSliceJob({
    userId: req.user._id.toString(),
    projectId: project._id.toString(),
    fileId,
    profilePath,
  });

  if (!result.ok) {
    console.error(`[manufacturing] slice failed: ${result.error}`);
    return res.status(422).json({ error: result.error, job: result.job });
  }

  const downloadUrl = await fileDownloadUrl(result.file.s3Key);
  res.json({
    ok: true,
    job: result.job,
    file: {
      ...result.file.toObject(),
      downloadUrl,
    },
  });
}));

router.post('/parts/import', asyncHandler(async (req, res) => {
  const { projectId, partId, partUrl, name } = req.body;
  if (!projectId) return res.status(400).json({ error: 'projectId required' });
  if (!partId && !partUrl) return res.status(400).json({ error: 'partId or partUrl required' });

  const project = await Project.findOne({ _id: projectId, userId: req.user._id });
  if (!project) return res.status(404).json({ error: 'Project not found' });

  try {
    await chargeCredits(req.user._id, CREDIT_COSTS.parts_download, 'parts_download', { projectId, partId });
  } catch (err) {
    if (err.code === 'INSUFFICIENT_CREDITS') {
      return res.status(402).json({ error: 'Insufficient credits', balance: err.balance });
    }
    throw err;
  }

  const fileDoc = await importStepPart({
    userId: req.user._id.toString(),
    projectId: project._id.toString(),
    partId,
    partUrl,
    name,
  });

  const downloadUrl = await fileDownloadUrl(fileDoc.s3Key);
  res.status(201).json({
    file: { ...fileDoc.toObject(), downloadUrl },
  });
}));

router.post('/parts/search', asyncHandler(async (req, res) => {
  const { query } = req.body;
  if (!query?.trim()) return res.status(400).json({ error: 'query required' });

  try {
    await chargeCredits(req.user._id, CREDIT_COSTS.parts_search, 'parts_search');
    const results = await searchStepParts(query.trim());
    res.json(results);
  } catch (err) {
    if (err.code === 'INSUFFICIENT_CREDITS') {
      return res.status(402).json({ error: 'Insufficient credits', balance: err.balance });
    }
    res.status(500).json({ error: err.message });
  }
}));

export default router;
