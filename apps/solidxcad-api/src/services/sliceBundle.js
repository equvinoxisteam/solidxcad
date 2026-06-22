import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { ProjectFile } from '../models/ProjectFile.js';
import { buildS3Key, uploadFile, getObjectStream } from './s3.js';

const MIME_BY_EXT = {
  '.stl': 'model/stl',
  '.3mf': 'model/3mf',
};

const KIND_BY_EXT = {
  '.stl': 'stl',
  '.3mf': '3mf',
};

/**
 * Copy matching STL/3MF print meshes beside G-code under slices/.
 */
export async function publishSliceCompanionMeshes({ userId, projectId, meshFileName }) {
  const base = path.basename(meshFileName, path.extname(meshFileName));
  const files = await ProjectFile.find({ projectId, userId });
  const published = [];

  for (const ext of ['3mf', 'stl']) {
    const name = `${base}.${ext}`;
    const source = files.find(
      (f) => f.name === name && f.s3Key && !String(f.s3Key).includes('/slices/'),
    );
    if (!source) continue;

    const existingSlice = files.find(
      (f) => f.name === name && String(f.s3Key).includes('/slices/'),
    );
    if (existingSlice) {
      published.push(existingSlice);
      continue;
    }

    const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'solidxcad-slice-bundle-'));
    const localPath = path.join(workDir, name);
    try {
      await pipeline(await getObjectStream(source.s3Key), createWriteStream(localPath));
      const dotExt = `.${ext}`;
      const key = buildS3Key(userId, projectId, `slices/${name}`);
      const upload = await uploadFile(key, localPath, MIME_BY_EXT[dotExt] || 'application/octet-stream');
      const doc = await ProjectFile.create({
        projectId,
        userId,
        name,
        s3Key: upload.key,
        mimeType: MIME_BY_EXT[dotExt] || 'application/octet-stream',
        kind: KIND_BY_EXT[dotExt] || 'other',
      });
      published.push(doc);
      console.log(`[slice] ✓ bundled slices/${name}`);
    } finally {
      await fs.rm(workDir, { recursive: true, force: true });
    }
  }

  return published;
}
