import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { ProjectFile } from '../models/ProjectFile.js';
import { getSignedDownloadUrl } from '../services/s3.js';

const router = Router();
router.use(requireAuth);

router.get('/:fileId/url', async (req, res) => {
  const file = await ProjectFile.findOne({ _id: req.params.fileId, userId: req.user._id });
  if (!file) return res.status(404).json({ error: 'File not found' });

  const url = await getSignedDownloadUrl(file.s3Key);
  res.json({ url, name: file.name, kind: file.kind });
});

export default router;
