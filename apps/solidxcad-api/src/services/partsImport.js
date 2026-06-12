import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { ProjectFile } from '../models/ProjectFile.js';
import { buildS3Key, uploadFile } from './s3.js';
import { ensureMeshSidecar } from './artifactPipeline.js';

const STEP_PARTS_ORIGIN = 'https://api.step.parts';

export async function fetchStepPart(partId) {
  const url = `${STEP_PARTS_ORIGIN}/v1/parts/${encodeURIComponent(partId)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'solidxcad-api/1.0' } });
  if (!res.ok) throw new Error(`step.parts part not found: ${res.status}`);
  return res.json();
}

export async function importStepPart({ userId, projectId, partId, partUrl, name }) {
  let downloadUrl = partUrl;
  let partName = name;

  if (partId && !downloadUrl) {
    const part = await fetchStepPart(partId);
    downloadUrl = part.stepUrl || part.downloadUrl || part.url;
    partName = partName || part.name || part.title || `${partId}.step`;
  }

  if (!downloadUrl) throw new Error('No STEP download URL for this part');

  if (!partName) {
    partName = path.basename(new URL(downloadUrl).pathname) || 'part.step';
  }
  if (!partName.endsWith('.step') && !partName.endsWith('.stp')) {
    partName += '.step';
  }

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'solidxcad-part-'));
  const localPath = path.join(workDir, partName);

  try {
    const res = await fetch(downloadUrl, { headers: { 'User-Agent': 'solidxcad-api/1.0' } });
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    await pipeline(res.body, createWriteStream(localPath));

    const partKey = buildS3Key(userId, projectId, `parts/${partName}`);
    const partUpload = await uploadFile(partKey, localPath, 'application/step');

    const fileDoc = await ProjectFile.create({
      projectId,
      userId,
      name: partName,
      s3Key: partUpload.key,
      mimeType: 'application/step',
      kind: 'step',
    });

    try {
      await ensureMeshSidecar({
        userId,
        projectId,
        stepFileDoc: fileDoc,
        stepLocalPath: localPath,
      });
    } catch (stlErr) {
      console.warn('[parts] STL sidecar failed:', stlErr.message);
    }

    return fileDoc;
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}
