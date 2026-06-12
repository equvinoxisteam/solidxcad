import fs from 'fs/promises';
import path from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { config } from '../config.js';
import { ProjectFile } from '../models/ProjectFile.js';
import { getObjectStream } from './s3.js';

export function workspaceRoot() {
  return path.join(config.textToCadRoot, 'tmp', 'solidxcad-projects');
}

export function projectWorkspaceDir(userId, projectId) {
  return path.join(workspaceRoot(), String(userId), String(projectId));
}

function relativeFilePath(fileDoc) {
  const name = fileDoc.name || path.basename(fileDoc.s3Key);
  if (fileDoc.s3Key.includes('/models/')) {
    return path.posix.join('models', name);
  }
  if (fileDoc.s3Key.includes('/slices/')) {
    return path.posix.join('slices', name);
  }
  if (fileDoc.s3Key.includes('/parts/')) {
    return path.posix.join('parts', name);
  }
  return name;
}

export async function syncProjectWorkspace({ userId, projectId }) {
  const root = projectWorkspaceDir(userId, projectId);
  await fs.mkdir(path.join(root, 'models'), { recursive: true });
  await fs.mkdir(path.join(root, 'slices'), { recursive: true });
  await fs.mkdir(path.join(root, 'parts'), { recursive: true });

  const files = await ProjectFile.find({ projectId, userId }).sort({ createdAt: 1 });
  const synced = [];

  for (const file of files) {
    const rel = relativeFilePath(file);
    const dest = path.join(root, rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });

    try {
      const stream = await getObjectStream(file.s3Key);
      await pipeline(stream, createWriteStream(dest));
      synced.push({ id: file._id.toString(), file: rel, name: file.name, kind: file.kind });
    } catch (err) {
      console.warn(`[workspace] skip ${file.name}:`, err.message);
    }
  }

  for (const entry of synced.filter((f) => f.kind === 'urdf' || /\.urdf$/i.test(f.name))) {
    const urdfOnDisk = path.join(root, entry.file);
    try {
      await repairUrdfGeneratorSidecar(root, urdfOnDisk);
    } catch (err) {
      console.warn(`[workspace] URDF sidecar for ${entry.name}:`, err.message);
    }
  }

  for (const entry of synced.filter((f) => f.kind === 'step')) {
    const stepDoc = files.find((f) => f._id.toString() === entry.id);
    if (!stepDoc) continue;
    try {
      const { ensureGlbSidecar } = await import('./artifactPipeline.js');
      const glbDoc = await ensureGlbSidecar({
        userId,
        projectId,
        stepFileDoc: stepDoc,
        onProgress: () => {},
      });
      if (!glbDoc) continue;
      const glbRel = fileRefForDoc(glbDoc);
      synced.push({
        id: glbDoc._id?.toString() || `glb-${entry.id}`,
        file: glbRel,
        name: glbDoc.name,
        kind: 'glb',
      });
      console.log(`[workspace] GLB sidecar ready: ${glbRel}`);
    } catch (err) {
      console.warn(`[workspace] GLB sidecar for ${entry.name}:`, err.message);
    }
  }

  return { root, files: synced };
}

export function fileRefForDoc(fileDoc) {
  return relativeFilePath(fileDoc);
}

async function repairUrdfGeneratorSidecar(workspaceRoot, urdfOnDisk) {
  const pyBeside = urdfOnDisk.replace(/\.urdf$/i, '.py');
  try {
    await fs.access(pyBeside);
  } catch {
    return;
  }
  const pyName = path.basename(pyBeside);
  let text = await fs.readFile(urdfOnDisk, 'utf8');
  const metadataRe = /<!--\s*cadpy:sourcePath=([\s\S]*?)-->/;
  const match = metadataRe.exec(text);
  if (!match || match[1].trim() === pyName) return;
  const updated = text.replace(metadataRe, `<!-- cadpy:sourcePath=${pyName} -->`);
  if (updated !== text) {
    await fs.writeFile(urdfOnDisk, updated, 'utf8');
    console.log(`[workspace] repaired URDF generator metadata: ${path.basename(urdfOnDisk)} → ${pyName}`);
  }
}
